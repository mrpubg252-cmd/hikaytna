import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, onValue } from 'firebase/database';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import appletConfig from '../../firebase-applet-config.json';

const config = appletConfig as any;
const isRemixed = config && config.projectId && config.projectId !== "remixed-project-id";

const firebaseConfig = {
  apiKey: isRemixed ? config.apiKey : "AIzaSyAnYkOnP2XWfaKrXXvTO3Euq7s-pl9QGKg",
  authDomain: isRemixed ? config.authDomain : "chat-516a8.firebaseapp.com",
  projectId: isRemixed ? config.projectId : "chat-516a8",
  databaseURL: isRemixed ? `https://${config.projectId}-default-rtdb.firebaseio.com` : "https://chat-516a8-default-rtdb.firebaseio.com",
  storageBucket: isRemixed ? config.storageBucket : "chat-516a8.firebasestorage.app",
  messagingSenderId: isRemixed ? config.messagingSenderId : "276393305302",
  appId: isRemixed ? config.appId : "1:276393305302:web:12f90a55d7c13a4c57d577"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

const dbId = isRemixed && config.firestoreDatabaseId ? config.firestoreDatabaseId : "(default)";
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
  isVertical?: boolean;
  episode?: string;
  episodes_count?: string;
}

export interface TopSeriesItem {
  id: string;
  title: string;
  image?: string;
  category?: string;
  url?: string;
  rank: number;
}

export async function fetchAllFromFirebase() {
  const resultList: Series[] = [];
  try {
    const snapshot = await get(ref(db, 'series'));
    const data = snapshot.val();
    if (data) {
      Object.entries(data)
        .filter(([key, value]: [string, any]) => value && (value.title || value.trailer || value.episodes)) 
        .forEach(([key, value]: [string, any]) => {
          resultList.push({
            id: key,
            title: value.title || '',
            image: value.image || '',
            category: value.category || '',
            rating: value.rating || 0,
            episodes: Array.isArray(value.episodes) ? value.episodes : Object.values(value.episodes || {}),
            trailer: value.trailer || '',
            url: value.url || ''
          } as Series);
        });
    }
  } catch (e) {
    console.warn("Failed fetching series from RTDB:", e);
  }

  try {
    const snap = await getDocs(collection(firestore, "custom_series"));
    snap.forEach((d) => {
      const value = d.data();
      if (value && value.title) {
        resultList.push({
          id: d.id,
          title: value.title,
          image: value.image || '',
          category: value.category || 'مسلسلات',
          rating: value.rating || 9.0,
          episodes: Array.isArray(value.episodes) ? value.episodes : [],
          trailer: value.trailer || '',
          url: value.url || ''
        } as Series);
      }
    });
  } catch (e) {
    console.warn("Failed fetching custom_series from Firestore:", e);
  }

  return resultList;
}

// Top Series Order Online Sync (Realtime Database + Firestore dual channel)
export async function saveTopSeriesOrder(items: TopSeriesItem[]): Promise<boolean> {
  const cleanList = items.map((item, index) => ({
    id: item.id || `top_${index}_${item.title.replace(/[^a-zA-Z0-9]/g, '_')}`,
    title: item.title,
    image: item.image || '',
    category: item.category || 'مسلسلات',
    url: item.url || '',
    rank: index + 1
  }));

  let saved = false;

  // Channel 1: Firestore
  try {
    await setDoc(doc(firestore, 'shorts', 'top_series_order'), {
      updatedAt: Date.now(),
      items: cleanList
    });
    saved = true;
  } catch (e) {
    console.warn("Firestore saveTopSeriesOrder error:", e);
  }

  // Channel 2: Realtime Database
  try {
    await set(ref(db, 'top_series_order'), cleanList);
    saved = true;
  } catch (e) {
    console.warn("RTDB saveTopSeriesOrder error:", e);
  }

  return saved;
}

export function subscribeTopSeriesOrder(callback: (items: TopSeriesItem[]) => void): () => void {
  // 1. Try Firestore snapshot
  const unsubFs = onSnapshot(doc(firestore, 'shorts', 'top_series_order'), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (Array.isArray(data.items)) {
        callback(data.items);
        return;
      }
    }
  }, (err) => {
    console.warn("Firestore top series sub error:", err);
  });

  // 2. Try Realtime DB fallback
  const unsubRtdb = onValue(ref(db, 'top_series_order'), (snap) => {
    const val = snap.val();
    if (Array.isArray(val)) {
      callback(val);
    } else if (val && typeof val === 'object') {
      const list = Object.values(val) as TopSeriesItem[];
      list.sort((a, b) => (a.rank || 0) - (b.rank || 0));
      callback(list);
    }
  }, (err) => {
    console.warn("RTDB top series sub error:", err);
  });

  return () => {
    unsubFs();
    unsubRtdb();
  };
}

