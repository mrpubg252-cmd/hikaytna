import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import appletConfig from "../../firebase-applet-config.json";

const app = initializeApp(appletConfig);
export const db = getFirestore(app, appletConfig.firestoreDatabaseId);
