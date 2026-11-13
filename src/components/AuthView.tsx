import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import type { CountryCode } from 'libphonenumber-js';
import {
  ArrowLeft,
  Phone,
  Mail,
  Loader2,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Camera,
  AtSign,
  Eye,
  EyeOff,
} from 'lucide-react';
import { auth, firebaseConfig } from '../lib/firebase';
import { ChitChatLogo } from './ChitChatLogo';
import { CountryPhoneInput } from './CountryPhoneInput';
import { detectDefaultCountry, validateAndNormalizePhone } from '../utils/phone';
import { compressImageFile, uploadFileToStorage } from '../utils/media';
import {
  createCompleteUserProfile,
  isValidUsernameFormat,
  normalizeUsername,
} from '../services/chitchatDb';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

type AuthTab = 'phone' | 'google' | 'email';

interface AuthViewProps {
  initialTab?: AuthTab;
  onBackToLanding: () => void;
  firebaseUser: User | null;
  needsProfileSetup: boolean;
  onProfileCreated: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  initialTab = 'phone',
  onBackToLanding,
  firebaseUser,
  needsProfileSetup,
  onProfileCreated,
}) => {
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Phone + OTP state
  const [country, setCountry] = useState<CountryCode>(() => detectDefaultCountry());
  const [phoneInput, setPhoneInput] = useState('');
  const [e164Phone, setE164Phone] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendSeconds, setResendSeconds] = useState(0);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // Email + Password state
  const [emailMode, setEmailMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Onboarding Profile Setup state
  const [displayName, setDisplayName] = useState(firebaseUser?.displayName || '');
  const [username, setUsername] = useState('');
  const [about, setAbout] = useState('Hey there! I am using CHIT CHAT.');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(firebaseUser?.photoURL || '');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  useEffect(() => {
    if (firebaseUser) {
      if (firebaseUser.displayName && !displayName) setDisplayName(firebaseUser.displayName);
      if (firebaseUser.photoURL && !avatarPreview) setAvatarPreview(firebaseUser.photoURL);
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = window.setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSeconds]);

  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  const mapAuthError = (err: unknown): string => {
    const code = (err as { code?: string })?.code || '';
    const msg = err instanceof Error ? err.message : String(err);
    if (code === 'auth/operation-not-allowed') {
      return `This sign-in provider is not yet enabled in Firebase Console (Project: ${firebaseConfig.projectId}). Enable it under Authentication > Sign-in method.`;
    }
    if (code === 'auth/invalid-phone-number') return 'Please enter a valid international phone number.';
    if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait a few minutes before retrying.';
    if (code === 'auth/invalid-verification-code') return 'Incorrect 6-digit OTP. Please check the SMS code and try again.';
    if (code === 'auth/code-expired') return 'Your OTP code expired. Tap Resend OTP to receive a new code.';
    if (code === 'auth/popup-closed-by-user') return 'Sign-in popup was closed before completing.';
    if (code === 'auth/account-exists-with-different-credential') {
      return 'An account already exists with this email under another sign-in method. Sign in with that method first, then link accounts in Settings.';
    }
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return 'Incorrect email or password.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'An account with this email already exists. Switch to Login instead.';
    }
    if (code === 'auth/weak-password') {
      return 'Password must be at least 6 characters long.';
    }
    return msg;
  };

  const getOrCreateRecaptcha = () => {
    if (!recaptchaContainerRef.current) return null;
    if (recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current.clear();
      recaptchaVerifierRef.current = null;
    }
    const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
      size: 'invisible',
    });
    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setInfoMsg(null);
    const check = validateAndNormalizePhone(phoneInput, country);
    if (!check.valid || !check.e164) {
      setError(check.error || 'Invalid phone number.');
      return;
    }

    setBusy(true);
    try {
      const verifier = getOrCreateRecaptcha();
      if (!verifier) throw new Error('reCAPTCHA container failed to mount.');
      const result = await signInWithPhoneNumber(auth, check.e164, verifier);
      setE164Phone(check.e164);
      setConfirmationResult(result);
      setOtpDigits(['', '', '', '', '', '']);
      setResendSeconds(60);
      setInfoMsg(`Verification code sent to ${check.formatted || check.e164}`);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (codeOverride?: string) => {
    if (!confirmationResult) return;
    const code = codeOverride || otpDigits.join('');
    if (code.length !== 6) {
      setError('Enter the complete 6-digit verification code.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await confirmationResult.confirm(code);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleOtpBoxChange = (idx: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (clean.length > 1) {
      // Paste support
      const sliced = clean.slice(0, 6).split('');
      const next = ['', '', '', '', '', ''];
      sliced.forEach((d, i) => {
        next[i] = d;
      });
      setOtpDigits(next);
      const focusIdx = Math.min(sliced.length, 5);
      otpRefs.current[focusIdx]?.focus();
      if (sliced.length === 6) {
        handleVerifyOtp(next.join(''));
      }
      return;
    }
    const next = [...otpDigits];
    next[idx] = clean;
    setOtpDigits(next);
    if (clean && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
    }
    if (next.every((d) => d.length === 1)) {
      handleVerifyOtp(next.join(''));
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setError(null);
    setInfoMsg(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    if (emailMode === 'reset') {
      setBusy(true);
      try {
        await sendPasswordResetEmail(auth, trimmedEmail);
        setInfoMsg('Password reset link sent to your email.');
        setEmailMode('login');
      } catch (err) {
        setError(mapAuthError(err));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (emailMode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      if (emailMode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        await sendEmailVerification(cred.user);
        setInfoMsg('Verification email sent! Please verify your inbox to continue.');
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  // Real-time username availability check for onboarding
  useEffect(() => {
    if (!needsProfileSetup) return;
    const clean = normalizeUsername(username);
    if (!isValidUsernameFormat(clean)) {
      setUsernameAvailable(null);
      return;
    }
    let cancelled = false;
    setCheckingUsername(true);
    const timer = window.setTimeout(async () => {
      try {
        const snap = await getDoc(doc(db, 'usernames', clean));
        if (!cancelled) {
          setUsernameAvailable(!snap.exists());
        }
      } catch {
        if (!cancelled) setUsernameAvailable(null);
      } finally {
        if (!cancelled) setCheckingUsername(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, needsProfileSetup]);

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setError(null);
    const cleanUser = normalizeUsername(username);
    if (!isValidUsernameFormat(cleanUser)) {
      setError('Username must be 3–24 lowercase letters, numbers, or underscores.');
      return;
    }
    if (!displayName.trim()) {
      setError('Please enter your display name.');
      return;
    }

    setBusy(true);
    try {
      let photoURL = firebaseUser.photoURL || undefined;
      if (avatarFile) {
        const compressed = await compressImageFile(avatarFile, 512, 0.85);
        photoURL = await uploadFileToStorage(
          `avatars/${firebaseUser.uid}/profile_${Date.now()}.webp`,
          compressed
        );
      }
      await createCompleteUserProfile({
        uid: firebaseUser.uid,
        username: cleanUser,
        displayName: displayName.trim(),
        about: about.trim(),
        photoURL,
        email: firebaseUser.email || undefined,
        phoneE164: firebaseUser.phoneNumber || undefined,
      });
      onProfileCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile.');
    } finally {
      setBusy(false);
    }
  };

  // Case 1: Signed in via Email/Password but email is not verified yet
  const needsEmailVerification =
    firebaseUser &&
    !firebaseUser.phoneNumber &&
    firebaseUser.email &&
    !firebaseUser.emailVerified;

  if (needsEmailVerification && firebaseUser) {
    return (
      <div className="min-h-screen bg-[#F4FBF6] dark:bg-[#111B21] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#23323B] p-8 shadow-xl space-y-5 text-center">
          <div className="flex justify-center">
            <ChitChatLogo size="lg" />
          </div>
          <h2 className="font-display text-2xl font-bold text-[#111B21] dark:text-white">
            Verify your email address
          </h2>
          <p className="text-sm text-[#667781] dark:text-[#8696A0]">
            We sent a verification link to <strong className="text-[#111B21] dark:text-white">{firebaseUser.email}</strong>.
            Click the link in your inbox, then tap refresh below.
          </p>
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          {infoMsg && (
            <div className="rounded-xl bg-[#D9FDD3] dark:bg-[#005C4B] p-3 text-xs text-[#111B21] dark:text-white">
              {infoMsg}
            </div>
          )}
          <div className="space-y-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await firebaseUser.reload();
                  if (!auth.currentUser?.emailVerified) {
                    setError('Email is not verified yet. Please check your inbox or spam folder.');
                  } else {
                    window.location.reload();
                  }
                } finally {
                  setBusy(false);
                }
              }}
              className="w-full rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] font-semibold py-3 text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
              <span>I&apos;ve Verified — Continue</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await sendEmailVerification(firebaseUser);
                  setInfoMsg('Verification email resent!');
                } catch (err) {
                  setError(mapAuthError(err));
                } finally {
                  setBusy(false);
                }
              }}
              className="w-full rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] py-2.5 text-sm font-medium text-[#111B21] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              Resend Verification Email
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="text-xs text-[#667781] hover:underline pt-1 cursor-pointer"
            >
              Use another account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: First-time user profile & @username onboarding
  if (firebaseUser && needsProfileSetup) {
    return (
      <div className="min-h-screen bg-[#F4FBF6] dark:bg-[#111B21] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-3xl bg-white dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#23323B] p-7 sm:p-8 shadow-xl space-y-6"
        >
          <div className="flex items-center justify-between">
            <ChitChatLogo size="sm" />
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="text-xs text-[#667781] hover:text-[#111B21] dark:hover:text-white cursor-pointer"
            >
              Sign out
            </button>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-[#111B21] dark:text-white">
              Set up your CHIT CHAT profile
            </h2>
            <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-1">
              Choose a unique @username so friends can find and connect with you.
            </p>
          </div>

          <form onSubmit={handleCompleteOnboarding} className="space-y-4">
            {/* Avatar picker */}
            <div className="flex items-center gap-4">
              <label className="relative w-16 h-16 rounded-full bg-[#D9FDD3] dark:bg-[#005C4B] flex items-center justify-center overflow-hidden cursor-pointer border-2 border-[#25D366] shrink-0 group">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Profile avatar preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera className="w-6 h-6 text-[#128C7E] dark:text-[#25D366]" />
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setAvatarFile(file);
                      setAvatarPreview(URL.createObjectURL(file));
                    }
                  }}
                />
              </label>
              <div className="text-xs text-[#667781] dark:text-[#8696A0]">
                <p className="font-medium text-[#111B21] dark:text-white">Profile Photo</p>
                <p>Click the circle to upload a photo (optional).</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#667781] dark:text-[#8696A0] mb-1">
                Display Name
              </label>
              <input
                type="text"
                required
                maxLength={64}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-white dark:bg-[#202C33] px-4 py-2.5 text-sm text-[#111B21] dark:text-white focus:outline-none focus:border-[#25D366]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#667781] dark:text-[#8696A0] mb-1">
                Unique @username
              </label>
              <div className="relative">
                <AtSign className="w-4 h-4 text-[#667781] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  maxLength={24}
                  value={username}
                  onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                  placeholder="lowercase_handle"
                  className="w-full rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-white dark:bg-[#202C33] pl-9 pr-10 py-2.5 text-sm font-mono-nums text-[#111B21] dark:text-white focus:outline-none focus:border-[#25D366]"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingUsername && <Loader2 className="w-4 h-4 animate-spin text-[#667781]" />}
                  {!checkingUsername && usernameAvailable === true && (
                    <CheckCircle2 className="w-4 h-4 text-[#25D366]" />
                  )}
                  {!checkingUsername && usernameAvailable === false && (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>
              </div>
              <p className="text-[11px] mt-1 text-[#667781] dark:text-[#8696A0]">
                {usernameAvailable === false
                  ? 'That username is already taken.'
                  : usernameAvailable === true
                    ? `@${normalizeUsername(username)} is available!`
                    : '3–24 lowercase letters, numbers, or underscores.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#667781] dark:text-[#8696A0] mb-1">
                About
              </label>
              <input
                type="text"
                maxLength={200}
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Available on CHIT CHAT"
                className="w-full rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-white dark:bg-[#202C33] px-4 py-2.5 text-sm text-[#111B21] dark:text-white focus:outline-none focus:border-[#25D366]"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-xs text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || usernameAvailable === false}
              className="w-full rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] font-semibold py-3 text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Enter CHIT CHAT</span>
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // Case 3: Login / Register view
  return (
    <div className="min-h-screen bg-[#F4FBF6] dark:bg-[#111B21] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToLanding}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#667781] hover:text-[#111B21] dark:hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to CHIT CHAT</span>
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#23323B] p-7 sm:p-8 shadow-xl space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <ChitChatLogo size="lg" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[#111B21] dark:text-white">
            Sign in to CHIT CHAT
          </h1>
          <p className="text-xs text-[#667781] dark:text-[#8696A0]">
            Chat Freely. Stay Connected.
          </p>
        </div>

        {/* Auth Method Switcher (Phone Primary) */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#F4FBF6] dark:bg-[#202C33] border border-[#E7EDE9] dark:border-[#2A3942]">
          <button
            type="button"
            onClick={() => {
              setTab('phone');
              setError(null);
              setInfoMsg(null);
            }}
            className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              tab === 'phone'
                ? 'bg-white dark:bg-[#1A262E] text-[#128C7E] dark:text-[#25D366] shadow-xs'
                : 'text-[#667781] hover:text-[#111B21] dark:hover:text-white'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Phone</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('google');
              setError(null);
              setInfoMsg(null);
            }}
            className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              tab === 'google'
                ? 'bg-white dark:bg-[#1A262E] text-[#128C7E] dark:text-[#25D366] shadow-xs'
                : 'text-[#667781] hover:text-[#111B21] dark:hover:text-white'
            }`}
          >
            <span>Google</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('email');
              setError(null);
              setInfoMsg(null);
            }}
            className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              tab === 'email'
                ? 'bg-white dark:bg-[#1A262E] text-[#128C7E] dark:text-[#25D366] shadow-xs'
                : 'text-[#667781] hover:text-[#111B21] dark:hover:text-white'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email</span>
          </button>
        </div>

        {/* Invisible reCAPTCHA mount */}
        <div ref={recaptchaContainerRef} />

        <AnimatePresence mode="wait">
          {tab === 'phone' && (
            <motion.div
              key="tab-phone"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              {!confirmationResult ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <CountryPhoneInput
                    country={country}
                    onCountryChange={setCountry}
                    phoneInput={phoneInput}
                    onPhoneInputChange={setPhoneInput}
                    disabled={busy}
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] font-semibold py-3 text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                  >
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Send Verification Code</span>
                  </button>
                  <p className="text-[11px] text-center text-[#667781] dark:text-[#8696A0]">
                    Protected by Firebase reCAPTCHA. Standard SMS rates may apply.
                  </p>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#667781] dark:text-[#8696A0]">
                      Enter 6-digit code sent to <strong className="font-mono-nums text-[#111B21] dark:text-white">{e164Phone}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmationResult(null);
                        setOtpDigits(['', '', '', '', '', '']);
                        setError(null);
                      }}
                      className="text-[#128C7E] dark:text-[#25D366] font-medium hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  {/* 6 Separate OTP Boxes */}
                  <div className="grid grid-cols-6 gap-2">
                    {otpDigits.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          otpRefs.current[i] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={digit}
                        onChange={(e) => handleOtpBoxChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="h-12 w-full text-center text-lg font-mono-nums font-bold rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-[#F4FBF6] dark:bg-[#202C33] text-[#111B21] dark:text-white focus:outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/25 transition-all"
                        aria-label={`OTP digit ${i + 1}`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleVerifyOtp()}
                    className="w-full rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] font-semibold py-3 text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                  >
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Verify &amp; Continue</span>
                  </button>

                  <div className="text-center text-xs">
                    {resendSeconds > 0 ? (
                      <span className="text-[#667781] font-mono-nums">
                        Resend OTP in {resendSeconds}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSendOtp()}
                        className="text-[#128C7E] dark:text-[#25D366] font-medium hover:underline cursor-pointer"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {tab === 'google' && (
            <motion.div
              key="tab-google"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.18 }}
              className="space-y-4 py-2"
            >
              <p className="text-xs text-[#667781] dark:text-[#8696A0] text-center leading-relaxed">
                Sign in instantly with your Google account. Your display name and avatar sync
                automatically.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={handleGoogleSignIn}
                className="w-full rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-white dark:bg-[#202C33] hover:border-[#25D366] text-[#111B21] dark:text-white font-semibold py-3 px-4 text-sm flex items-center justify-center gap-3 transition-colors shadow-xs cursor-pointer disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                <span>Continue with Google</span>
              </button>
            </motion.div>
          )}

          {tab === 'email' && (
            <motion.div
              key="tab-email"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.18 }}
            >
              <form onSubmit={handleEmailSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#667781] dark:text-[#8696A0] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-white dark:bg-[#202C33] px-4 py-2.5 text-sm text-[#111B21] dark:text-white focus:outline-none focus:border-[#25D366]"
                  />
                </div>

                {emailMode !== 'reset' && (
                  <div>
                    <label className="block text-xs font-medium text-[#667781] dark:text-[#8696A0] mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-white dark:bg-[#202C33] px-4 pr-10 py-2.5 text-sm text-[#111B21] dark:text-white focus:outline-none focus:border-[#25D366]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667781] cursor-pointer"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {emailMode === 'register' && (
                  <div>
                    <label className="block text-xs font-medium text-[#667781] dark:text-[#8696A0] mb-1">
                      Confirm Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-white dark:bg-[#202C33] px-4 py-2.5 text-sm text-[#111B21] dark:text-white focus:outline-none focus:border-[#25D366]"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] font-semibold py-3 text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {emailMode === 'login'
                      ? 'Login with Email'
                      : emailMode === 'register'
                        ? 'Create Account'
                        : 'Send Reset Link'}
                  </span>
                </button>

                <div className="flex items-center justify-between text-xs pt-1 text-[#667781] dark:text-[#8696A0]">
                  <button
                    type="button"
                    onClick={() => setEmailMode(emailMode === 'login' ? 'register' : 'login')}
                    className="text-[#128C7E] dark:text-[#25D366] font-medium hover:underline cursor-pointer"
                  >
                    {emailMode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
                  </button>
                  {emailMode !== 'reset' && (
                    <button
                      type="button"
                      onClick={() => setEmailMode('reset')}
                      className="hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {infoMsg && (
          <div className="rounded-xl bg-[#D9FDD3] dark:bg-[#005C4B] p-3 text-xs text-[#111B21] dark:text-white flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#128C7E] dark:text-[#25D366]" />
            <span>{infoMsg}</span>
          </div>
        )}
      </motion.div>
    </div>
  );
};
