import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from './firebase';

export interface BanStatus {
  isBanned: boolean;
  reason?: string;
  duration?: 'temporary' | 'permanent';
  endsAt?: number;
}

const USER_ID_KEY = 'hek_user_id';

export const getOrCreateUserId = (): string => {
  let uid = localStorage.getItem(USER_ID_KEY);
  if (!uid) {
    // Check if guest profile uid exists from earlier sessions
    const oldGuestPid = localStorage.getItem('guest_chat_pid');
    uid = oldGuestPid || ('user_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
    localStorage.setItem(USER_ID_KEY, uid);
  }
  return uid;
};

export const checkBanStatus = async (uid?: string): Promise<BanStatus> => {
  const targetUid = uid || getOrCreateUserId();
  try {
    const docRef = doc(firestore, 'banned_users', targetUid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const now = Date.now();
      
      // If temporary block and expired, ignore it
      if (data.endsAt && now > data.endsAt) {
        return { isBanned: false };
      }
      
      return {
        isBanned: true,
        reason: data.reason || 'مخالفة معايير مجتمع حكايتنا أو إزعاج المستخدمين 🛡️',
        duration: data.duration || 'permanent',
        endsAt: data.endsAt || null
      };
    }
  } catch (err) {
    console.error("Failed to check if user is banned:", err);
  }
  return { isBanned: false };
};

export const reportComment = async (commentData: {
  commentId: string;
  commentText: string;
  authorName: string;
  authorId?: string;
  chatType: 'series' | 'match' | 'shorts';
  channelName: string;
  reporterName: string;
}) => {
  try {
    const reportId = `report_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const docRef = doc(firestore, 'reports', reportId);
    await setDoc(docRef, {
      ...commentData,
      reportedAt: Date.now(),
      status: 'pending'
    });
    return true;
  } catch (err) {
    console.error("Could not register report:", err);
    return false;
  }
};
