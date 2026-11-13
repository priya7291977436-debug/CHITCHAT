import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  runTransaction,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  UserPublic,
  UserPrivate,
  FriendRequest,
  Chat,
  Message,
  MessageType,
  AppearancePrefs,
  NotificationPrefs,
  UserPrivacySettings,
  MessagePoll,
  MessageLocation,
  MessageContactCard,
  ReplyReference,
} from '../types/chitchat';

export const DEFAULT_PRIVACY: UserPrivacySettings = {
  lastSeen: 'everyone',
  onlineStatus: 'everyone',
  profilePhoto: 'everyone',
  about: 'everyone',
  status: 'contacts',
  readReceipts: true,
  typingIndicators: true,
};

export const DEFAULT_APPEARANCE: AppearancePrefs = {
  theme: 'light',
  globalWallpaper: 'default',
  chatWallpapers: {},
  bubbleStyle: 'emerald',
  fontSize: 'medium',
};

export const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  soundEnabled: true,
  volume: 0.65,
  desktopAlerts: true,
  showPreviews: true,
  sentSound: true,
  receivedSound: true,
  ringtoneEnabled: true,
  soundPack: 'chime',
};

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_]/g, '');
}

export function isValidUsernameFormat(username: string): boolean {
  return /^[a-z0-9_]{3,24}$/.test(username);
}

export function getDirectChatId(uidA: string, uidB: string): string {
  return uidA < uidB ? `dm_${uidA}_${uidB}` : `dm_${uidB}_${uidA}`;
}

