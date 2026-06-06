import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { MOCK_CHATS } from './src/data/mockChats.ts';

const firebaseConfig = {
  apiKey: "AIzaSyD7-kL247_yH0C4zXW-6eP3L3W0W7E2W1E",
  authDomain: "chat-app-12345.firebaseapp.com",
  projectId: "chat-app-12345",
  databaseURL: "https://chat-app-12345-default-rtdb.firebaseio.com",
  storageBucket: "chat-app-12345.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

async function seed() {
  try {
    await signInAnonymously(auth);
    console.log("Seeding chats...");
    await set(ref(db, 'chats'), MOCK_CHATS);
    console.log("Seeding successful!");
  } catch (e: any) {
    console.error("Seeding failed: ", e.message);
  }
  process.exit();
}

seed();
