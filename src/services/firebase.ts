import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, onValue, remove } from 'firebase/database';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
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
export const storage = getStorage(app);

export interface Episode {
  title: string;
  link1: string;
  link2?: string;
  link3?: string;
  url?: string;
  isFinal?: boolean;
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
  latestEpisode?: string;
  isFinal?: boolean;
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

// ----------------- Featured Slider Series (Firebase Sync) -----------------
export interface SliderSeriesItem {
  id: string;
  title: string;
  image?: string;
  originalImage?: string;
  category?: string;
  rating?: number;
  trailer?: string;
  url?: string;
  episodes_count?: string;
  rank?: number;
}

export interface SliderImageOverrides {
  [key: string]: string; // seriesId or title -> image URL
}

export async function saveSliderSeries(items: SliderSeriesItem[]): Promise<boolean> {
  const cleanList = items.map((item, index) => ({
    id: item.id || `slider_${index}_${(item.title || 'item').replace(/[^a-zA-Z0-9]/g, '_')}`,
    title: item.title || '',
    image: item.image || '',
    originalImage: item.originalImage || item.image || '',
    category: item.category || 'مسلسلات',
    rating: item.rating || 8.5,
    trailer: item.trailer || '',
    url: item.url || '',
    episodes_count: item.episodes_count || '',
    rank: index + 1
  }));

  // Also build overrides mapping
  const overrides: SliderImageOverrides = {};
  cleanList.forEach(item => {
    if (item.image) {
      if (item.id) overrides[item.id] = item.image;
      if (item.title) overrides[item.title] = item.image;
    }
  });

  let saved = false;

  // Channel 1: Firestore
  try {
    await setDoc(doc(firestore, 'shorts', 'featured_slider_series'), {
      updatedAt: Date.now(),
      items: cleanList
    });
    if (Object.keys(overrides).length > 0) {
      await setDoc(doc(firestore, 'shorts', 'slider_image_overrides'), {
        updatedAt: Date.now(),
        overrides
      });
    }
    saved = true;
  } catch (e) {
    console.warn("Firestore saveSliderSeries error:", e);
  }

  // Channel 2: Realtime Database
  try {
    await set(ref(db, 'featured_slider_series'), cleanList);
    if (Object.keys(overrides).length > 0) {
      await set(ref(db, 'slider_image_overrides'), overrides);
    }
    saved = true;
  } catch (e) {
    console.warn("RTDB saveSliderSeries error:", e);
  }

  return saved;
}

export function subscribeSliderSeries(callback: (items: SliderSeriesItem[]) => void): () => void {
  // 1. Try Firestore snapshot
  const unsubFs = onSnapshot(doc(firestore, 'shorts', 'featured_slider_series'), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (Array.isArray(data.items)) {
        callback(data.items);
        return;
      }
    }
  }, (err) => {
    console.warn("Firestore slider series sub error:", err);
  });

  // 2. Try Realtime DB fallback
  const unsubRtdb = onValue(ref(db, 'featured_slider_series'), (snap) => {
    const val = snap.val();
    if (Array.isArray(val)) {
      callback(val);
    } else if (val && typeof val === 'object') {
      const list = Object.values(val) as SliderSeriesItem[];
      list.sort((a, b) => (a.rank || 0) - (b.rank || 0));
      callback(list);
    }
  }, (err) => {
    console.warn("RTDB slider series sub error:", err);
  });

  return () => {
    unsubFs();
    unsubRtdb();
  };
}

export async function saveSliderImageOverrides(overrides: SliderImageOverrides): Promise<boolean> {
  let saved = false;
  try {
    await setDoc(doc(firestore, 'shorts', 'slider_image_overrides'), {
      updatedAt: Date.now(),
      overrides
    });
    saved = true;
  } catch (e) {
    console.warn("Firestore saveSliderImageOverrides error:", e);
  }

  try {
    await set(ref(db, 'slider_image_overrides'), overrides);
    saved = true;
  } catch (e) {
    console.warn("RTDB saveSliderImageOverrides error:", e);
  }
  return saved;
}

