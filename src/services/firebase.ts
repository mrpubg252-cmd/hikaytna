import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyD7-kL247_yH0C4zXW-6eP3L3W0W7E2W1E",
  authDomain: "chat-app-12345.firebaseapp.com",
  projectId: "chat-app-12345",
  databaseURL: "https://chat-app-12345-default-rtdb.firebaseio.com",
  storageBucket: "chat-app-12345.firebasestorage.app",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const firestore = getFirestore(app);

// Authenticate anonymously for secure permissions natively
const auth = getAuth(app);
signInAnonymously(auth).catch((err) => {
  console.warn("Default Firebase anonymous auth error:", err);
});

export interface Episode {
  title: string;
  link1: string;
  link2?: string;
  link3?: string;
  url?: string;
}

export interface Series {
  id: string;
  title: string;
  image: string;
  category: string;
  rating: number;
  episodes: Episode[];
  trailer: string;
  url?: string;
  views?: number;
  description?: string;
  backdrop_path?: string;
  isNew?: boolean;
  isPriority?: boolean;
}

export async function fetchAllFromFirebase() {
  const snapshot = await get(ref(db, 'series'));
  const data = snapshot.val();
  if (!data) return [];
  
  return Object.entries(data)
    .filter(([key, value]: [string, any]) => value && (value.title || value.trailer || value.episodes)) 
    .map(([key, value]: [string, any]) => ({
      id: key,
      title: value.title || '',
      image: value.image || '',
      category: value.category || '',
      rating: value.rating || 0,
      episodes: Array.isArray(value.episodes) ? value.episodes : Object.values(value.episodes || {}),
      trailer: value.trailer || ''
    })) as Series[];
}
