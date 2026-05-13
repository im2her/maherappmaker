import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { Landing } from './components/Landing';
import { MainApp } from './components/MainApp';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        
        // Use onSnapshot for real-time profile updates (balance, message counts)
        const unsubscribeProfile = onSnapshot(userRef, async (userSnap) => {
          try {
            if (userSnap.exists()) {
              setUserProfile(userSnap.data());
            } else {
              const newProfile = {
                email: currentUser.email || currentUser.phoneNumber || 'unknown',
                plan: 'free',
                messageCount: 0,
                monthlyMessageCount: 0,
                lastMessageReset: serverTimestamp(),
                subscriptionCount: 0,
                totalMessages: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              };
              await setDoc(userRef, newProfile);
              setUserProfile(newProfile);
            }
            setLoading(false);
          } catch (err: any) {
            console.error("Error creating/updating user profile:", err);
            setLoading(false);
          }
        }, (error) => {
          console.error("Firestore Permission Error details:", {
            uid: currentUser.uid,
            email: currentUser.email,
            phone: currentUser.phoneNumber,
            error: error.message,
            code: (error as any).code
          });
          setLoading(false);
        });

        return () => unsubscribeProfile();
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-gold-500 animate-spin"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {user ? (
        <MainApp user={user} userProfile={userProfile} />
      ) : (
        <Landing onLogin={() => {}} />
      )}
    </ErrorBoundary>
  );
}
