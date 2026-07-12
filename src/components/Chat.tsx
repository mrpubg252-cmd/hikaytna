import { useState, useEffect, useRef } from "react";
import type { FormEvent } from "react";
import { ref, push, onValue, remove, query, orderByChild } from "firebase/database";
import { db } from "../lib/firebase";
import { Send, Wand2, Trash2, Loader2, User } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface Message {
  id: string;
  text: string;
  timestamp: number;
  sender: string;
  avatar: string;
}

export default function Chat({ seriesId }: { seriesId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isCorrecting, setIsCorrecting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const messagesRef = query(ref(db, `chats/${seriesId}`), orderByChild("timestamp"));
    
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgList = Object.entries(data).map(([key, value]: [string, any]) => ({
          id: key,
          ...value
        }));

        // Cleanup old messages (older than 4 days)
        const fourDaysAgo = Date.now() - 4 * 24 * 60 * 60 * 1000;
        const activeMessages = msgList.filter(msg => {
          if (msg.timestamp < fourDaysAgo) {
            remove(ref(db, `chats/${seriesId}/${msg.id}`));
            return false;
          }
          return true;
        });

        setMessages(activeMessages);
      } else {
        setMessages([]);
      }
    });

    return () => unsubscribe();
  }, [seriesId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMessage = {
      text: input,
      timestamp: Date.now(),
      sender: "مستخدم",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100&auto=format&fit=crop"
    };

    setInput("");
    await push(ref(db, `chats/${seriesId}`), newMessage);
  };

  const handleCorrectText = async () => {
    if (!input.trim()) return;
    setIsCorrecting(true);
    try {
      const response = await fetch("/api/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      const data = await response.json();
      if (data.corrected) {
        setInput(data.corrected);
      }
    } catch (error) {
      console.error("Correction failed:", error);
    } finally {
      setIsCorrecting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1c1c1c] rounded-xl overflow-hidden shadow-2xl border border-zinc-800/50">
      <div className="bg-zinc-900/80 p-4 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-white text-lg">دردشة المسلسل</h3>
          <p className="text-xs text-gray-400">تحذف الرسائل تلقائياً بعد 4 أيام</p>
        </div>
        <div className="bg-red-600/20 text-red-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          مباشر
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-2">
            <User className="w-12 h-12 opacity-20" />
            <p>كن أول من يشارك برأيه!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-3 group">
              <img src={msg.avatar} alt={msg.sender} className="w-8 h-8 rounded-full object-cover" />
              <div className="flex-1 bg-zinc-800/50 p-3 rounded-2xl rounded-tr-none hover:bg-zinc-800 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-red-400">{msg.sender}</span>
                  <span className="text-[10px] text-gray-500">
                    {format(msg.timestamp, "hh:mm a", { locale: ar })}
                  </span>
                </div>
                <p className="text-sm text-gray-200 leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-zinc-900/50 border-t border-zinc-800">
        <form onSubmit={handleSend} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="شارك برأيك في الحلقة..."
              className="w-full bg-zinc-800 text-white rounded-full pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-red-600/50 transition-all text-sm"
              dir="auto"
            />
            <button
              type="button"
              onClick={handleCorrectText}
              disabled={isCorrecting || !input.trim()}
              title="دكتور المسلسلات: تصحيح الأخطاء اللغوية"
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-blue-400 disabled:opacity-50 transition-colors"
            >
              {isCorrecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
            </button>
          </div>
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-red-600 text-white p-3 rounded-full hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-600/20 flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
