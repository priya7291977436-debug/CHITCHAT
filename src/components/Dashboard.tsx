import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  UserPlus,
  Search,
  Settings,
  Bell,
  Plus,
  Phone,
  Video,
  PanelRight,
  MoreVertical,
  Send,
  Paperclip,
  Smile,
  Mic,
  ArrowLeft,
  Pin,
  Archive,
  BellOff,
  Trash2,
  Download,
  Flag,
  Lock,
  Unlock,
  X,
  Image as ImageIcon,
  FileText,
  Music,
  MapPin,
  User as UserIcon,
  BarChart3,
  CalendarClock,
  CheckSquare,
  Forward,
  Star,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  MessageSquarePlus,
  MailOpen,
  Radio,
} from 'lucide-react';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  CallSession,
  Chat,
  FriendRequest,
  Friendship,
  Message,
  MessageReminder,
  NotificationItem,
  StatusUpdate,
  UserPrivate,
  UserPublic,
} from '../types/chitchat';
import { ChitChatLogo } from './ChitChatLogo';
import { Avatar } from './Avatar';
import { AddPeopleModal } from './AddPeopleModal';
import { RichPickerPopover } from './RichPickerPopover';
import { VoiceRecorderBar } from './VoiceRecorderBar';
import { ChatMessageBubble } from './ChatMessageBubble';
import { RightInfoDrawer } from './RightInfoDrawer';
import { CallOverlay } from './CallOverlay';
import { StatusView } from './StatusView';
import { SettingsModal } from './SettingsModal';
import {
  CreatePollModal,
  CreateSpaceModal,
  ScheduleMessageModal,
  ShareContactModal,
  ShareLocationModal,
} from './GroupCommunityModals';
import {
  DEFAULT_APPEARANCE,
  DEFAULT_NOTIFICATIONS,
  deleteMessageForEveryone,
  deleteMessageForMe,
  editMessageText,
  ensureDirectChat,
  markMessageRead,
  sendMessage,
  sha256Hex,
  submitReport,
  toggleReaction,
  toggleStarMessage,
  updatePresence,
  updatePrivateSettings,
  voteOnPoll,
} from '../services/chitchatDb';
import { compressImageFile, uploadFileToStorage } from '../utils/media';
import { soundEngine } from '../utils/sounds';
import { realtimeSocket } from '../services/realtimeSocket';

interface DashboardProps {
  currentUser: UserPublic;
  privateData: UserPrivate | null;
}

type LeftTab =
  | 'all'
  | 'unread'
  | 'groups'
  | 'channels'
  | 'communities'
  | 'archived'
  | 'starred'
  | 'status'
  | 'calls';

