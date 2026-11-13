import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, testFirestoreConnection } from './lib/firebase';
import type { UserPrivate, UserPublic } from './types/chitchat';
import { LandingPage } from './components/LandingPage';
import { AuthView } from './components/AuthView';
import { Dashboard } from './components/Dashboard';
import { OfflineIndicator } from './components/PWAInstallButton';
import { ChitChatLogo } from './components/ChitChatLogo';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F4FBF6] dark:bg-[#111B21] flex items-center justify-center p-6 text-center">
          <div className="max-w-md rounded-3xl bg-white dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#23323B] p-8 space-y-4 shadow-xl">
            <ChitChatLogo size="md" />
            <h2 className="font-display text-xl font-bold text-[#111B21] dark:text-white">
              Something went wrong
            </h2>
            <p className="text-xs text-[#667781] dark:text-[#8696A0] break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-[#25D366] text-[#111B21] font-semibold px-5 py-2.5 text-sm cursor-pointer"
            >
              Reload CHIT CHAT
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [publicProfile, setPublicProfile] = useState<UserPublic | null>(null);
  const [privateProfile, setPrivateProfile] = useState<UserPrivate | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'landing' | 'auth'>('landing');
  const [authInitialTab, setAuthInitialTab] = useState<'phone' | 'google' | 'email'>('phone');
  const [localTheme, setLocalTheme] = useState<'light' | 'dark'>(() =>
    localStorage.getItem('chitchat_theme') === 'dark' ? 'dark' : 'light'
  );

  // Validate Firestore connection on initial boot
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Auth listener
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setPublicProfile(null);
        setPrivateProfile(null);
        setProfileLoading(false);
      }
    });
  }, []);

  // Subscribe to user's public & private profiles once authenticated & verified
  const isVerified = Boolean(
    firebaseUser && (firebaseUser.emailVerified || (firebaseUser.phoneNumber && firebaseUser.phoneNumber.length > 0))
  );

  useEffect(() => {
    if (!firebaseUser || !isVerified) {
      setPublicProfile(null);
      setPrivateProfile(null);
      return;
    }

    setProfileLoading(true);
    const u1 = onSnapshot(doc(db, 'usersPublic', firebaseUser.uid), (snap) => {
      setPublicProfile(snap.exists() ? (snap.data() as UserPublic) : null);
      setProfileLoading(false);
    });
    const u2 = onSnapshot(doc(db, 'usersPrivate', firebaseUser.uid), (snap) => {
      setPrivateProfile(snap.exists() ? (snap.data() as UserPrivate) : null);
    });
    return () => {
      u1();
      u2();
    };
  }, [firebaseUser?.uid, isVerified]);

  // Apply light/dark/system theme class on <html>
  const effectiveTheme = (() => {
    const pref = privateProfile?.appearancePrefs?.theme;
    if (pref === 'dark') return 'dark';
    if (pref === 'light') return 'light';
    if (pref === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return localTheme;
  })();

  useEffect(() => {
    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [effectiveTheme]);

  const toggleLocalTheme = () => {
    const next = localTheme === 'dark' ? 'light' : 'dark';
    setLocalTheme(next);
    localStorage.setItem('chitchat_theme', next);
  };

  if (!authReady || (firebaseUser && isVerified && profileLoading)) {
    return (
      <div className="min-h-screen bg-[#F4FBF6] dark:bg-[#111B21] flex flex-col items-center justify-center gap-4">
        <ChitChatLogo size="lg" />
        <div className="w-40 h-1.5 rounded-full bg-[#E7EDE9] dark:bg-[#23323B] overflow-hidden">
          <div className="h-full w-1/2 bg-[#25D366] rounded-full animate-pulse" />
        </div>
        <p className="text-xs text-[#667781] dark:text-[#8696A0]">Loading CHIT CHAT...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {firebaseUser && isVerified && publicProfile ? (
        <Dashboard currentUser={publicProfile} privateData={privateProfile} />
      ) : firebaseUser ? (
        <AuthView
          firebaseUser={firebaseUser}
          needsProfileSetup={isVerified && !publicProfile}
          onBackToLanding={() => setViewMode('landing')}
          onProfileCreated={() => {}}
        />
      ) : viewMode === 'auth' ? (
        <AuthView
          initialTab={authInitialTab}
          firebaseUser={null}
          needsProfileSetup={false}
          onBackToLanding={() => setViewMode('landing')}
          onProfileCreated={() => {}}
        />
      ) : (
        <LandingPage
          theme={effectiveTheme}
          onToggleTheme={toggleLocalTheme}
          onStartChatting={(mode = 'phone') => {
            setAuthInitialTab(mode);
            setViewMode('auth');
          }}
          onLogin={() => {
            setAuthInitialTab('phone');
            setViewMode('auth');
          }}
        />
      )}
      <OfflineIndicator />
    </ErrorBoundary>
  );
}
