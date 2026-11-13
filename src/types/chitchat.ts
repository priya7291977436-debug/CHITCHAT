export type PrivacyVisibility = 'everyone' | 'contacts' | 'nobody';

export interface UserPrivacySettings {
  lastSeen: PrivacyVisibility;
  onlineStatus: PrivacyVisibility;
  profilePhoto: PrivacyVisibility;
  about: PrivacyVisibility;
  status: PrivacyVisibility;
  readReceipts: boolean;
  typingIndicators: boolean;
}

export interface UserPublic {
  uid: string;
  username: string;
  displayName: string;
  photoURL?: string;
  about?: string;
  presence: 'online' | 'offline' | 'busy' | 'in_call';
  lastSeen?: unknown;
  privacy?: UserPrivacySettings;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AppearancePrefs {
  theme: 'light' | 'dark' | 'system';
  globalWallpaper: string;
  customWallpaperUrl?: string;
  chatWallpapers: Record<string, string>;
  bubbleStyle: 'emerald' | 'ocean' | 'slate' | 'forest';
  fontSize: 'small' | 'medium' | 'large';
}

export interface NotificationPrefs {
  soundEnabled: boolean;
  volume: number;
  desktopAlerts: boolean;
  showPreviews: boolean;
  sentSound: boolean;
  receivedSound: boolean;
  ringtoneEnabled: boolean;
  soundPack: 'chime' | 'drop' | 'crystal';
}

export interface LinkedDevice {
  id: string;
  label: string;
  platform: string;
  lastActiveAt: string;
}

export interface UserPrivate {
  uid: string;
  email?: string;
  phoneE164?: string;
  twoStepPinHash?: string;
  chatLockPinHash?: string;
  blockedUids?: string[];
  archivedChatIds?: string[];
  pinnedChatIds?: string[];
  mutedChatIds?: string[];
  lockedChatIds?: string[];
  appearancePrefs?: AppearancePrefs;
  notificationPrefs?: NotificationPrefs;
  devices?: LinkedDevice[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  toUid: string;
  fromUsername: string;
  fromDisplayName: string;
  fromPhotoURL?: string;
  toUsername: string;
  toDisplayName: string;
  toPhotoURL?: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Friendship {
  id: string;
  user1: string;
  user2: string;
  users: string[];
  createdAt?: unknown;
}

export type ChatType = 'direct' | 'group' | 'channel' | 'community' | 'broadcast';

export interface Chat {
  id: string;
  type: ChatType;
  name?: string;
  description?: string;
  photoURL?: string;
  ownerId: string;
  participantIds: string[];
  adminIds?: string[];
  isPublic?: boolean;
  announcementsOnly?: boolean;
  inviteCode?: string;
  communityId?: string;
  lastMessageText?: string;
  lastMessageSenderId?: string;
  lastMessageAt?: unknown;
  pinnedMessageId?: string;
  disappearingSeconds?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'document'
  | 'voice'
  | 'audio'
  | 'gif'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'poll'
  | 'system';

export interface PollOption {
  id: string;
  text: string;
  voterIds: string[];
}

export interface MessagePoll {
  question: string;
  allowMultiple: boolean;
  options: PollOption[];
}

export interface MessageLocation {
  lat: number;
  lng: number;
  label?: string;
  isLive?: boolean;
}

export interface MessageContactCard {
  uid: string;
  username: string;
  displayName: string;
  photoURL?: string;
}

export interface ReplyReference {
  messageId: string;
  senderId: string;
  senderName: string;
  type: MessageType;
  text: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
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
  reactions?: Record<string, string[]>;
  starredBy?: string[];
  deletedFor?: string[];
  deletedForEveryone?: boolean;
  readBy?: string[];
  deliveredTo?: string[];
  editedAt?: unknown;
  scheduledFor?: unknown;
  expiresAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  pendingLocal?: boolean;
}

export interface StatusUpdate {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerUsername?: string;
  ownerPhotoURL?: string;
  type: 'text' | 'image' | 'video';
  text?: string;
  bgColor?: string;
  mediaUrl?: string;
  caption?: string;
  allowedUids: string[];
  views?: Array<{ uid: string; name: string; viewedAt: string }>;
  reactions?: Array<{ uid: string; emoji: string; at: string }>;
  expiresAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CallSession {
  id: string;
  callerId: string;
  callerName: string;
  callerPhotoURL?: string;
  calleeIds: string[];
  chatId: string;
  callType: 'audio' | 'video';
  mode: 'direct' | 'group';
  status: 'ringing' | 'connected' | 'ended' | 'declined' | 'missed';
  offer?: { type: string; sdp: string };
  answer?: { type: string; sdp: string };
  startedAt?: unknown;
  endedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NotificationItem {
  id: string;
  recipientUid: string;
  senderUid: string;
  senderName?: string;
  type:
    | 'message'
    | 'friend_request'
    | 'friend_accepted'
    | 'call'
    | 'missed_call'
    | 'group_invite'
    | 'reaction'
    | 'reply'
    | 'status';
  title: string;
  body?: string;
  refId?: string;
  read: boolean;
  createdAt?: unknown;
}

export interface MessageReminder {
  id: string;
  chatId: string;
  messageId: string;
  text: string;
  remindAt: string;
}