export const Dashboard: React.FC<DashboardProps> = ({ currentUser, privateData }) => {
  // Core Real-time Data
  const [friends, setFriends] = useState<UserPublic[]>([]);
  const [friendUids, setFriendUids] = useState<string[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [publicChannels, setPublicChannels] = useState<Chat[]>([]);
  const [statuses, setStatuses] = useState<StatusUpdate[]>([]);
  const [callsHistory, setCallsHistory] = useState<CallSession[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);

  // Active Chat & Messages
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageLimit, setMessageLimit] = useState(40);
  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');

  // Navigation & Panels
  const [leftTab, setLeftTab] = useState<LeftTab>('all');
  const [globalSearch, setGlobalSearch] = useState('');
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [locallyUnreadIds, setLocallyUnreadIds] = useState<string[]>([]);

  // Modals
  const [addPeopleOpen, setAddPeopleOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createSpaceModal, setCreateSpaceModal] = useState<'group' | 'channel' | 'community' | 'broadcast' | null>(null);
  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [infoMsg, setInfoMsg] = useState<Message | null>(null);
  const [reportTarget, setReportTarget] = useState<{ type: 'user' | 'group'; id: string; label: string } | null>(null);
  const [reportReason, setReportReason] = useState('Spam or abuse');
  const [reportDetails, setReportDetails] = useState('');

  // Composer State
  const [draftText, setDraftText] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<string[]>([]);

  // Live Activity & Reminders & Chat Lock
  const [peerActivities, setPeerActivities] = useState<Record<string, string>>({});
  const [unlockedChatsSession, setUnlockedChatsSession] = useState<string[]>([]);
  const [lockPinAttempt, setLockPinAttempt] = useState('');
  const [lockPinError, setLockPinError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialMessagesLoadedRef = useRef<string | null>(null);
  const prevMsgCountRef = useRef(0);
  const typingTimeoutRef = useRef<number | null>(null);

  const appearance = { ...DEFAULT_APPEARANCE, ...(privateData?.appearancePrefs || {}) };
  const notifPrefs = { ...DEFAULT_NOTIFICATIONS, ...(privateData?.notificationPrefs || {}) };
  const blockedUids = privateData?.blockedUids || [];
  const archivedChatIds = privateData?.archivedChatIds || [];
  const pinnedChatIds = privateData?.pinnedChatIds || [];
  const mutedChatIds = privateData?.mutedChatIds || [];
  const lockedChatIds = privateData?.lockedChatIds || [];

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg((prev) => (prev === msg ? null : prev)), 4000);
  };

  // Connect WebSocket for live presence & activity
  useEffect(() => {
    realtimeSocket.connect(currentUser.uid);
    updatePresence(currentUser.uid, 'online');

    const handleBeforeUnload = () => {
      updatePresence(currentUser.uid, 'offline');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    const unsubWs = realtimeSocket.subscribe((evt) => {
      if (evt.type === 'chat:activity' && evt.chatId && evt.fromUid) {
        const key = `${evt.chatId}:${evt.fromUid}`;
        setPeerActivities((prev) => ({
          ...prev,
          [key]: evt.activity && evt.activity !== 'idle' ? evt.activity : '',
        }));
      }
    });

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      unsubWs();
      updatePresence(currentUser.uid, 'offline');
      realtimeSocket.disconnect();
    };
  }, [currentUser.uid]);

  // Keyboard shortcuts (Ctrl/Cmd+K, Escape)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setPickerOpen(false);
        setAttachMenuOpen(false);
        setChatMenuOpen(false);
        setReplyTo(null);
        setEditingMsg(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Invite URL param handler (?invite=CODE)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get('invite');
    if (!inviteCode) return;
    (async () => {
      const q = query(collection(db, 'chats'), where('isPublic', '==', true));
      const snap = await getDocs(q);
      const match = snap.docs.find((d) => d.data().inviteCode === inviteCode);
      if (match) {
        await updateDoc(doc(db, 'chats', match.id), {
          participantIds: arrayUnion(currentUser.uid),
          updatedAt: serverTimestamp(),
        });
        setActiveChatId(match.id);
        showToast(`Joined ${match.data().name || 'group'} via invite link!`);
        window.history.replaceState({}, '', '/');
      }
    })();
  }, [currentUser.uid]);

  // 1. Subscribe to Friendships
  useEffect(() => {
    const q = query(collection(db, 'friendships'), where('users', 'array-contains', currentUser.uid));
    return onSnapshot(
      q,
      (snap) => {
        const uids = new Set<string>();
        snap.docs.forEach((d) => {
          const data = d.data() as Friendship;
          data.users.forEach((u) => {
            if (u !== currentUser.uid) uids.add(u);
          });
        });
        setFriendUids(Array.from(uids));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'friendships')
    );
  }, [currentUser.uid]);

  // 2. Subscribe to each friend's public profile individually (PII-free, no list scraping)
  useEffect(() => {
    if (friendUids.length === 0) {
      setFriends([]);
      return;
    }
    const profileMap = new Map<string, UserPublic>();
    const unsubs = friendUids.map((uid) =>
      onSnapshot(doc(db, 'usersPublic', uid), (snap) => {
        if (snap.exists()) {
          profileMap.set(uid, snap.data() as UserPublic);
          setFriends(Array.from(profileMap.values()));
        }
      })
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [friendUids.join(',')]);

  // 3. Subscribe to Incoming & Outgoing Friend Requests
  useEffect(() => {
    const qIn = query(
      collection(db, 'friendRequests'),
      where('toUid', '==', currentUser.uid),
      where('status', '==', 'pending')
    );
    const qOut = query(
      collection(db, 'friendRequests'),
      where('fromUid', '==', currentUser.uid),
      where('status', '==', 'pending')
    );

    const u1 = onSnapshot(
      qIn,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FriendRequest);
        if (items.length > incomingRequests.length && items.length > 0) {
          soundEngine.playFriendRequest(notifPrefs);
        }
        setIncomingRequests(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'friendRequests')
    );
    const u2 = onSnapshot(
      qOut,
      (snap) => setOutgoingRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FriendRequest)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'friendRequests')
    );
    return () => {
      u1();
      u2();
    };
  }, [currentUser.uid]);

  // 4. Subscribe to User Chats + Public Channels
  useEffect(() => {
    const qChats = query(
      collection(db, 'chats'),
      where('participantIds', 'array-contains', currentUser.uid)
    );
    const qPub = query(collection(db, 'chats'), where('isPublic', '==', true), limit(25));

    const u1 = onSnapshot(
      qChats,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Chat);
        list.sort((a, b) => {
          const aPinned = pinnedChatIds.includes(a.id) ? 1 : 0;
          const bPinned = pinnedChatIds.includes(b.id) ? 1 : 0;
          if (aPinned !== bPinned) return bPinned - aPinned;
          const ta = (a.lastMessageAt as { toMillis?: () => number })?.toMillis?.() || 0;
          const tb = (b.lastMessageAt as { toMillis?: () => number })?.toMillis?.() || 0;
          return tb - ta;
        });
        setChats(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'chats')
    );

    const u2 = onSnapshot(
      qPub,
      (snap) => setPublicChannels(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Chat)),
      () => {}
    );

    return () => {
      u1();
      u2();
    };
  }, [currentUser.uid, pinnedChatIds.join(',')]);

  // 5. Subscribe to 24h Statuses
  useEffect(() => {
    const q = query(
      collection(db, 'statuses'),
      where('allowedUids', 'array-contains', currentUser.uid)
    );
    return onSnapshot(
      q,
      (snap) => setStatuses(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StatusUpdate)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'statuses')
    );
  }, [currentUser.uid]);

  // 6. Subscribe to Calls (incoming & outgoing)
  useEffect(() => {
    const qIn = query(collection(db, 'calls'), where('calleeIds', 'array-contains', currentUser.uid));
    const qOut = query(collection(db, 'calls'), where('callerId', '==', currentUser.uid));
    let inList: CallSession[] = [];
    let outList: CallSession[] = [];

    const merge = () => {
      const map = new Map<string, CallSession>();
      [...inList, ...outList].forEach((c) => map.set(c.id, c));
      const sorted = Array.from(map.values()).sort((a, b) => {
        const ta = (a.createdAt as { toMillis?: () => number })?.toMillis?.() || 0;
        const tb = (b.createdAt as { toMillis?: () => number })?.toMillis?.() || 0;
        return tb - ta;
      });
      setCallsHistory(sorted);
      const ringingIncoming = inList.find((c) => c.status === 'ringing');
      if (ringingIncoming) {
        setActiveCall((prev) => prev || ringingIncoming);
      }
    };

    const u1 = onSnapshot(qIn, (snap) => {
      inList = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CallSession);
      merge();
    });
    const u2 = onSnapshot(qOut, (snap) => {
      outList = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CallSession);
      merge();
    });
    return () => {
      u1();
      u2();
    };
  }, [currentUser.uid]);

  // 7. Subscribe to Notifications
  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', currentUser.uid),
      limit(30)
    );
    return onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as NotificationItem)
        .sort((a, b) => {
          const ta = (a.createdAt as { toMillis?: () => number })?.toMillis?.() || 0;
          const tb = (b.createdAt as { toMillis?: () => number })?.toMillis?.() || 0;
          return tb - ta;
        });
      setNotifications(list);
    });
  }, [currentUser.uid]);

  // 8. Check local message reminders every 15s
  useEffect(() => {
    const timer = window.setInterval(() => {
      try {
        const raw = JSON.parse(localStorage.getItem('chitchat_reminders') || '[]') as MessageReminder[];
        const now = Date.now();
        const due = raw.filter((r) => new Date(r.remindAt).getTime() <= now);
        if (due.length > 0) {
          due.forEach((r) => {
            showToast(`Reminder: ${r.text}`);
            soundEngine.playNotification(notifPrefs);
          });
          const remaining = raw.filter((r) => new Date(r.remindAt).getTime() > now);
          localStorage.setItem('chitchat_reminders', JSON.stringify(remaining));
        }
      } catch {
        // Ignore
      }
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) || publicChannels.find((c) => c.id === activeChatId) || null,
    [chats, publicChannels, activeChatId]
  );

  // Load saved draft when switching chats
  useEffect(() => {
    if (!activeChatId) return;
    const saved = localStorage.getItem(`chitchat_draft_${activeChatId}`) || '';
    setDraftText(saved);
    setReplyTo(null);
    setEditingMsg(null);
    setMessageLimit(40);
    initialMessagesLoadedRef.current = null;
    prevMsgCountRef.current = 0;
    setLocallyUnreadIds((prev) => prev.filter((id) => id !== activeChatId));
  }, [activeChatId]);

  // 9. Subscribe to Active Chat Messages (Paginated)
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    const qMsgs = activeChat.isPublic
      ? query(
          collection(db, 'chats', activeChat.id, 'messages'),
          where('isPublic', '==', true),
          orderBy('createdAt', 'desc'),
          limit(messageLimit)
        )
      : query(
          collection(db, 'chats', activeChat.id, 'messages'),
          where('participantIds', 'array-contains', currentUser.uid),
          orderBy('createdAt', 'desc'),
          limit(messageLimit)
        );

    return onSnapshot(
      qMsgs,
      (snap) => {
        const now = Date.now();
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Message)
          .filter((m) => {
            if (m.deletedFor?.includes(currentUser.uid)) return false;
            const exp = m.expiresAt as { toMillis?: () => number } | undefined;
            if (exp?.toMillis && exp.toMillis() < now) return false;
            const sched = m.scheduledFor as { toMillis?: () => number } | undefined;
            if (sched?.toMillis && sched.toMillis() > now && m.senderId !== currentUser.uid) {
              return false;
            }
            return true;
          })
          .reverse();

        if (initialMessagesLoadedRef.current === activeChat.id && list.length > prevMsgCountRef.current) {
          const newest = list[list.length - 1];
          if (newest && newest.senderId !== currentUser.uid) {
            soundEngine.playReceived(notifPrefs);
          }
        }
        prevMsgCountRef.current = list.length;
        if (initialMessagesLoadedRef.current !== activeChat.id) {
          initialMessagesLoadedRef.current = activeChat.id;
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
        } else {
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }

        setMessages(list);

        // Mark read if readReceipts enabled
        if (currentUser.privacy?.readReceipts !== false) {
          list.forEach((m) => {
            if (m.senderId !== currentUser.uid && !m.readBy?.includes(currentUser.uid)) {
              markMessageRead(activeChat.id, m, currentUser.uid);
            }
          });
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `chats/${activeChat.id}/messages`)
    );
  }, [activeChat?.id, messageLimit, currentUser.uid]);

  const membersMap = useMemo(() => {
    const map: Record<string, UserPublic> = { [currentUser.uid]: currentUser };
    friends.forEach((f) => {
      map[f.uid] = f;
    });
    return map;
  }, [currentUser, friends]);

  const getChatDisplayInfo = (chat: Chat) => {
    if (chat.type !== 'direct') {
      return {
        title: chat.name || 'Group Chat',
        avatar: chat.photoURL,
        peer: null as UserPublic | null,
      };
    }
    const peerUid = chat.participantIds.find((id) => id !== currentUser.uid);
    const peer = peerUid ? membersMap[peerUid] || null : null;
    return {
      title: peer?.displayName || 'CHIT CHAT Contact',
      avatar: peer?.photoURL,
      peer,
    };
  };

  // Filtered Left Sidebar Chats
  const filteredChats = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return chats.filter((chat) => {
      const isArchived = archivedChatIds.includes(chat.id);
      if (leftTab === 'archived') {
        if (!isArchived) return false;
      } else if (isArchived) {
        return false;
      }

      if (leftTab === 'groups' && chat.type !== 'group' && chat.type !== 'broadcast') return false;
      if (leftTab === 'channels' && chat.type !== 'channel') return false;
      if (leftTab === 'communities' && chat.type !== 'community') return false;
      if (leftTab === 'unread' && !locallyUnreadIds.includes(chat.id)) return false;

      if (q) {
        const info = getChatDisplayInfo(chat);
        const matchesName = info.title.toLowerCase().includes(q);
        const matchesMsg = (chat.lastMessageText || '').toLowerCase().includes(q);
        const matchesUsername = (info.peer?.username || '').toLowerCase().includes(q);
        return matchesName || matchesMsg || matchesUsername;
      }
      return true;
    });
  }, [chats, leftTab, globalSearch, archivedChatIds, locallyUnreadIds, membersMap]);

  const handleTogglePrivateList = (
    field: 'archivedChatIds' | 'pinnedChatIds' | 'mutedChatIds' | 'blockedUids' | 'lockedChatIds',
    targetId: string
  ) => {
    const currentList = (privateData?.[field] as string[]) || [];
    const next = currentList.includes(targetId)
      ? currentList.filter((x) => x !== targetId)
      : [...currentList, targetId];
    updatePrivateSettings(currentUser.uid, { [field]: next });
  };

  const handleSendText = async (e?: React.FormEvent, scheduledDate?: Date) => {
    if (e) e.preventDefault();
    if (!activeChat) return;
    const text = draftText.trim();
    if (!text) return;

    if (editingMsg) {
      await editMessageText(activeChat.id, editingMsg.id, text);
      setEditingMsg(null);
      setDraftText('');
      localStorage.removeItem(`chitchat_draft_${activeChat.id}`);
      return;
    }

    setDraftText('');
    localStorage.removeItem(`chitchat_draft_${activeChat.id}`);
    realtimeSocket.sendActivity(activeChat.id, activeChat.participantIds, 'idle');

    const replyRef = replyTo
      ? {
          messageId: replyTo.id,
          senderId: replyTo.senderId,
          senderName: replyTo.senderName,
          type: replyTo.type,
          text: (replyTo.text || replyTo.type).slice(0, 120),
        }
      : undefined;
    setReplyTo(null);

    if (activeChat.type === 'broadcast') {
      // Broadcast fans out individual direct chats to each selected friend
      for (const targetUid of activeChat.participantIds) {
        if (targetUid === currentUser.uid) continue;
        const dmId = await ensureDirectChat(currentUser.uid, targetUid);
        await sendMessage({
          chat: { ...activeChat, id: dmId, type: 'direct', participantIds: [currentUser.uid, targetUid] },
          sender: currentUser,
          type: 'text',
          text,
          scheduledFor: scheduledDate,
        });
      }
    }

    await sendMessage({
      chat: activeChat,
      sender: currentUser,
      type: 'text',
      text,
      replyTo: replyRef,
      scheduledFor: scheduledDate,
    });
    soundEngine.playSent(notifPrefs);
  };

  const handleFileAttachment = async (file: File, kind: 'image' | 'video' | 'document' | 'audio') => {
    if (!activeChat) return;
    setAttachMenuOpen(false);
    realtimeSocket.sendActivity(activeChat.id, activeChat.participantIds, 'uploading');
    setUploadProgress(5);
    try {
      const processed = kind === 'image' ? await compressImageFile(file) : file;
      const url = await uploadFileToStorage(
        `chatMedia/${activeChat.id}/${currentUser.uid}/${Date.now()}_${processed.name}`,
        processed,
        (pct) => setUploadProgress(pct)
      );
      await sendMessage({
        chat: activeChat,
        sender: currentUser,
        type: kind,
        mediaUrl: url,
        mediaName: processed.name,
        mediaMime: processed.type,
        mediaSize: processed.size,
      });
      soundEngine.playSent(notifPrefs);
    } finally {
      setUploadProgress(null);
      realtimeSocket.sendActivity(activeChat.id, activeChat.participantIds, 'idle');
    }
  };

  const handleStartCall = async (callType: 'audio' | 'video') => {
    if (!activeChat) return;
    const callees = activeChat.participantIds.filter((id) => id !== currentUser.uid);
    if (callees.length === 0) {
      showToast('Add another participant before placing a call.');
      return;
    }

    try {
      const callPayload: Record<string, unknown> = {
        callerId: currentUser.uid,
        callerName: currentUser.displayName,
        calleeIds: callees.slice(0, 20),
        chatId: activeChat.id,
        callType,
        mode: activeChat.type === 'direct' ? 'direct' : 'group',
        status: 'ringing',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (currentUser.photoURL) callPayload.callerPhotoURL = currentUser.photoURL;

      const docRef = await addDoc(collection(db, 'calls'), callPayload);
      setActiveCall({
        id: docRef.id,
        callerId: currentUser.uid,
        callerName: currentUser.displayName,
        callerPhotoURL: currentUser.photoURL,
        calleeIds: callees,
        chatId: activeChat.id,
        callType,
        mode: activeChat.type === 'direct' ? 'direct' : 'group',
        status: 'ringing',
      });
    } catch {
      showToast('Unable to place call right now. Please try again.');
    }
  };

  const handleExportChat = () => {
    if (!activeChat) return;
    const lines = messages.map((m) => {
      const dt = (m.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString() || '';
      return `[${dt}] ${m.senderName}: ${m.text || `[${m.type}]`}`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chitchat_${activeChat.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearChat = async () => {
    if (!activeChat) return;
    for (const m of messages) {
      await deleteMessageForMe(activeChat.id, m.id, currentUser.uid);
    }
    setChatMenuOpen(false);
  };

  const handleDeleteChat = async () => {
    if (!activeChat) return;
    await deleteDoc(doc(db, 'chats', activeChat.id));
    setActiveChatId(null);
    setChatMenuOpen(false);
  };

  const fontSizeClass =
    appearance.fontSize === 'small'
      ? 'text-[13px]'
      : appearance.fontSize === 'large'
        ? 'text-[16px]'
        : 'text-[14.5px]';

  const activeWallpaper = activeChat
    ? appearance.chatWallpapers?.[activeChat.id] || appearance.globalWallpaper
    : appearance.globalWallpaper;

  const wallpaperClass =
    activeWallpaper === 'green'
      ? 'chitchat-wallpaper-green'
      : activeWallpaper === 'minimal'
        ? 'chitchat-wallpaper-minimal'
        : activeWallpaper === 'abstract'
          ? 'chitchat-wallpaper-abstract'
          : activeWallpaper === 'nature'
            ? 'chitchat-wallpaper-nature'
            : activeWallpaper === 'gradient'
              ? 'chitchat-wallpaper-gradient'
              : 'chitchat-wallpaper-default';

  const activeChatInfo = activeChat ? getChatDisplayInfo(activeChat) : null;
  const activePeerBlocked = Boolean(
    activeChatInfo?.peer && blockedUids.includes(activeChatInfo.peer.uid)
  );
  const isChatLocked = Boolean(
    activeChat &&
      lockedChatIds.includes(activeChat.id) &&
      !unlockedChatsSession.includes(activeChat.id)
  );
  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  // Displayed messages (filtered by in-chat search if open)
  const visibleMessages = useMemo(() => {
    if (!inChatSearchOpen || !inChatSearchQuery.trim()) return messages;
    const q = inChatSearchQuery.trim().toLowerCase();
    return messages.filter((m) => (m.text || '').toLowerCase().includes(q));
  }, [messages, inChatSearchOpen, inChatSearchQuery]);

  const formatDateSeparator = (d: Date) => {
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F4FBF6] dark:bg-[#111B21] flex">
      {/* LEFT SIDEBAR */}
      <aside
        className={`${
          activeChatId ? 'hidden md:flex' : 'flex'
        } w-full md:w-[340px] lg:w-[380px] flex-col border-r border-[#E7EDE9] dark:border-[#23323B] bg-white dark:bg-[#111B21] shrink-0 h-full`}
      >
        {/* Top Profile & Actions Bar */}
        <div className="h-16 px-4 border-b border-[#E7EDE9] dark:border-[#23323B] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar
              src={currentUser.photoURL}
              name={currentUser.displayName}
              size="md"
              online={currentUser.presence === 'online'}
            />
            <div className="min-w-0">
              <p className="font-display font-bold text-sm text-[#111B21] dark:text-white truncate">
                {currentUser.displayName}
              </p>
              <p className="text-[11px] font-mono-nums text-[#128C7E] dark:text-[#25D366] truncate">
                @{currentUser.username}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                className="relative p-2 rounded-xl text-[#667781] hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#25D366] text-[#111B21] text-[10px] font-bold flex items-center justify-center font-mono-nums">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-white dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#2A3942] shadow-2xl z-40 p-3 space-y-2 max-h-80 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#111B21] dark:text-white">
                      Notifications
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        notifications
                          .filter((n) => !n.read)
                          .forEach((n) =>
                            updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {})
                          );
                      }}
                      className="text-[11px] text-[#128C7E] dark:text-[#25D366] font-semibold cursor-pointer"
                    >
                      Mark all read
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-xs text-[#667781] py-4 text-center">No notifications yet.</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {});
                          if (n.type === 'friend_request') setAddPeopleOpen(true);
                          setNotifOpen(false);
                        }}
                        className={`p-2 rounded-xl text-xs cursor-pointer ${
                          n.read
                            ? 'bg-transparent text-[#667781]'
                            : 'bg-[#F4FBF6] dark:bg-[#202C33] text-[#111B21] dark:text-white font-medium'
                        }`}
                      >
                        <p className="font-semibold">{n.title}</p>
                        {n.body && <p className="text-[11px] opacity-80 mt-0.5">{n.body}</p>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Prominent Green Circular Add People Button */}
            <button
              type="button"
              onClick={() => setAddPeopleOpen(true)}
              title="Add People by @username"
              className="relative w-9 h-9 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] flex items-center justify-center shadow-sm transition-transform active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              {incomingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#111B21] text-white text-[10px] font-bold flex items-center justify-center font-mono-nums">
                  {incomingRequests.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setCreateSpaceModal('group')}
              title="Create Group, Channel, Community or Broadcast"
              className="p-2 rounded-xl text-[#667781] hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
              className="p-2 rounded-xl text-[#667781] hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Incoming Friend Request Banner */}
        {incomingRequests.length > 0 && (
          <button
            type="button"
            onClick={() => setAddPeopleOpen(true)}
            className="mx-3 mt-2.5 px-3.5 py-2 rounded-xl bg-[#D9FDD3] dark:bg-[#005C4B] text-[#111B21] dark:text-white text-xs font-semibold flex items-center justify-between cursor-pointer"
          >
            <span>
              {incomingRequests.length} incoming friend request{incomingRequests.length > 1 ? 's' : ''}
            </span>
            <span className="underline">Review</span>
          </button>
        )}

        {/* Global Search */}
        <div className="p-3 space-y-2.5 border-b border-[#E7EDE9] dark:border-[#23323B]">
          <div className="relative">
            <Search className="w-4 h-4 text-[#667781] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search chats, messages, groups (Ctrl+K)"
              className="w-full rounded-xl bg-[#F4FBF6] dark:bg-[#202C33] pl-9 pr-3 py-2 text-xs text-[#111B21] dark:text-white placeholder:text-[#667781] focus:outline-none focus:ring-1 focus:ring-[#25D366]"
            />
          </div>

          {/* Filter / Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {(
              [
                ['all', 'Chats'],
                ['unread', 'Unread'],
                ['status', 'Status'],
                ['calls', 'Calls'],
                ['groups', 'Groups'],
                ['channels', 'Channels'],
                ['communities', 'Communities'],
                ['archived', 'Archived'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLeftTab(id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  leftTab === id
                    ? 'bg-[#D9FDD3] dark:bg-[#005C4B] text-[#111B21] dark:text-white'
                    : 'text-[#667781] hover:bg-[#F4FBF6] dark:hover:bg-[#202C33]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Left List Content */}
        {leftTab === 'status' ? (
          <StatusView
            currentUser={currentUser}
            friends={friends}
            statuses={statuses}
            onReplyToStatus={async (ownerUid, text) => {
              const dmId = await ensureDirectChat(currentUser.uid, ownerUid);
              const chatObj = chats.find((c) => c.id === dmId) || {
                id: dmId,
                type: 'direct' as const,
                ownerId: currentUser.uid,
                participantIds: [currentUser.uid, ownerUid],
              };
              await sendMessage({ chat: chatObj, sender: currentUser, type: 'text', text });
              setActiveChatId(dmId);
              setLeftTab('all');
            }}
          />
        ) : leftTab === 'calls' ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {callsHistory.length === 0 ? (
              <div className="text-center py-12 px-4 space-y-2">
                <Phone className="w-8 h-8 text-[#667781]/50 mx-auto" />
                <p className="text-sm font-semibold text-[#111B21] dark:text-white">No recent calls</p>
                <p className="text-xs text-[#667781]">
                  Open a conversation to start a WebRTC audio or video call.
                </p>
              </div>
            ) : (
              callsHistory.map((c) => {
                const isOut = c.callerId === currentUser.uid;
                return (
                  <div
                    key={c.id}
                    onClick={() => setActiveChatId(c.chatId)}
                    className="p-3 rounded-2xl border border-[#E7EDE9] dark:border-[#23323B] flex items-center justify-between gap-3 hover:bg-[#F4FBF6] dark:hover:bg-[#1A262E] cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar src={c.callerPhotoURL} name={c.callerName} size="md" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#111B21] dark:text-white truncate">
                          {isOut ? 'Outgoing Call' : c.callerName}
                        </p>
                        <p className="text-xs text-[#667781] flex items-center gap-1 capitalize">
                          {c.status === 'missed' || c.status === 'declined' ? (
                            <PhoneMissed className="w-3 h-3 text-red-500" />
                          ) : isOut ? (
                            <PhoneOutgoing className="w-3 h-3 text-[#25D366]" />
                          ) : (
                            <PhoneIncoming className="w-3 h-3 text-[#128C7E]" />
                          )}
                          <span>{c.callType} · {c.status}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredChats.length === 0 && !(leftTab === 'channels' && publicChannels.length > 0) ? (
              <div className="text-center py-14 px-6 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#D9FDD3] dark:bg-[#005C4B] text-[#128C7E] dark:text-[#25D366] flex items-center justify-center mx-auto">
                  <MessageSquarePlus className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="font-display font-bold text-sm text-[#111B21] dark:text-white">
                    {leftTab === 'archived'
                      ? 'No archived chats'
                      : 'Your workspace is empty'}
                  </p>
                  <p className="text-xs text-[#667781] dark:text-[#8696A0] leading-relaxed">
                    CHIT CHAT never pre-populates contacts or messages. Add friends using their
                    exact @username to begin chatting.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddPeopleOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] font-semibold px-4 py-2 text-xs cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Find People by @username</span>
                </button>
              </div>
            ) : (
              filteredChats.map((chat) => {
                const info = getChatDisplayInfo(chat);
                const isSelected = chat.id === activeChatId;
                const isPinned = pinnedChatIds.includes(chat.id);
                const isMuted = mutedChatIds.includes(chat.id);
                const isUnread = locallyUnreadIds.includes(chat.id);
                const timeStr = (chat.lastMessageAt as { toDate?: () => Date })
                  ?.toDate?.()
                  ?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => setActiveChatId(chat.id)}
                    className={`w-full p-3 rounded-2xl flex items-center gap-3 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#D9FDD3]/70 dark:bg-[#202C33]'
                        : 'hover:bg-[#F4FBF6] dark:hover:bg-[#1A262E]'
                    }`}
                  >
                    <Avatar
                      src={info.avatar}
                      name={info.title}
                      size="md"
                      online={
                        info.peer?.presence === 'online' &&
                        info.peer.privacy?.onlineStatus !== 'nobody'
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-[#111B21] dark:text-white truncate">
                          {info.title}
                        </span>
                        <span className="text-[11px] font-mono-nums text-[#667781] shrink-0">
                          {timeStr || ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-xs text-[#667781] dark:text-[#8696A0] truncate">
                          {chat.lastMessageText ||
                            (chat.type === 'direct' ? 'Tap to start chatting' : `${chat.type} · ${chat.participantIds.length} members`)}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          {isPinned && <Pin className="w-3 h-3 text-[#128C7E]" />}
                          {isMuted && <BellOff className="w-3 h-3 text-[#667781]" />}
                          {isUnread && (
                            <span className="w-2.5 h-2.5 rounded-full bg-[#25D366]" />
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}

            {/* Public Channels Discovery */}
            {leftTab === 'channels' && publicChannels.length > 0 && (
              <div className="pt-3 border-t border-[#E7EDE9] dark:border-[#23323B] space-y-1.5">
                <p className="text-[11px] font-semibold text-[#667781] px-2">
                  Discover Public Channels
                </p>
                {publicChannels
                  .filter((ch) => !ch.participantIds.includes(currentUser.uid))
                  .map((ch) => (
                    <div
                      key={ch.id}
                      className="p-2.5 rounded-2xl border border-[#E7EDE9] dark:border-[#23323B] flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-[#D9FDD3] dark:bg-[#005C4B] flex items-center justify-center text-[#128C7E]">
                          <Radio className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#111B21] dark:text-white truncate">
                            {ch.name}
                          </p>
                          <p className="text-[11px] text-[#667781] truncate">
                            {ch.participantIds.length} subscribers
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await updateDoc(doc(db, 'chats', ch.id), {
                            participantIds: arrayUnion(currentUser.uid),
                            updatedAt: serverTimestamp(),
                          });
                          setActiveChatId(ch.id);
                        }}
                        className="rounded-xl bg-[#25D366] text-[#111B21] font-semibold px-3 py-1 text-xs cursor-pointer"
                      >
                        Follow
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </aside>

      {/* CENTER CONVERSATION PANEL */}
      <main
        className={`${
          activeChatId ? 'flex' : 'hidden md:flex'
        } flex-1 flex-col min-w-0 h-full relative`}
      >
        {!activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-5 bg-[#F4FBF6] dark:bg-[#0B141A]">
            <ChitChatLogo size="lg" />
            <div className="max-w-md space-y-2">
              <h2 className="font-display text-2xl font-bold text-[#111B21] dark:text-white">
                Chat Freely. Stay Connected.
              </h2>
              <p className="text-sm text-[#667781] dark:text-[#8696A0] leading-relaxed">
                Select a conversation on the left, or tap the green Add People button to search for
                friends by their exact <code className="font-mono-nums text-[#128C7E] dark:text-[#25D366]">@username</code>.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setAddPeopleOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] font-semibold px-5 py-2.5 text-sm cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add People</span>
              </button>
              <button
                type="button"
                onClick={() => setCreateSpaceModal('group')}
                className="inline-flex items-center gap-2 rounded-xl border border-[#E7EDE9] dark:border-[#23323B] bg-white dark:bg-[#1A262E] px-5 py-2.5 text-sm font-medium text-[#111B21] dark:text-white cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Group</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Conversation Header */}
            <header className="h-16 px-4 bg-white dark:bg-[#1A262E] border-b border-[#E7EDE9] dark:border-[#23323B] flex items-center justify-between gap-3 shrink-0 z-20">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setActiveChatId(null)}
                  className="md:hidden p-2 -ml-2 rounded-xl text-[#667781] cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setRightDrawerOpen((o) => !o)}
                  className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                >
                  <Avatar
                    src={activeChatInfo?.avatar}
                    name={activeChatInfo?.title || 'Chat'}
                    size="md"
                    online={
                      activeChatInfo?.peer?.presence === 'online' &&
                      activeChatInfo.peer.privacy?.onlineStatus !== 'nobody'
                    }
                  />
                  <div className="min-w-0">
                    <h3 className="font-display font-bold text-sm text-[#111B21] dark:text-white truncate">
                      {activeChatInfo?.title}
                    </h3>
                    <p className="text-[11px] text-[#667781] dark:text-[#8696A0] truncate">
                      {(() => {
                        const peerUid = activeChatInfo?.peer?.uid;
                        const activity = peerUid ? peerActivities[`${activeChat.id}:${peerUid}`] : '';
                        if (activity === 'typing') return 'Typing...';
                        if (activity === 'recording') return 'Recording audio...';
                        if (activity === 'uploading') return 'Uploading media...';
                        if (activeChat.type !== 'direct') {
                          return `${activeChat.participantIds.length} members`;
                        }
                        if (activeChatInfo?.peer?.presence === 'in_call') return 'In a call';
                        if (
                          activeChatInfo?.peer?.presence === 'online' &&
                          activeChatInfo.peer.privacy?.onlineStatus !== 'nobody'
                        ) {
                          return 'Online';
                        }
                        const ls = (activeChatInfo?.peer?.lastSeen as { toDate?: () => Date })?.toDate?.();
                        if (ls && activeChatInfo?.peer?.privacy?.lastSeen !== 'nobody') {
                          return `Last seen ${ls.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                        }
                        return `@${activeChatInfo?.peer?.username || 'chitchat'}`;
                      })()}
                    </p>
                  </div>
                </button>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setInChatSearchOpen((o) => !o)}
                  className="p-2 rounded-xl text-[#667781] hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
                  title="Search messages"
                >
                  <Search className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStartCall('audio')}
                  className="p-2 rounded-xl text-[#667781] hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] hover:text-[#128C7E] cursor-pointer"
                  title="Audio Call"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStartCall('video')}
                  className="p-2 rounded-xl text-[#667781] hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] hover:text-[#128C7E] cursor-pointer"
                  title="Video Call"
                >
                  <Video className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRightDrawerOpen((o) => !o)}
                  className="p-2 rounded-xl text-[#667781] hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
                  title="Info Drawer"
                >
                  <PanelRight className="w-4 h-4" />
                </button>

                {/* Three-Dot Context Menu */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setChatMenuOpen((o) => !o)}
                    className="p-2 rounded-xl text-[#667781] hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
                    title="Chat options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {chatMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-48 rounded-2xl bg-white dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#2A3942] shadow-xl py-1.5 text-xs text-[#111B21] dark:text-[#E9EDEF] z-40">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectionMode((s) => !s);
                          setSelectedMsgIds([]);
                          setChatMenuOpen(false);
                        }}
                        className="w-full px-3.5 py-2 flex items-center gap-2 hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
                      >
                        <CheckSquare className="w-3.5 h-3.5" /> <span>Select Messages</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleTogglePrivateList('pinnedChatIds', activeChat.id);
                          setChatMenuOpen(false);
                        }}
                        className="w-full px-3.5 py-2 flex items-center gap-2 hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
                      >
                        <Pin className="w-3.5 h-3.5" />{' '}
                        <span>{pinnedChatIds.includes(activeChat.id) ? 'Unpin Chat' : 'Pin Chat'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleTogglePrivateList('archivedChatIds', activeChat.id);
                          setChatMenuOpen(false);
                        }}
                        className="w-full px-3.5 py-2 flex items-center gap-2 hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5" />{' '}
                        <span>{archivedChatIds.includes(activeChat.id) ? 'Unarchive Chat' : 'Archive Chat'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleTogglePrivateList('mutedChatIds', activeChat.id);
                          setChatMenuOpen(false);
                        }}
                        className="w-full px-3.5 py-2 flex items-center gap-2 hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
                      >
                        <BellOff className="w-3.5 h-3.5" />{' '}
                        <span>{mutedChatIds.includes(activeChat.id) ? 'Unmute' : 'Mute'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLocallyUnreadIds((prev) => [...prev, activeChat.id]);
                          setActiveChatId(null);
                          setChatMenuOpen(false);
                        }}
                        className="w-full px-3.5 py-2 flex items-center gap-2 hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
                      >
                        <MailOpen className="w-3.5 h-3.5" /> <span>Mark Unread</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleTogglePrivateList('lockedChatIds', activeChat.id);
                          setChatMenuOpen(false);
                        }}
                        className="w-full px-3.5 py-2 flex items-center gap-2 hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
                      >
                        {lockedChatIds.includes(activeChat.id) ? (
                          <Unlock className="w-3.5 h-3.5" />
                        ) : (
                          <Lock className="w-3.5 h-3.5" />
                        )}
                        <span>{lockedChatIds.includes(activeChat.id) ? 'Unlock Chat' : 'Lock Chat'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleExportChat();
                          setChatMenuOpen(false);
                        }}
                        className="w-full px-3.5 py-2 flex items-center gap-2 hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> <span>Export Chat</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleClearChat}
                        className="w-full px-3.5 py-2 flex items-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> <span>Clear Messages</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteChat}
                        className="w-full px-3.5 py-2 flex items-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> <span>Delete Chat</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReportTarget({
                            type: activeChat.type === 'direct' ? 'user' : 'group',
                            id: activeChat.type === 'direct' ? activeChatInfo?.peer?.uid || activeChat.id : activeChat.id,
                            label: activeChatInfo?.title || 'Chat',
                          });
                          setChatMenuOpen(false);
                        }}
                        className="w-full px-3.5 py-2 flex items-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
                      >
                        <Flag className="w-3.5 h-3.5" /> <span>Report</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* In-Chat Search Bar */}
            {inChatSearchOpen && (
              <div className="px-4 py-2 bg-white dark:bg-[#1A262E] border-b border-[#E7EDE9] dark:border-[#23323B] flex items-center gap-2">
                <Search className="w-4 h-4 text-[#667781]" />
                <input
                  type="text"
                  autoFocus
                  value={inChatSearchQuery}
                  onChange={(e) => setInChatSearchQuery(e.target.value)}
                  placeholder="Search inside this conversation..."
                  className="flex-1 text-xs bg-transparent text-[#111B21] dark:text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setInChatSearchOpen(false);
                    setInChatSearchQuery('');
                  }}
                  className="text-xs text-[#667781] cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}

            {/* Pinned Message Banner */}
            {activeChat.pinnedMessageId && (() => {
              const pinned = messages.find((m) => m.id === activeChat.pinnedMessageId);
              if (!pinned) return null;
              return (
                <div className="px-4 py-2 bg-white/90 dark:bg-[#1A262E]/95 border-b border-[#E7EDE9] dark:border-[#23323B] flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Pin className="w-3.5 h-3.5 text-[#128C7E] shrink-0" />
                    <span className="truncate text-[#111B21] dark:text-white">
                      <strong>Pinned:</strong> {pinned.text || pinned.type}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateDoc(doc(db, 'chats', activeChat.id), {
                        pinnedMessageId: '',
                        updatedAt: serverTimestamp(),
                      })
                    }
                    className="text-[#667781] hover:text-red-500 cursor-pointer"
                  >
                    Unpin
                  </button>
                </div>
              );
            })()}

            {/* Chat Lock Gate */}
            {isChatLocked ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#F4FBF6] dark:bg-[#0B141A] space-y-4">
                <div className="w-12 h-12 rounded-full bg-[#D9FDD3] dark:bg-[#005C4B] flex items-center justify-center text-[#128C7E]">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="text-center space-y-1">
                  <h4 className="font-display font-bold text-base text-[#111B21] dark:text-white">
                    This chat is locked
                  </h4>
                  <p className="text-xs text-[#667781]">
                    {privateData?.chatLockPinHash
                      ? 'Enter your Chat Lock PIN to view messages.'
                      : 'Set a Chat Lock PIN in Settings > Security, or tap Unlock below.'}
                  </p>
                </div>
                {privateData?.chatLockPinHash ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const hash = await sha256Hex(lockPinAttempt);
                      if (hash === privateData.chatLockPinHash) {
                        setUnlockedChatsSession([...unlockedChatsSession, activeChat.id]);
                        setLockPinAttempt('');
                        setLockPinError(null);
                      } else {
                        setLockPinError('Incorrect PIN.');
                      }
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="password"
                      value={lockPinAttempt}
                      onChange={(e) => setLockPinAttempt(e.target.value)}
                      placeholder="Enter PIN"
                      className="rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-white dark:bg-[#202C33] px-3 py-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="rounded-xl bg-[#25D366] text-[#111B21] font-semibold px-4 py-2 text-xs cursor-pointer"
                    >
                      Unlock
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setUnlockedChatsSession([...unlockedChatsSession, activeChat.id])}
                    className="rounded-xl bg-[#25D366] text-[#111B21] font-semibold px-4 py-2 text-xs cursor-pointer"
                  >
                    Unlock Chat
                  </button>
                )}
                {lockPinError && <p className="text-xs text-red-500">{lockPinError}</p>}
              </div>
            ) : (
              <>
                {/* Message History Scroll Area */}
                <div className={`flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-2.5 ${wallpaperClass}`}>
                  {messages.length >= messageLimit && (
                    <div className="text-center pb-2">
                      <button
                        type="button"
                        onClick={() => setMessageLimit((l) => l + 40)}
                        className="rounded-xl bg-white/90 dark:bg-[#1A262E]/90 border border-[#E7EDE9] dark:border-[#23323B] px-3 py-1 text-xs font-medium text-[#128C7E] dark:text-[#25D366] cursor-pointer"
                      >
                        Load earlier messages
                      </button>
                    </div>
                  )}

                  {visibleMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="rounded-2xl bg-white/90 dark:bg-[#1A262E]/90 px-5 py-3 text-xs text-[#667781] shadow-xs text-center max-w-xs">
                        Say hello to start your conversation on CHIT CHAT.
                      </div>
                    </div>
                  ) : (
                    visibleMessages.map((msg, idx) => {
                      const d = (msg.createdAt as { toDate?: () => Date })?.toDate?.() || new Date();
                      const prevD =
                        idx > 0
                          ? (visibleMessages[idx - 1].createdAt as { toDate?: () => Date })?.toDate?.() ||
                            new Date()
                          : null;
                      const showDateSep = !prevD || d.toDateString() !== prevD.toDateString();

                      return (
                        <React.Fragment key={msg.id}>
                          {showDateSep && (
                            <div className="flex justify-center py-2">
                              <span className="rounded-xl bg-white/90 dark:bg-[#1A262E]/90 px-3 py-1 text-[11px] font-medium text-[#667781] dark:text-[#8696A0] shadow-xs">
                                {formatDateSeparator(d)}
                              </span>
                            </div>
                          )}
                          <ChatMessageBubble
                            message={msg}
                            isOwn={msg.senderId === currentUser.uid}
                            showSenderName={activeChat.type !== 'direct'}
                            currentUserId={currentUser.uid}
                            animateEntrance={
                              initialMessagesLoadedRef.current === activeChat.id &&
                              idx >= visibleMessages.length - 1
                            }
                            fontSizeClass={fontSizeClass}
                            selectionMode={selectionMode}
                            selected={selectedMsgIds.includes(msg.id)}
                            onToggleSelect={() =>
                              setSelectedMsgIds((prev) =>
                                prev.includes(msg.id)
                                  ? prev.filter((id) => id !== msg.id)
                                  : [...prev, msg.id]
                              )
                            }
                            onReply={() => setReplyTo(msg)}
                            onForward={() => setForwardMsg(msg)}
                            onEdit={() => {
                              setEditingMsg(msg);
                              setDraftText(msg.text || '');
                            }}
                            onDeleteForMe={() => deleteMessageForMe(activeChat.id, msg.id, currentUser.uid)}
                            onDeleteForEveryone={() => deleteMessageForEveryone(activeChat.id, msg.id)}
                            onReact={(emoji) => toggleReaction(activeChat.id, msg, emoji, currentUser.uid)}
                            onStar={() => toggleStarMessage(activeChat.id, msg, currentUser.uid)}
                            onPin={() =>
                              updateDoc(doc(db, 'chats', activeChat.id), {
                                pinnedMessageId: msg.id,
                                updatedAt: serverTimestamp(),
                              })
                            }
                            onShowInfo={() => setInfoMsg(msg)}
                            onRemind={() => {
                              const existing = JSON.parse(
                                localStorage.getItem('chitchat_reminders') || '[]'
                              ) as MessageReminder[];
                              existing.push({
                                id: `${msg.id}_${Date.now()}`,
                                chatId: activeChat.id,
                                messageId: msg.id,
                                text: msg.text || msg.type,
                                remindAt: new Date(Date.now() + 60_000).toISOString(),
                              });
                              localStorage.setItem('chitchat_reminders', JSON.stringify(existing));
                              showToast('Reminder set for 1 minute from now.');
                            }}
                            onVotePoll={(optId) => voteOnPoll(activeChat.id, msg, optId, currentUser.uid)}
                            onOpenMedia={(url, type) => setLightboxMedia({ url, type })}
                            onMessageContact={async (uid) => {
                              const dmId = await ensureDirectChat(currentUser.uid, uid);
                              setActiveChatId(dmId);
                            }}
                            friends={friends}
                          />
                        </React.Fragment>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Multi-select action bar */}
                {selectionMode && (
                  <div className="px-4 py-2.5 bg-white dark:bg-[#1A262E] border-t border-[#E7EDE9] dark:border-[#23323B] flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#111B21] dark:text-white">
                      {selectedMsgIds.length} selected
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          selectedMsgIds.forEach((id) =>
                            deleteMessageForMe(activeChat.id, id, currentUser.uid)
                          );
                          setSelectionMode(false);
                          setSelectedMsgIds([]);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-red-500 text-white font-semibold cursor-pointer"
                      >
                        Delete Selected
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectionMode(false);
                          setSelectedMsgIds([]);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Blocked or Announcements-Only Guard OR Composer */}
                {activePeerBlocked ? (
                  <div className="p-3 bg-white dark:bg-[#1A262E] border-t border-[#E7EDE9] dark:border-[#23323B] text-center text-xs text-[#667781]">
                    You blocked this contact. Unblock in Info Drawer or Settings to send messages.
                  </div>
                ) : activeChat.announcementsOnly &&
                  activeChat.ownerId !== currentUser.uid &&
                  !activeChat.adminIds?.includes(currentUser.uid) ? (
                  <div className="p-3 bg-white dark:bg-[#1A262E] border-t border-[#E7EDE9] dark:border-[#23323B] text-center text-xs text-[#667781]">
                    Only admins can send messages in this announcement space.
                  </div>
                ) : (
                  <div className="bg-white dark:bg-[#1A262E] border-t border-[#E7EDE9] dark:border-[#23323B] px-3 py-2.5 space-y-2 relative">
                    {/* Reply / Edit Banner */}
                    {(replyTo || editingMsg) && (
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-[#F4FBF6] dark:bg-[#202C33] px-3 py-2 border border-[#25D366]/40 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#128C7E] dark:text-[#25D366]">
                            {editingMsg
                              ? 'Editing message'
                              : `Replying to ${replyTo?.senderName}`}
                          </p>
                          <p className="truncate text-[#667781]">
                            {editingMsg ? editingMsg.text : replyTo?.text || replyTo?.type}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTo(null);
                            setEditingMsg(null);
                            if (editingMsg) setDraftText('');
                          }}
                          className="p-1 text-[#667781] cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Upload Progress */}
                    {uploadProgress !== null && (
                      <div className="flex items-center gap-2 text-xs text-[#128C7E]">
                        <div className="flex-1 h-1.5 rounded-full bg-[#E7EDE9] overflow-hidden">
                          <div
                            style={{ width: `${uploadProgress}%` }}
                            className="h-full bg-[#25D366] transition-all"
                          />
                        </div>
                        <span className="font-mono-nums">{uploadProgress}%</span>
                      </div>
                    )}

                    {/* Rich Picker Popover */}
                    {pickerOpen && (
                      <div className="absolute bottom-full left-3 mb-2 z-40">
                        <RichPickerPopover
                          uid={currentUser.uid}
                          onSelectEmoji={(em) => setDraftText((t) => `${t}${em}`)}
                          onSelectGif={async (gifUrl, title) => {
                            await sendMessage({
                              chat: activeChat,
                              sender: currentUser,
                              type: 'gif',
                              mediaUrl: gifUrl,
                              mediaName: title,
                            });
                            soundEngine.playSent(notifPrefs);
                          }}
                          onSelectSticker={async (stickerUrl) => {
                            await sendMessage({
                              chat: activeChat,
                              sender: currentUser,
                              type: 'sticker',
                              mediaUrl: stickerUrl,
                            });
                            soundEngine.playSent(notifPrefs);
                          }}
                          onClose={() => setPickerOpen(false)}
                        />
                      </div>
                    )}

                    {/* Attachment Menu */}
                    {attachMenuOpen && (
                      <div className="absolute bottom-full left-12 mb-2 z-40 w-56 rounded-2xl bg-white dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#2A3942] shadow-2xl p-2 space-y-1 text-xs">
                        <label className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer">
                          <ImageIcon className="w-4 h-4 text-[#25D366]" />
                          <span>Photo or Video</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileAttachment(
                                  file,
                                  file.type.startsWith('video/') ? 'video' : 'image'
                                );
                              }
                            }}
                          />
                        </label>
                        <label className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer">
                          <FileText className="w-4 h-4 text-[#128C7E]" />
                          <span>Document (PDF, DOCX, XLSX, TXT)</span>
                          <input
                            type="file"
                            accept=".pdf,.docx,.xlsx,.txt"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileAttachment(file, 'document');
                            }}
                          />
                        </label>
                        <label className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer">
                          <Music className="w-4 h-4 text-emerald-500" />
                          <span>Audio File</span>
                          <input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileAttachment(file, 'audio');
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            setLocationModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
                        >
                          <MapPin className="w-4 h-4 text-rose-500" />
                          <span>Location</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            setContactModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
                        >
                          <UserIcon className="w-4 h-4 text-sky-500" />
                          <span>Contact Card</span>
                        </button>
                        {activeChat.type !== 'direct' && (
                          <button
                            type="button"
                            onClick={() => {
                              setAttachMenuOpen(false);
                              setPollModalOpen(true);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
                          >
                            <BarChart3 className="w-4 h-4 text-amber-500" />
                            <span>Group Poll</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            setScheduleModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
                        >
                          <CalendarClock className="w-4 h-4 text-indigo-500" />
                          <span>Schedule Send</span>
                        </button>
                      </div>
                    )}

                    {/* Composer Row or Voice Recorder Row */}
                    {voiceMode ? (
                      <VoiceRecorderBar
                        onRecordingStateChange={(rec) =>
                          realtimeSocket.sendActivity(
                            activeChat.id,
                            activeChat.participantIds,
                            rec ? 'recording' : 'idle'
                          )
                        }
                        onCancel={() => setVoiceMode(false)}
                        onSendVoice={async (blob, durationSec, waveform) => {
                          const url = await uploadFileToStorage(
                            `chatMedia/${activeChat.id}/${currentUser.uid}/voice_${Date.now()}.webm`,
                            blob
                          );
                          await sendMessage({
                            chat: activeChat,
                            sender: currentUser,
                            type: 'voice',
                            mediaUrl: url,
                            durationSec,
                            waveform,
                            mediaSize: blob.size,
                            mediaMime: blob.type,
                          });
                          soundEngine.playSent(notifPrefs);
                          setVoiceMode(false);
                        }}
                      />
                    ) : (
                      <form onSubmit={(e) => handleSendText(e)} className="flex items-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPickerOpen((o) => !o);
                            setAttachMenuOpen(false);
                          }}
                          className="p-2.5 rounded-xl text-[#667781] hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
                          title="Emoji, GIFs & Stickers"
                        >
                          <Smile className="w-5 h-5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAttachMenuOpen((o) => !o);
                            setPickerOpen(false);
                          }}
                          className="p-2.5 rounded-xl text-[#667781] hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
                          title="Attach media, documents, polls, location"
                        >
                          <Paperclip className="w-5 h-5" />
                        </button>

                        <textarea
                          rows={1}
                          value={draftText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraftText(val);
                            localStorage.setItem(`chitchat_draft_${activeChat.id}`, val);
                            if (currentUser.privacy?.typingIndicators !== false) {
                              realtimeSocket.sendActivity(
                                activeChat.id,
                                activeChat.participantIds,
                                'typing'
                              );
                              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                              typingTimeoutRef.current = window.setTimeout(() => {
                                realtimeSocket.sendActivity(
                                  activeChat.id,
                                  activeChat.participantIds,
                                  'idle'
                                );
                              }, 1800);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendText();
                            }
                          }}
                          placeholder="Type a message..."
                          className="flex-1 max-h-28 rounded-2xl bg-[#F4FBF6] dark:bg-[#202C33] border border-[#E7EDE9] dark:border-[#2A3942] px-4 py-2.5 text-sm text-[#111B21] dark:text-white placeholder:text-[#667781] focus:outline-none focus:border-[#25D366] resize-none"
                        />

                        {draftText.trim() ? (
                          <button
                            type="submit"
                            className="p-2.5 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] transition-colors cursor-pointer shrink-0"
                            title="Send"
                          >
                            <Send className="w-5 h-5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setVoiceMode(true)}
                            className="p-2.5 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] transition-colors cursor-pointer shrink-0"
                            title="Record Voice Note"
                          >
                            <Mic className="w-5 h-5" />
                          </button>
                        )}
                      </form>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* RIGHT INFORMATION DRAWER */}
      {activeChat && (
        <RightInfoDrawer
          open={rightDrawerOpen}
          onClose={() => setRightDrawerOpen(false)}
          chat={activeChat}
          peerUser={activeChatInfo?.peer}
          currentUser={currentUser}
          messages={messages}
          friends={friends}
          membersMap={membersMap}
          isMuted={mutedChatIds.includes(activeChat.id)}
          isBlocked={activePeerBlocked}
          isLocked={lockedChatIds.includes(activeChat.id)}
          onToggleMute={() => handleTogglePrivateList('mutedChatIds', activeChat.id)}
          onToggleBlock={() => {
            if (activeChatInfo?.peer) handleTogglePrivateList('blockedUids', activeChatInfo.peer.uid);
          }}
          onToggleLock={() => handleTogglePrivateList('lockedChatIds', activeChat.id)}
          onReport={() =>
            setReportTarget({
              type: activeChat.type === 'direct' ? 'user' : 'group',
              id: activeChat.type === 'direct' ? activeChatInfo?.peer?.uid || activeChat.id : activeChat.id,
              label: activeChatInfo?.title || 'Chat',
            })
          }
          currentWallpaper={appearance.chatWallpapers?.[activeChat.id] || ''}
          onSetWallpaper={(wp) =>
            updatePrivateSettings(currentUser.uid, {
              appearancePrefs: {
                ...appearance,
                chatWallpapers: { ...(appearance.chatWallpapers || {}), [activeChat.id]: wp },
              },
            })
          }
          onChatDeleted={() => {
            setActiveChatId(null);
            setRightDrawerOpen(false);
          }}
        />
      )}

      {/* MODALS & OVERLAYS */}
      <AddPeopleModal
        open={addPeopleOpen}
        onClose={() => setAddPeopleOpen(false)}
        currentUser={currentUser}
        friends={friends}
        incomingRequests={incomingRequests}
        outgoingRequests={outgoingRequests}
        blockedUids={blockedUids}
        onStartChatWithFriend={async (friendUid) => {
          const dmId = await ensureDirectChat(currentUser.uid, friendUid);
          setActiveChatId(dmId);
          setLeftTab('all');
        }}
        onBlockToggle={(uid) => handleTogglePrivateList('blockedUids', uid)}
        onUsernameUpdated={(u) => showToast(`Username updated to @${u}`)}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentUser={currentUser}
        privateData={privateData}
        friends={friends}
      />

      {createSpaceModal && (
        <CreateSpaceModal
          open={Boolean(createSpaceModal)}
          initialType={createSpaceModal}
          onClose={() => setCreateSpaceModal(null)}
          currentUser={currentUser}
          friends={friends}
          onCreated={(chatId) => {
            setActiveChatId(chatId);
            setLeftTab('all');
          }}
        />
      )}

      <CreatePollModal
        open={pollModalOpen}
        onClose={() => setPollModalOpen(false)}
        onSubmitPoll={async (poll) => {
          if (!activeChat) return;
          await sendMessage({ chat: activeChat, sender: currentUser, type: 'poll', poll });
        }}
      />

      <ScheduleMessageModal
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        onSchedule={(date) => handleSendText(undefined, date)}
      />

      <ShareContactModal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        friends={friends}
        onSelectContact={async (friend) => {
          if (!activeChat) return;
          await sendMessage({
            chat: activeChat,
            sender: currentUser,
            type: 'contact',
            contactCard: {
              uid: friend.uid,
              username: friend.username,
              displayName: friend.displayName,
              photoURL: friend.photoURL,
            },
          });
        }}
      />

      <ShareLocationModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onShareLocation={async (loc) => {
          if (!activeChat) return;
          await sendMessage({
            chat: activeChat,
            sender: currentUser,
            type: 'location',
            location: loc,
          });
        }}
      />

      {/* Forward Message Modal */}
      {forwardMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#23323B] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Forward className="w-4 h-4 text-[#25D366]" />
                <h3 className="font-display font-bold text-base text-[#111B21] dark:text-white">
                  Forward Message
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setForwardMsg(null)}
                className="p-1 text-[#667781] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {chats.map((c) => {
                const info = getChatDisplayInfo(c);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={async () => {
                      await sendMessage({
                        chat: c,
                        sender: currentUser,
                        type: forwardMsg.type,
                        text: forwardMsg.text,
                        mediaUrl: forwardMsg.mediaUrl,
                        mediaName: forwardMsg.mediaName,
                        forwardedFrom: forwardMsg.senderName,
                      });
                      setForwardMsg(null);
                      showToast(`Forwarded to ${info.title}`);
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] text-left cursor-pointer"
                  >
                    <Avatar src={info.avatar} name={info.title} size="sm" />
                    <span className="text-sm font-medium text-[#111B21] dark:text-white truncate">
                      {info.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Message Info Modal */}
      {infoMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#23323B] p-6 shadow-2xl space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-[#111B21] dark:text-white">
                Message Info
              </h3>
              <button type="button" onClick={() => setInfoMsg(null)} className="p-1 text-[#667781] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[#667781]">
              <strong>Sender:</strong> {infoMsg.senderName}
            </p>
            <p className="text-[#667781]">
              <strong>Delivered to:</strong> {(infoMsg.deliveredTo || []).length} participant(s)
            </p>
            <p className="text-[#667781]">
              <strong>Read by:</strong> {(infoMsg.readBy || []).length} participant(s)
            </p>
            <p className="text-[#667781]">
              <strong>Sent at:</strong>{' '}
              {(infoMsg.createdAt as { toDate?: () => Date })?.toDate?.()?.toLocaleString() || 'Now'}
            </p>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await submitReport({
                targetType: reportTarget.type,
                targetId: reportTarget.id,
                reason: reportReason,
                details: reportDetails,
              });
              setReportTarget(null);
              setReportDetails('');
              showToast('Report submitted to CHIT CHAT moderation.');
            }}
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#23323B] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-[#111B21] dark:text-white">
                Report {reportTarget.label}
              </h3>
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="p-1 text-[#667781] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-[#F4FBF6] dark:bg-[#202C33] px-3 py-2 text-xs"
            >
              <option value="Spam or abuse">Spam or abuse</option>
              <option value="Harassment">Harassment</option>
              <option value="Impersonation">Impersonation</option>
              <option value="Inappropriate media">Inappropriate media</option>
            </select>
            <textarea
              rows={3}
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Optional details..."
              className="w-full rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-[#F4FBF6] dark:bg-[#202C33] px-3 py-2 text-xs resize-none"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-red-600 text-white font-semibold py-2.5 text-xs cursor-pointer"
            >
              Submit Report
            </button>
          </form>
        </div>
      )}

      {/* Fullscreen Media Lightbox */}
      {lightboxMedia && (
        <div
          onClick={() => setLightboxMedia(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
        >
          <button
            type="button"
            onClick={() => setLightboxMedia(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxMedia.url}
            alt="Fullscreen preview"
            className="max-h-[90vh] max-w-[92vw] object-contain rounded-xl"
          />
        </div>
      )}

      {/* Real WebRTC Call Overlay */}
      {activeCall && (
        <CallOverlay
          call={activeCall}
          currentUser={currentUser}
          peerUser={
            activeCall.callerId === currentUser.uid
              ? membersMap[activeCall.calleeIds[0]] || null
              : membersMap[activeCall.callerId] || null
          }
          notificationPrefs={notifPrefs}
          onClose={() => setActiveCall(null)}
        />
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 rounded-2xl bg-[#111B21] text-white border border-[#25D366]/50 px-4 py-2.5 text-xs font-medium shadow-xl">
          {toastMsg}
        </div>
      )}
    </div>
  );
};
