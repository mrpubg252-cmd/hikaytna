import { ref, set } from 'firebase/database';
import { db } from '../services/firebase';

export async function syncProfileToFirebase() {
  const userId = localStorage.getItem('guest_chat_pid');
  if (!userId || !db) return;

  const name = localStorage.getItem('guest_chat_name') || 'مستخدم جديد';
  const avatar = localStorage.getItem('user_avatar_url') || localStorage.getItem('guest_chat_avatar') || 'boy1';
  const avatarPosV = localStorage.getItem('user_avatar_pos_v') || '50';
  const avatarPosH = localStorage.getItem('user_avatar_pos_h') || '50';
  const avatarZoom = localStorage.getItem('user_avatar_zoom') || '100';
  const template = localStorage.getItem('user_profile_template') || '';

  try {
    await set(ref(db, `users/${userId}`), {
      userId,
      name,
      avatar,
      avatarPosV,
      avatarPosH,
      avatarZoom,
      template,
      lastActive: Date.now()
    });
    console.log('[PROFILE SYNC] Profile synced to Firebase successfully.');
  } catch (err) {
    console.error('[PROFILE SYNC] Sync failed:', err);
  }
}
