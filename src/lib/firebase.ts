import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAnYkOnP2XWfaKrXXvTO3Euq7s-pl9QGKg",
  authDomain: "chat-516a8.firebaseapp.com",
  projectId: "chat-516a8",
  databaseURL: "https://chat-516a8-default-rtdb.firebaseio.com",
  storageBucket: "chat-516a8.firebasestorage.app",
  messagingSenderId: "276393305302",
  appId: "1:276393305302:web:12f90a55d7c13a4c57d577"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

