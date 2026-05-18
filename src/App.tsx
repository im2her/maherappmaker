import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { Landing } from './components/Landing';
import { MainApp } from './components/MainApp';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RefreshCw, RotateCcw } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeProfile: () => void;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setConnectionError(null);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }

      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        
        // Use onSnapshot for real-time profile updates (balance, message counts)
        unsubscribeProfile = onSnapshot(userRef, (userSnap) => {
          if (userSnap.exists()) {
            setUserProfile(userSnap.data());
          } else {
            setUserProfile(null);
          }
          setLoading(false);
          setConnectionError(null);
        }, (error) => {
          console.error("Firestore Error details:", {
            uid: currentUser.uid,
            error: error.message,
            code: (error as any).code
          });
          
          if (error.message.includes('unavailable') || error.message.includes('Could not reach')) {
            setConnectionError("تعذر الاتصال بقاعدة البيانات. يرجى التحقق من اتصالك بالإنترنت أو إعادة المحاولة.");
          }
          
          setLoading(false);
        });
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  if (connectionError && !userProfile) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl max-w-md w-full">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <RefreshCw className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-white mb-4">مشكلة في الاتصال</h2>
          <p className="text-zinc-400 mb-8 leading-relaxed">{connectionError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-gold-500 hover:bg-gold-400 text-zinc-950 font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            <span>إعادة المحاولة</span>
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-gold-500 animate-spin"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {user && userProfile ? (
        <MainApp user={user} userProfile={userProfile} />
      ) : (
        <Landing onLogin={() => {}} />
      )}
    </ErrorBoundary>
  );
}
