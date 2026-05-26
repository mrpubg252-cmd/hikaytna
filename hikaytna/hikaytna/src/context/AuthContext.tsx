import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { doc, getDoc, setDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface UserProfile {
  userId: string;
  email: string;
  points: number;
  isPremium: boolean;
  referralCode: string;
}

interface AuthContextType {
  user: any | null; // Clerk user
  profile: UserProfile | null;
  loading: boolean;
  checkReferral: (referrerId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerkAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (isLoaded && isSignedIn && user) {
        setLoading(true);
        try {
          const profileDoc = await getDoc(doc(db, 'users', user.id));
          if (profileDoc.exists()) {
            const data = profileDoc.data() as UserProfile;
            setProfile(data);
            
            // Auto-upgrade to premium if points >= 10
            if (data.points >= 10 && !data.isPremium) {
              await updateDoc(doc(db, 'users', user.id), { isPremium: true });
              setProfile({ ...data, isPremium: true });
            }
          } else {
            // Create new profile
            const newProfile: UserProfile = {
              userId: user.id,
              email: user.primaryEmailAddress?.emailAddress || '',
              points: 0,
              isPremium: false,
              referralCode: user.id.slice(-8), // Using last 8 chars of Clerk ID
            };
            await setDoc(doc(db, 'users', user.id), newProfile);
            setProfile(newProfile);
          }
        } catch (err) {
          console.error("Error fetching profile:", err);
        } finally {
          setLoading(false);
        }
      } else if (isLoaded && !isSignedIn) {
        setProfile(null);
        setLoading(false);
      }
    };

    fetchProfile();
  }, [isLoaded, isSignedIn, user]);

  const checkReferral = async (referrerId: string) => {
    if (!isSignedIn || !user || user.id === referrerId) return;

    const referralId = `${referrerId}_${user.id}`;
    const refDoc = await getDoc(doc(db, 'referrals', referralId));

    if (!refDoc.exists()) {
      // Create referral and increment points atomically
      try {
        const batch = writeBatch(db);
        
        // 1. Create referral record
        batch.set(doc(db, 'referrals', referralId), {
          referrerId,
          visitorId: user.id,
          createdAt: serverTimestamp(),
        });

        // 2. Increment referrer's points
        const referrerDoc = await getDoc(doc(db, 'users', referrerId));
        if (referrerDoc.exists()) {
          const rData = referrerDoc.data() as UserProfile;
          batch.update(doc(db, 'users', referrerId), {
            points: rData.points + 1
          });
          
          await batch.commit();
          console.log("Referral credited!");
        }
      } catch (err) {
        console.error("Referral failed:", err);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user: user || null, profile, loading: !isLoaded || loading, checkReferral }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