export function getFriendshipId(uidA: string, uidB: string): string {
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createCompleteUserProfile(params: {
  uid: string;
  username: string;
  displayName: string;
  about?: string;
  photoURL?: string;
  email?: string;
  phoneE164?: string;
}) {
  const cleanUsername = normalizeUsername(params.username);
  if (!isValidUsernameFormat(cleanUsername)) {
    throw new Error('Username must be 3–24 characters using lowercase letters, numbers, or underscores.');
  }
  const cleanDisplay = params.displayName.trim().slice(0, 64);
  if (!cleanDisplay) {
    throw new Error('Display name is required.');
  }

  const usernameRef = doc(db, 'usernames', cleanUsername);
  const publicRef = doc(db, 'usersPublic', params.uid);
  const privateRef = doc(db, 'usersPrivate', params.uid);

  const deviceInfo = {
    id: `web_${navigator.userAgent.slice(0, 12).replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`,
    label: navigator.platform || 'Web Browser',
    platform: /mobile|android|iphone|ipad/i.test(navigator.userAgent) ? 'Mobile Web' : 'Desktop Web',
    lastActiveAt: new Date().toISOString(),
  };

  try {
    await runTransaction(db, async (tx) => {
      const existingClaim = await tx.get(usernameRef);
      if (existingClaim.exists() && existingClaim.data().uid !== params.uid) {
        throw new Error('USERNAME_TAKEN');
      }

      const usernamePayload: Record<string, unknown> = {
        uid: params.uid,
        username: cleanUsername,
        displayName: cleanDisplay,
        updatedAt: serverTimestamp(),
      };
      if (params.photoURL) usernamePayload.photoURL = params.photoURL.slice(0, 2048);

      const publicPayload: Record<string, unknown> = {
        uid: params.uid,
        username: cleanUsername,
        displayName: cleanDisplay,
        about: (params.about || 'Hey there! I am using CHIT CHAT.').slice(0, 200),
        presence: 'online',
        lastSeen: serverTimestamp(),
        privacy: DEFAULT_PRIVACY,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (params.photoURL) publicPayload.photoURL = params.photoURL.slice(0, 2048);

      const privatePayload: Record<string, unknown> = {
        uid: params.uid,
        blockedUids: [],
        archivedChatIds: [],
        pinnedChatIds: [],
        mutedChatIds: [],
        lockedChatIds: [],
        appearancePrefs: DEFAULT_APPEARANCE,
        notificationPrefs: DEFAULT_NOTIFICATIONS,
        devices: [deviceInfo],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (params.email) privatePayload.email = params.email.slice(0, 254);
      if (params.phoneE164) privatePayload.phoneE164 = params.phoneE164.slice(0, 20);

      tx.set(usernameRef, usernamePayload);
      tx.set(publicRef, publicPayload);
      tx.set(privateRef, privatePayload);
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'USERNAME_TAKEN') {
      throw new Error(`@${cleanUsername} is already taken. Please choose another username.`);
    }
    handleFirestoreError(err, OperationType.WRITE, `usersPublic/${params.uid}`);
  }
}

export async function swapUsername(uid: string, oldUsername: string, newUsername: string, displayName: string, photoURL?: string) {
  const cleanNew = normalizeUsername(newUsername);
  const cleanOld = normalizeUsername(oldUsername);
  if (!isValidUsernameFormat(cleanNew)) {
    throw new Error('Username must be 3–24 characters using lowercase letters, numbers, or underscores.');
  }
  if (cleanNew === cleanOld) return cleanNew;

  const newRef = doc(db, 'usernames', cleanNew);
  const oldRef = doc(db, 'usernames', cleanOld);
  const publicRef = doc(db, 'usersPublic', uid);

  try {
    await runTransaction(db, async (tx) => {
      const claimSnap = await tx.get(newRef);
      if (claimSnap.exists() && claimSnap.data().uid !== uid) {
        throw new Error('USERNAME_TAKEN');
      }
      const newClaim: Record<string, unknown> = {
        uid,
        username: cleanNew,
        displayName: displayName.slice(0, 64),
        updatedAt: serverTimestamp(),
      };
      if (photoURL) newClaim.photoURL = photoURL.slice(0, 2048);

      tx.set(newRef, newClaim);
      if (cleanOld) tx.delete(oldRef);
      tx.update(publicRef, {
        username: cleanNew,
        updatedAt: serverTimestamp(),
      });
    });
    return cleanNew;
  } catch (err) {
    if (err instanceof Error && err.message === 'USERNAME_TAKEN') {
      throw new Error(`@${cleanNew} is already taken.`);
    }
    handleFirestoreError(err, OperationType.UPDATE, `usernames/${cleanNew}`);
  }
}

export async function updatePresence(uid: string, presence: 'online' | 'offline' | 'busy' | 'in_call') {
  try {
    await updateDoc(doc(db, 'usersPublic', uid), {
      presence,
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Presence updates may fail during signout or before profile exists
  }
}

export async function updatePublicProfile(
  uid: string,
  username: string,
  updates: Partial<Pick<UserPublic, 'displayName' | 'about' | 'photoURL' | 'privacy'>>
) {
  const cleanUpdates: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (updates.displayName !== undefined) cleanUpdates.displayName = updates.displayName.trim().slice(0, 64);
  if (updates.about !== undefined) cleanUpdates.about = updates.about.trim().slice(0, 200);
  if (updates.photoURL !== undefined) cleanUpdates.photoURL = updates.photoURL.slice(0, 2048);
  if (updates.privacy !== undefined) cleanUpdates.privacy = updates.privacy;

  try {
    await updateDoc(doc(db, 'usersPublic', uid), cleanUpdates);
    if (username && (updates.displayName !== undefined || updates.photoURL !== undefined)) {
      const claimUpdates: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (updates.displayName !== undefined) claimUpdates.displayName = cleanUpdates.displayName;
      if (updates.photoURL !== undefined) claimUpdates.photoURL = cleanUpdates.photoURL;
      await updateDoc(doc(db, 'usernames', normalizeUsername(username)), claimUpdates);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `usersPublic/${uid}`);
  }
}

export async function updatePrivateSettings(uid: string, updates: Partial<UserPrivate>) {
  try {
    await updateDoc(doc(db, 'usersPrivate', uid), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `usersPrivate/${uid}`);
  }
}

export async function findUserByExactUsername(rawUsername: string): Promise<UserPublic | null> {
  const clean = normalizeUsername(rawUsername);
  if (!isValidUsernameFormat(clean)) return null;

  try {
    const claimSnap = await getDoc(doc(db, 'usernames', clean));
    if (!claimSnap.exists()) return null;
    const claim = claimSnap.data() as { uid: string; username: string; displayName: string; photoURL?: string };
    const pubSnap = await getDoc(doc(db, 'usersPublic', claim.uid));
    if (pubSnap.exists()) {
      return pubSnap.data() as UserPublic;
    }
    return {
      uid: claim.uid,
      username: claim.username,
      displayName: claim.displayName,
      photoURL: claim.photoURL,
      presence: 'offline',
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `usernames/${clean}`);
  }
}

export async function sendFriendRequest(fromUser: UserPublic, toUser: UserPublic) {
  if (fromUser.uid === toUser.uid) {
    throw new Error('You cannot send a friend request to yourself.');
  }
  const fId = getFriendshipId(fromUser.uid, toUser.uid);
  const existingFriend = await getDoc(doc(db, 'friendships', fId));
  if (existingFriend.exists()) {
    throw new Error(`You are already friends with @${toUser.username}.`);
  }

  const reqId = `${fromUser.uid}_${toUser.uid}`;
  const reverseReqId = `${toUser.uid}_${fromUser.uid}`;
  const reverseSnap = await getDoc(doc(db, 'friendRequests', reverseReqId));
  if (reverseSnap.exists() && reverseSnap.data().status === 'pending') {
    throw new Error(`@${toUser.username} already sent you a friend request. Check your incoming requests!`);
  }

  const reqRef = doc(db, 'friendRequests', reqId);
  const existingReq = await getDoc(reqRef);
  if (existingReq.exists() && existingReq.data().status === 'pending') {
    throw new Error('Friend request already sent.');
  }

  const payload: Record<string, unknown> = {
    fromUid: fromUser.uid,
    toUid: toUser.uid,
    fromUsername: fromUser.username,
    fromDisplayName: fromUser.displayName,
    toUsername: toUser.username,
    toDisplayName: toUser.displayName,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (fromUser.photoURL) payload.fromPhotoURL = fromUser.photoURL;
  if (toUser.photoURL) payload.toPhotoURL = toUser.photoURL;

  try {
    await setDoc(reqRef, payload);
    await addDoc(collection(db, 'notifications'), {
      recipientUid: toUser.uid,
      senderUid: fromUser.uid,
      senderName: fromUser.displayName,
      type: 'friend_request',
      title: 'New Friend Request',
      body: `${fromUser.displayName} (@${fromUser.username}) wants to connect on CHIT CHAT.`,
      refId: reqId,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `friendRequests/${reqId}`);
  }
}

export async function respondToFriendRequest(
  req: FriendRequest,
  action: 'accepted' | 'declined' | 'cancelled',
  currentUser: UserPublic
) {
  const reqRef = doc(db, 'friendRequests', req.id);
  try {
    if (action === 'accepted') {
      const fId = getFriendshipId(req.fromUid, req.toUid);
      const chatId = getDirectChatId(req.fromUid, req.toUid);
      const user1 = req.fromUid < req.toUid ? req.fromUid : req.toUid;
      const user2 = req.fromUid < req.toUid ? req.toUid : req.fromUid;

      await runTransaction(db, async (tx) => {
        const reqSnap = await tx.get(reqRef);
        if (!reqSnap.exists() || reqSnap.data().status !== 'pending') {
          throw new Error('Friend request is no longer pending.');
        }
        const chatSnap = await tx.get(doc(db, 'chats', chatId));
        tx.update(reqRef, { status: 'accepted', updatedAt: serverTimestamp() });
        tx.set(doc(db, 'friendships', fId), {
          user1,
          user2,
          users: [user1, user2],
          createdAt: serverTimestamp(),
        });
        if (!chatSnap.exists()) {
          tx.set(doc(db, 'chats', chatId), {
            type: 'direct',
            ownerId: currentUser.uid,
            participantIds: [user1, user2],
            lastMessageText: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      });

      await addDoc(collection(db, 'notifications'), {
        recipientUid: req.fromUid,
        senderUid: currentUser.uid,
        senderName: currentUser.displayName,
        type: 'friend_accepted',
        title: 'Friend Request Accepted',
        body: `${currentUser.displayName} (@${currentUser.username}) accepted your friend request.`,
        refId: chatId,
        read: false,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(reqRef, {
        status: action,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `friendRequests/${req.id}`);
  }
}

export async function removeFriend(uidA: string, uidB: string) {
  const fId = getFriendshipId(uidA, uidB);
  try {
    await deleteDoc(doc(db, 'friendships', fId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `friendships/${fId}`);
  }
}

export async function ensureDirectChat(currentUid: string, friendUid: string): Promise<string> {
  const chatId = getDirectChatId(currentUid, friendUid);
  const chatRef = doc(db, 'chats', chatId);
  try {
    const snap = await getDoc(chatRef);
    if (!snap.exists()) {
      const user1 = currentUid < friendUid ? currentUid : friendUid;
      const user2 = currentUid < friendUid ? friendUid : currentUid;
      await setDoc(chatRef, {
        type: 'direct',
        ownerId: currentUid,
        participantIds: [user1, user2],
        lastMessageText: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return chatId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `chats/${chatId}`);
  }
}

export async function createGroupOrCommunityChat(params: {
  type: 'group' | 'channel' | 'community' | 'broadcast';
  name: string;
  description?: string;
  ownerId: string;
  participantIds: string[];
  isPublic?: boolean;
  announcementsOnly?: boolean;
  photoURL?: string;
  communityId?: string;
}): Promise<string> {
  const uniqueParticipants = Array.from(new Set([params.ownerId, ...params.participantIds])).slice(0, 100);
  const inviteCode = Math.random().toString(36).slice(2, 10).toUpperCase();
  const payload: Record<string, unknown> = {
    type: params.type,
    name: params.name.trim().slice(0, 100),
    description: (params.description || '').trim().slice(0, 500),
    ownerId: params.ownerId,
    participantIds: uniqueParticipants,
    adminIds: [params.ownerId],
    isPublic: Boolean(params.isPublic),
    announcementsOnly: Boolean(params.announcementsOnly),
    inviteCode,
    lastMessageText: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (params.photoURL) payload.photoURL = params.photoURL.slice(0, 2048);
  if (params.communityId) payload.communityId = params.communityId;

  try {
    const docRef = await addDoc(collection(db, 'chats'), payload);
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'chats');
  }
}

export async function sendMessage(params: {
  chat: Chat;
  sender: UserPublic;
  type: MessageType;
  text?: string;
  mediaUrl?: string;
  mediaName?: string;
  mediaMime?: string;
  mediaSize?: number;
  durationSec?: number;
  waveform?: number[];
  location?: MessageLocation;
  contactCard?: MessageContactCard;
  poll?: MessagePoll;
  replyTo?: ReplyReference;
  forwardedFrom?: string;
  scheduledFor?: Date;
}) {
  const { chat, sender } = params;
  const msgPayload: Record<string, unknown> = {
    senderId: sender.uid,
    senderName: sender.displayName.slice(0, 64),
    type: params.type,
    participantIds: chat.participantIds.slice(0, 100),
    isPublic: Boolean(chat.isPublic),
    reactions: {},
    starredBy: [],
    deletedFor: [],
    deletedForEveryone: false,
    readBy: [sender.uid],
    deliveredTo: [sender.uid],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (params.text !== undefined) msgPayload.text = params.text.slice(0, 4000);
  if (params.mediaUrl) msgPayload.mediaUrl = params.mediaUrl.slice(0, 2048);
  if (params.mediaName) msgPayload.mediaName = params.mediaName.slice(0, 255);
  if (params.mediaMime) msgPayload.mediaMime = params.mediaMime.slice(0, 120);
  if (params.mediaSize !== undefined) msgPayload.mediaSize = Math.round(params.mediaSize);
  if (params.durationSec !== undefined) msgPayload.durationSec = Number(params.durationSec);
  if (params.waveform) msgPayload.waveform = params.waveform.slice(0, 120);
  if (params.location) msgPayload.location = params.location;
  if (params.contactCard) msgPayload.contactCard = params.contactCard;
  if (params.poll) msgPayload.poll = params.poll;
  if (params.replyTo) msgPayload.replyTo = params.replyTo;
  if (params.forwardedFrom) msgPayload.forwardedFrom = params.forwardedFrom.slice(0, 64);
  if (params.scheduledFor) msgPayload.scheduledFor = Timestamp.fromDate(params.scheduledFor);
  if (chat.disappearingSeconds && chat.disappearingSeconds > 0) {
    msgPayload.expiresAt = Timestamp.fromDate(new Date(Date.now() + chat.disappearingSeconds * 1000));
  }

  const previewText =
    params.type === 'text'
      ? (params.text || '').slice(0, 120)
      : params.type === 'voice'
        ? 'Voice message'
        : params.type === 'image'
          ? 'Photo'
          : params.type === 'video'
            ? 'Video'
            : params.type === 'gif'
              ? 'GIF'
              : params.type === 'sticker'
                ? 'Sticker'
                : params.type === 'location'
                  ? 'Location'
                  : params.type === 'contact'
                    ? 'Contact card'
                    : params.type === 'poll'
                      ? `Poll: ${params.poll?.question || ''}`
                      : params.mediaName || 'Attachment';

  try {
    const msgRef = await addDoc(collection(db, 'chats', chat.id, 'messages'), msgPayload);
    if (!params.scheduledFor || params.scheduledFor.getTime() <= Date.now()) {
      await updateDoc(doc(db, 'chats', chat.id), {
        lastMessageText: previewText.slice(0, 500),
        lastMessageSenderId: sender.uid,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return msgRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `chats/${chat.id}/messages`);
  }
}

export async function toggleReaction(chatId: string, msg: Message, emoji: string, uid: string) {
  const reactions = { ...(msg.reactions || {}) };
  const users = new Set(reactions[emoji] || []);
  if (users.has(uid)) {
    users.delete(uid);
  } else {
    users.add(uid);
  }
  if (users.size === 0) {
    delete reactions[emoji];
  } else {
    reactions[emoji] = Array.from(users).slice(0, 50);
  }
  try {
    await updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), {
      reactions,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}/messages/${msg.id}`);
  }
}

export async function toggleStarMessage(chatId: string, msg: Message, uid: string) {
  const starred = Boolean(msg.starredBy?.includes(uid));
  try {
    await updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), {
      starredBy: starred ? arrayRemove(uid) : arrayUnion(uid),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}/messages/${msg.id}`);
  }
}

export async function editMessageText(chatId: string, messageId: string, newText: string) {
  try {
    await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
      text: newText.trim().slice(0, 4000),
      editedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}/messages/${messageId}`);
  }
}

export async function deleteMessageForMe(chatId: string, messageId: string, uid: string) {
  try {
    await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
      deletedFor: arrayUnion(uid),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}/messages/${messageId}`);
  }
}

export async function deleteMessageForEveryone(chatId: string, messageId: string) {
  try {
    await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
      text: 'This message was deleted',
      deletedForEveryone: true,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}/messages/${messageId}`);
  }
}

export async function markMessageRead(chatId: string, msg: Message, uid: string) {
  if (msg.senderId === uid || msg.readBy?.includes(uid)) return;
  try {
    await updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), {
      readBy: arrayUnion(uid),
      deliveredTo: arrayUnion(uid),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal background receipt sync
  }
}

export async function voteOnPoll(chatId: string, msg: Message, optionId: string, uid: string) {
  if (!msg.poll) return;
  const nextOptions = msg.poll.options.map((opt) => {
    const voters = new Set(opt.voterIds || []);
    if (opt.id === optionId) {
      if (voters.has(uid)) voters.delete(uid);
      else voters.add(uid);
    } else if (!msg.poll!.allowMultiple) {
      voters.delete(uid);
    }
    return { ...opt, voterIds: Array.from(voters) };
  });
  try {
    await updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), {
      poll: { ...msg.poll, options: nextOptions },
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}/messages/${msg.id}`);
  }
}

export async function createStatusUpdate(params: {
  owner: UserPublic;
  type: 'text' | 'image' | 'video';
  text?: string;
  bgColor?: string;
  mediaUrl?: string;
  caption?: string;
  allowedUids: string[];
}) {
  const allowed = Array.from(new Set([params.owner.uid, ...params.allowedUids])).slice(0, 200);
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const payload: Record<string, unknown> = {
    ownerId: params.owner.uid,
    ownerName: params.owner.displayName.slice(0, 64),
    ownerUsername: params.owner.username,
    type: params.type,
    allowedUids: allowed,
    views: [],
    reactions: [],
    expiresAt,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (params.owner.photoURL) payload.ownerPhotoURL = params.owner.photoURL;
  if (params.text) payload.text = params.text.slice(0, 700);
  if (params.bgColor) payload.bgColor = params.bgColor.slice(0, 32);
  if (params.mediaUrl) payload.mediaUrl = params.mediaUrl.slice(0, 2048);
  if (params.caption) payload.caption = params.caption.slice(0, 300);

  try {
    await addDoc(collection(db, 'statuses'), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'statuses');
  }
}

export async function submitReport(params: {
  targetType: 'user' | 'message' | 'group';
  targetId: string;
  reason: string;
  details?: string;
}) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Must be signed in to submit a report.');
  try {
    await addDoc(collection(db, 'reports'), {
      reporterUid: uid,
      targetType: params.targetType,
      targetId: params.targetId.slice(0, 256),
      reason: params.reason.slice(0, 120),
      details: (params.details || '').slice(0, 1000),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'reports');
  }
}

export async function deleteAccountData(uid: string, username: string) {
  try {
    if (username) {
      await deleteDoc(doc(db, 'usernames', normalizeUsername(username)));
    }
    await deleteDoc(doc(db, 'usersPublic', uid));
    await deleteDoc(doc(db, 'usersPrivate', uid));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `usersPublic/${uid}`);
  }
}
