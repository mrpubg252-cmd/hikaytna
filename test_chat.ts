import 'dotenv/config';
import fetch from 'node-fetch';

async function testChat() {
  try {
    const res = await fetch('http://localhost:3000/api/v1/ai/chat', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "مرحبا بك يا حكيم مين انت؟", history: [] })
    });
    const data = await res.json();
    console.log("RESPONSE:", JSON.stringify(data, null, 2));
  } catch(e) {
    console.error("ERROR:", e);
  }
}
testChat();
