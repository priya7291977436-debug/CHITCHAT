import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  MessageSquare,
  ShieldCheck,
  Mic,
  Video,
  Users,
  Smile,
  Image as ImageIcon,
  Globe,
  Smartphone,
  ArrowRight,
  Lock,
  CheckCheck,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import { ChitChatLogo } from './ChitChatLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface LandingPageProps {
  onStartChatting: (mode?: 'phone' | 'google' | 'email') => void;
  onLogin: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

type LegalModalType = 'about' | 'privacy' | 'terms' | 'help' | 'contact' | null;

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartChatting,
  onLogin,
  theme,
  onToggleTheme,
}) => {
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);

  const capabilities = [
    {
      num: '01',
      title: 'Real-Time Messaging',
      desc: 'Instant text, replies, edits, reactions, starred notes, pinned threads, and live delivery & read ticks.',
      icon: MessageSquare,
    },
    {
      num: '02',
      title: 'Private Conversations',
      desc: 'Username-only discovery with zero public user directories, optional chat locks, and granular visibility controls.',
      icon: Lock,
    },
    {
      num: '03',
      title: 'Voice Messages',
      desc: 'Studio-clean voice notes with live audio-driven waveforms, pause/resume recording, 1x–2x playback, and AI transcription.',
      icon: Mic,
    },
    {
      num: '04',
      title: 'Audio & Video Calls',
      desc: 'Real WebRTC voice and HD video calls with camera switching, fullscreen, picture-in-picture, and group calling.',
      icon: Video,
    },
    {
      num: '05',
      title: 'Groups & Communities',
      desc: 'Organize friend groups, polls, announcements, public or private channels, communities, and broadcast lists.',
      icon: Users,
    },
    {
      num: '06',
      title: 'GIFs & Stickers',
      desc: 'Rich emoji skin tones, live Tenor/GIPHY animated GIF search, built-in sticker packs, and custom sticker uploads.',
      icon: Smile,
    },
    {
      num: '07',
      title: 'Photo & Video Sharing',
      desc: 'Share compressed photos, HD videos, PDFs, DOCX, spreadsheets, live locations, and contact cards effortlessly.',
      icon: ImageIcon,
    },
    {
      num: '08',
      title: 'Global Communication',
      desc: 'Sign up with phone verification across 240+ countries and translate incoming messages into your preferred language.',
      icon: Globe,
    },
  ];

  const legalContent: Record<Exclude<LegalModalType, null>, { title: string; body: string[] }> = {
    about: {
      title: 'About CHIT CHAT',
      body: [
        'CHIT CHAT is a real-time global messaging, voice, video, and community platform designed around clarity, speed, and user-owned privacy.',
        'Every new workspace starts completely clean—without pre-seeded bots or public directories. Connect solely with people you approve via unique @usernames or QR codes.',
      ],
    },
    privacy: {
      title: 'Privacy & Data Protection',
      body: [
        'Phone numbers and email addresses are stored in owner-only private records and are never exposed in public profiles or username search results.',
        'You control who can see your Last Seen, Online Status, Profile Photo, About bio, Status updates, Read Receipts, and Typing indicators.',
        'Database and file access are enforced by Firebase Authentication, Firestore Security Rules, and Firebase Storage Rules.',
      ],
    },
    terms: {
      title: 'Terms of Service',
      body: [
        'By creating a CHIT CHAT account, you agree to communicate respectfully and refrain from spam, harassment, or automated scraping.',
        'Built-in reporting and blocking tools let any member report abusive users, messages, or groups directly to platform moderators.',
      ],
    },
    help: {
      title: 'CHIT CHAT Help Center',
      body: [
        'Adding Friends: Click the green Add People (+) button in the dashboard, enter your friend’s exact lowercase @username, or scan their QR code.',
        'Voice & Video Calls: Allow camera and microphone permissions in your browser when starting or answering a WebRTC call.',
        'Installing as an App: Click Install CHIT CHAT in the navigation or settings menu to run CHIT CHAT as a standalone desktop or mobile PWA.',
      ],
    },
    contact: {
      title: 'Contact CHIT CHAT',
      body: [
        'Need assistance with account recovery, moderation reports, or enterprise communities?',
        'Reach our support team anytime at support@chitchat.app or submit a direct report inside your chat menu.',
      ],
    },
  };

  return (
    <div className="min-h-screen bg-[#F4FBF6] dark:bg-[#111B21] text-[#111B21] dark:text-[#E9EDEF] flex flex-col">
      {/* Top Navigation (Single Row, Clean Zones) */}
      <header className="sticky top-0 z-40 bg-[#F4FBF6]/90 dark:bg-[#111B21]/90 backdrop-blur-md border-b border-[#E7EDE9] dark:border-[#23323B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          <a href="#home" className="shrink-0">
            <ChitChatLogo size="md" />
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#667781] dark:text-[#8696A0]">
            <a href="#home" className="hover:text-[#111B21] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Home
            </a>
            <a href="#features" className="hover:text-[#111B21] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Features
            </a>
            <a href="#about" className="hover:text-[#111B21] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              About
            </a>
            <a href="#privacy" className="hover:text-[#111B21] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Privacy
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-lg text-[#667781] dark:text-[#8696A0] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onLogin}
              className="text-sm font-medium text-[#111B21] dark:text-[#E9EDEF] hover:text-[#128C7E] dark:hover:text-[#25D366] px-3 py-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => onStartChatting('phone')}
              className="rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] font-semibold text-sm px-4 py-2 transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="home" className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 space-y-6"
          >
            <p className="text-sm font-semibold tracking-wide text-[#128C7E] dark:text-[#25D366]">
              Chat Freely. Stay Connected.
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.08] text-[#111B21] dark:text-white [text-wrap:balance]">
              Your Conversations. Your World.
            </h1>
            <p className="text-base sm:text-lg text-[#667781] dark:text-[#8696A0] max-w-xl leading-relaxed">
              Connect, chat, share and stay close to the people who matter. Real-time messaging,
              crystal-clear voice notes, HD WebRTC calls, and private communities—built in a calm,
              distraction-free workspace.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onStartChatting('phone')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] font-semibold px-6 py-3.5 text-sm shadow-sm transition-transform active:scale-[0.98] whitespace-nowrap cursor-pointer"
              >
                <span>Start Chatting</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onLogin}
                className="inline-flex items-center gap-2 rounded-xl border border-[#E7EDE9] dark:border-[#23323B] bg-white dark:bg-[#1A262E] hover:border-[#128C7E] text-[#111B21] dark:text-white font-medium px-6 py-3.5 text-sm transition-colors whitespace-nowrap cursor-pointer"
              >
                Login
              </button>
              <PWAInstallButton />
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#667781] dark:text-[#8696A0]">
              <span>240+ countries supported</span>
              <span aria-hidden="true">·</span>
              <span>Phone OTP, Google & Email login</span>
              <span aria-hidden="true">·</span>
              <span>Zero public directories</span>
            </div>
          </motion.div>

          {/* Animated Messaging Interface Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 relative"
          >
            <div className="relative rounded-3xl overflow-hidden border border-[#E7EDE9] dark:border-[#23323B] bg-white dark:bg-[#1A262E] shadow-xl">
              <div className="aspect-[16/10] w-full overflow-hidden relative bg-[#E7EDE9] dark:bg-[#202C33]">
                <img
                  src="/src/assets/images/chitchat_hero_showcase_1794581892072.jpg"
                  alt="CHIT CHAT desktop and mobile workspace"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#111B21]/75 via-[#111B21]/15 to-transparent" />
              </div>

              {/* Floating Animated Conversation Card Overlay */}
              <div className="p-5 sm:p-6 bg-white dark:bg-[#1A262E] border-t border-[#E7EDE9] dark:border-[#23323B] space-y-3">
                <div className="flex items-center justify-between text-xs text-[#667781] dark:text-[#8696A0]">
                  <span className="font-medium text-[#111B21] dark:text-white">Live Conversation Preview</span>
                  <span className="font-mono-nums">HD Voice · Real-Time Sync</span>
                </div>

                <div className="space-y-2.5">
                  <motion.div
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35, duration: 0.3 }}
                    className="max-w-[82%] rounded-2xl rounded-tl-sm bg-[#F4FBF6] dark:bg-[#202C33] border border-[#E7EDE9] dark:border-[#2A3942] px-4 py-2.5 text-sm text-[#111B21] dark:text-[#E9EDEF]"
                  >
                    <p>Hey! Just landed in Tokyo—are we still on for the group video call tonight?</p>
                    <span className="block text-[11px] text-[#667781] dark:text-[#8696A0] mt-1 font-mono-nums">
                      09:41 AM
                    </span>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.55, duration: 0.3 }}
                    className="ml-auto max-w-[82%] rounded-2xl rounded-tr-sm bg-[#D9FDD3] dark:bg-[#005C4B] px-4 py-2.5 text-sm text-[#111B21] dark:text-white"
                  >
                    <p>Yes! Sending the voice memo from the studio now—see everyone at 8 PM.</p>
                    <div className="flex items-center justify-end gap-1.5 mt-1 text-[11px] text-[#128C7E] dark:text-[#A3E4D7] font-mono-nums">
                      <span>09:42 AM</span>
                      <CheckCheck className="w-3.5 h-3.5 text-[#25D366]" />
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Core Capabilities Section */}
      <section id="features" className="py-20 bg-white dark:bg-[#0B141A] border-y border-[#E7EDE9] dark:border-[#23323B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-14 space-y-3">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#111B21] dark:text-white [text-wrap:balance]">
              Built for every conversation, everywhere.
            </h2>
            <p className="text-[#667781] dark:text-[#8696A0] text-base leading-relaxed">
              Every tool you expect from a flagship desktop messenger—combined with global phone
              verification, live translation, and instant multi-device sync.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {capabilities.map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.num}
                  className="rounded-2xl border border-[#E7EDE9] dark:border-[#23323B] bg-[#F4FBF6]/60 dark:bg-[#111B21] p-6 flex flex-col justify-between transition-colors hover:border-[#25D366]"
                >
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <span className="font-mono-nums text-xs font-semibold text-[#128C7E] dark:text-[#25D366]">
                        {cap.num}
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-[#D9FDD3] dark:bg-[#128C7E]/20 flex items-center justify-center text-[#128C7E] dark:text-[#25D366]">
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>
                    <h3 className="font-display text-lg font-semibold text-[#111B21] dark:text-white mb-2">
                      {cap.title}
                    </h3>
                    <p className="text-sm text-[#667781] dark:text-[#8696A0] leading-relaxed">
                      {cap.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* About & Global Communication + Privacy Split */}
      <section id="about" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
          {/* Global Communication & Communities */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 rounded-3xl overflow-hidden border border-[#E7EDE9] dark:border-[#23323B] bg-white dark:bg-[#1A262E]">
              <img
                src="/src/assets/images/chitchat_global_connect_1794581892101.jpg"
                alt="People staying connected globally on CHIT CHAT"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover min-h-[280px]"
              />
            </div>
            <div className="lg:col-span-6 flex flex-col justify-center space-y-5 p-2 sm:p-6">
              <span className="text-xs font-semibold tracking-wider text-[#128C7E] dark:text-[#25D366]">
                Global Communication
              </span>
              <h2 className="font-display text-3xl font-bold text-[#111B21] dark:text-white [text-wrap:balance]">
                Zero noise. Only the people and communities you choose.
              </h2>
              <p className="text-[#667781] dark:text-[#8696A0] leading-relaxed">
                New accounts always begin with an empty, calm workspace. No pre-seeded chats, no
                suggested strangers, and no exposed phone numbers. Find friends solely by their
                exact lowercase <code className="font-mono-nums text-[#128C7E] dark:text-[#25D366]">@username</code> or QR code.
              </p>
              <div className="grid grid-cols-2 gap-6 pt-3 border-t border-[#E7EDE9] dark:border-[#23323B]">
                <div>
                  <p className="font-display text-2xl font-bold text-[#111B21] dark:text-white font-mono-nums">
                    240+
                  </p>
                  <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                    Countries &amp; territories validated via E.164
                  </p>
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-[#111B21] dark:text-white font-mono-nums">
                    24h
                  </p>
                  <p className="text-xs text-[#667781] dark:text-[#8696A0] mt-0.5">
                    Ephemeral friend-only Status updates
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Privacy & Security + Mobile Experience */}
          <div id="privacy" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-7 rounded-3xl border border-[#E7EDE9] dark:border-[#23323B] bg-white dark:bg-[#1A262E] overflow-hidden flex flex-col sm:flex-row">
              <div className="sm:w-1/2 min-h-[240px]">
                <img
                  src="/src/assets/images/chitchat_privacy_shield_1794581890972.jpg"
                  alt="CHIT CHAT privacy and security architecture"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="sm:w-1/2 p-7 flex flex-col justify-center space-y-4">
                <div className="w-10 h-10 rounded-xl bg-[#D9FDD3] dark:bg-[#128C7E]/20 flex items-center justify-center text-[#128C7E] dark:text-[#25D366]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-display text-2xl font-bold text-[#111B21] dark:text-white">
                  Privacy &amp; Security First
                </h3>
                <p className="text-sm text-[#667781] dark:text-[#8696A0] leading-relaxed">
                  Your phone number and email remain strictly isolated in owner-only records.
                  Configure Last Seen, Online Status, Profile Photo, Read Receipts, Two-Step PIN, and
                  Chat Locking anytime.
                </p>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-3xl border border-[#E7EDE9] dark:border-[#23323B] bg-white dark:bg-[#1A262E] overflow-hidden flex flex-col sm:flex-row lg:flex-col">
              <div className="h-52 sm:w-2/5 lg:w-full lg:h-48 overflow-hidden">
                <img
                  src="/src/assets/images/chitchat_mobile_preview_1794581892922.jpg"
                  alt="CHIT CHAT mobile progressive web app"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-7 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#128C7E] dark:text-[#25D366] mb-2">
                    <Smartphone className="w-4 h-4" />
                    <span>Installable Mobile &amp; Desktop PWA</span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#111B21] dark:text-white">
                    Fast on every screen.
                  </h3>
                  <p className="text-sm text-[#667781] dark:text-[#8696A0] mt-1.5 leading-relaxed">
                    Works seamlessly across Windows, macOS, Linux, iOS, and Android with offline shell
                    caching and native-like navigation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onStartChatting('phone')}
                  className="w-full rounded-xl bg-[#111B21] dark:bg-[#25D366] text-white dark:text-[#111B21] font-semibold text-sm py-3 hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Launch CHIT CHAT
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#E7EDE9] dark:border-[#23323B] bg-white dark:bg-[#0B141A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <ChitChatLogo size="sm" />
            <p className="text-xs text-[#667781] dark:text-[#8696A0]">
              Chat Freely. Stay Connected. · © {new Date().getFullYear()} CHIT CHAT. All rights reserved.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#667781] dark:text-[#8696A0]">
            <button type="button" onClick={() => setLegalModal('about')} className="hover:text-[#111B21] dark:hover:text-white cursor-pointer">
              About
            </button>
            <button type="button" onClick={() => setLegalModal('privacy')} className="hover:text-[#111B21] dark:hover:text-white cursor-pointer">
              Privacy Policy
            </button>
            <button type="button" onClick={() => setLegalModal('terms')} className="hover:text-[#111B21] dark:hover:text-white cursor-pointer">
              Terms
            </button>
            <button type="button" onClick={() => setLegalModal('help')} className="hover:text-[#111B21] dark:hover:text-white cursor-pointer">
              Help Center
            </button>
            <button type="button" onClick={() => setLegalModal('contact')} className="hover:text-[#111B21] dark:hover:text-white cursor-pointer">
              Contact
            </button>
          </div>
        </div>
      </footer>

      {/* Legal / Help Info Modal */}
      {legalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1A262E] p-6 border border-[#E7EDE9] dark:border-[#23323B] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-[#111B21] dark:text-white">
                {legalContent[legalModal].title}
              </h3>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="p-2 rounded-lg text-[#667781] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-[#667781] dark:text-[#8696A0] leading-relaxed">
              {legalContent[legalModal].body.map((para, idx) => (
                <p key={idx}>{para}</p>
              ))}
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="rounded-xl bg-[#25D366] px-5 py-2 text-sm font-semibold text-[#111B21] hover:bg-[#20bd5a] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
