import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getDatabase, ref, get } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCQpOf-eNn6Le8b5wsdiDuPabBV_scBD68",
  authDomain: "mo-play-b0cb7.firebaseapp.com",
  databaseURL: "https://mo-play-b0cb7-default-rtdb.firebaseio.com",
  projectId: "mo-play-b0cb7",
  storageBucket: "mo-play-b0cb7.firebasestorage.app",
  messagingSenderId: "276393305302",
  appId: "1:276393305302:web:12f90a55d7c13a4c57d577"
};

async function testFirebaseSetup() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getDatabase(app);

  try {
    console.log("Attempting anonymous sign-in...");
    const userCredential = await signInAnonymously(auth);
    console.log("✅ Signed in successfully! User UID:", userCredential.user.uid);
    
    console.log("Attempting database read at /chats/global_chat_v1...");
    const dbRef = ref(db, "chats/global_chat_v1");
    const snapshot = await get(dbRef);
    console.log("✅ Database read success. Data keys size:", snapshot.exists() ? Object.keys(snapshot.val() || {}).length : 0);
  } catch (err: any) {
    console.error("❌ Firebase operation failed:", err.message, err.code);
  }
}

testFirebaseSetup();
