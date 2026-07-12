import { User, Settings, CreditCard, Bell, LogOut, ChevronLeft } from "lucide-react";

export default function Profile() {
  const menuItems = [
    { icon: User, label: "المعلومات الشخصية" },
    { icon: CreditCard, label: "الاشتراك والدفع", badge: "VIP" },
    { icon: Bell, label: "الإشعارات" },
    { icon: Settings, label: "الإعدادات" },
  ];

  return (
    <div className="pt-32 px-8 pb-24 max-w-4xl mx-auto min-h-screen">
      <h1 className="text-3xl font-black text-white mb-8">حسابي</h1>
      
      <div className="bg-[#111] border border-zinc-800 rounded-2xl p-8 mb-8 flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-right shadow-xl">
        <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop" className="w-24 h-24 rounded-full border-4 border-zinc-800 object-cover shadow-2xl" alt="Profile" />
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white mb-1">أحمد محمد</h2>
          <p className="text-gray-400 mb-4">ahmed@example.com</p>
          <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-700 text-white px-4 py-1.5 rounded-full text-sm font-black shadow-lg shadow-amber-600/20">
            عضوية بريميوم
          </div>
        </div>
      </div>

      <div className="bg-[#111] border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        {menuItems.map((item, idx) => (
          <button key={idx} className="w-full flex items-center justify-between p-6 border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors group text-right">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-gray-400 group-hover:text-red-500 group-hover:bg-red-500/10 transition-colors">
                <item.icon className="w-6 h-6" />
              </div>
              <span className="text-lg font-bold text-gray-200 group-hover:text-white transition-colors">{item.label}</span>
              {item.badge && (
                <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded font-black mr-4">
                  {item.badge}
                </span>
              )}
            </div>
            <ChevronLeft className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
          </button>
        ))}
        <button className="w-full flex items-center gap-4 p-6 hover:bg-red-500/10 transition-colors group text-right">
          <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors">
            <LogOut className="w-6 h-6" />
          </div>
          <span className="text-lg font-bold text-red-500">تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
}
