import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Use a named app to avoid conflict with the existing [DEFAULT] app used for data
const app = getApps().find(a => a.name === 'warm-imagery') || initializeApp(firebaseConfig, 'warm-imagery');

export const db = getFirestore(app);
export const auth = getAuth(app);