export function subscribeSliderImageOverrides(callback: (overrides: SliderImageOverrides) => void): () => void {
  const unsubFs = onSnapshot(doc(firestore, 'shorts', 'slider_image_overrides'), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && data.overrides && typeof data.overrides === 'object') {
        callback(data.overrides);
        return;
      }
    }
  }, (err) => {
    console.warn("Firestore slider overrides sub error:", err);
  });

  const unsubRtdb = onValue(ref(db, 'slider_image_overrides'), (snap) => {
    const val = snap.val();
    if (val && typeof val === 'object') {
      callback(val);
    }
  }, (err) => {
    console.warn("RTDB slider overrides sub error:", err);
  });

  return () => {
    unsubFs();
    unsubRtdb();
  };
}

// ==========================================
// Hakeem AI Chat Sessions (Firebase Storage)
// Zero server hosting resources consumed!
// ==========================================

export interface HakeemMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  fileUrls?: string[];
  image?: string;
  audio?: boolean;
}

export interface HakeemSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: HakeemMessage[];
}

export async function saveHakeemSession(userId: string, session: HakeemSession): Promise<boolean> {
  if (!userId || !session || !session.id) return false;
  let saved = false;

  // 1. Save directly to RTDB for immediate sync
  try {
    const sessionRef = ref(db, `hakeem_sessions/${userId}/${session.id}`);
    await set(sessionRef, {
      ...session,
      updatedAt: Date.now()
    });
    saved = true;
  } catch (err: any) {
    console.warn("RTDB saveHakeemSession error:", err.message);
  }

  // 2. Backup to Firestore
  try {
    const docRef = doc(firestore, 'hakeem_sessions', `${userId}_${session.id}`);
    await setDoc(docRef, {
      ...session,
      userId,
      updatedAt: Date.now()
    });
    saved = true;
  } catch (err: any) {
    console.warn("Firestore saveHakeemSession error:", err.message);
  }

  return saved;
}

export async function getUserHakeemSessions(userId: string): Promise<HakeemSession[]> {
  if (!userId) return [];

  // Try RTDB first
  try {
    const snap = await get(ref(db, `hakeem_sessions/${userId}`));
    if (snap.exists()) {
      const val = snap.val();
      const sessions: HakeemSession[] = Object.values(val || {});
      sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      return sessions;
    }
  } catch (err: any) {
    console.warn("RTDB getUserHakeemSessions error:", err.message);
  }

  // Fallback to Firestore
  try {
    const collRef = collection(firestore, 'hakeem_sessions');
    const snap = await getDocs(collRef);
    const sessions: HakeemSession[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      if (data && data.userId === userId) {
        sessions.push(data as HakeemSession);
      }
    });
    sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return sessions;
  } catch (err: any) {
    console.warn("Firestore getUserHakeemSessions error:", err.message);
  }

  return [];
}

export async function deleteHakeemSession(userId: string, sessionId: string): Promise<boolean> {
  if (!userId || !sessionId) return false;
  let removed = false;

  try {
    await remove(ref(db, `hakeem_sessions/${userId}/${sessionId}`));
    removed = true;
  } catch (err: any) {
    console.warn("RTDB deleteHakeemSession error:", err.message);
  }

  try {
    await deleteDoc(doc(firestore, 'hakeem_sessions', `${userId}_${sessionId}`));
    removed = true;
  } catch (err: any) {
    console.warn("Firestore deleteHakeemSession error:", err.message);
  }

  return removed;
}

export function subscribeUserHakeemSessions(userId: string, callback: (sessions: HakeemSession[]) => void): () => void {
  if (!userId) return () => {};

  const rtdbRef = ref(db, `hakeem_sessions/${userId}`);
  const unsubRtdb = onValue(rtdbRef, (snap) => {
    if (snap.exists()) {
      const val = snap.val();
      const sessions: HakeemSession[] = Object.values(val || {});
      sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      callback(sessions);
    } else {
      callback([]);
    }
  }, (err) => {
    console.warn("RTDB subscribeUserHakeemSessions error:", err.message);
  });

  return () => {
    unsubRtdb();
  };
}



