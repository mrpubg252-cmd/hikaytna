import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import appletConfig from '../../firebase-applet-config.json';

const isRemixed = appletConfig && appletConfig.projectId && appletConfig.projectId !== "remixed-project-id";

const firebaseConfig = {
  apiKey: isRemixed ? appletConfig.apiKey : "AIzaSyCQpOf-eNn6Le8b5wsdiDuPabBV_scBD68",
  authDomain: isRemixed ? appletConfig.authDomain : "mo-play-b0cb7.firebaseapp.com",
  projectId: isRemixed ? appletConfig.projectId : "mo-play-b0cb7",
  databaseURL: isRemixed ? `https://${appletConfig.projectId}-default-rtdb.firebaseio.com` : "https://mo-play-b0cb7-default-rtdb.firebaseio.com",
  storageBucket: isRemixed ? appletConfig.storageBucket : "mo-play-b0cb7.firebasestorage.app",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

const dbId = isRemixed && appletConfig.firestoreDatabaseId ? appletConfig.firestoreDatabaseId : "(default)";
export const firestore = getFirestore(app, dbId);

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
