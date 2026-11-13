import React, { useState } from 'react';
import {
  X,
  BellOff,
  Bell,
  ShieldBan,
  Flag,
  Star,
  FileText,
  Link as LinkIcon,
  Image as ImageIcon,
  Copy,
  Check,
  UserPlus,
  UserMinus,
  Shield,
  LogOut,
  Trash2,
  Clock,
  Lock,
} from 'lucide-react';
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Chat, Message, UserPublic } from '../types/chitchat';
import { Avatar } from './Avatar';

interface RightInfoDrawerProps {
  open: boolean;
  onClose: () => void;
  chat: Chat;
  peerUser?: UserPublic | null;
  currentUser: UserPublic;
  messages: Message[];
  friends: UserPublic[];
  membersMap: Record<string, UserPublic>;
  isMuted: boolean;
  isBlocked: boolean;
  isLocked: boolean;
  onToggleMute: () => void;
  onToggleBlock: () => void;
  onToggleLock: () => void;
  onReport: () => void;
  onSetWallpaper: (wp: string) => void;
  currentWallpaper: string;
  onChatDeleted: () => void;
}

export const RightInfoDrawer: React.FC<RightInfoDrawerProps> = ({
  open,
  onClose,
  chat,
  peerUser,
  currentUser,
  messages,
  friends,
  membersMap,
  isMuted,
  isBlocked,
  isLocked,
  onToggleMute,
  onToggleBlock,
  onToggleLock,
  onReport,
  onSetWallpaper,
  currentWallpaper,
  onChatDeleted,
}) => {
  const [tab, setTab] = useState<'overview' | 'media' | 'docs' | 'links' | 'starred'>('overview');
  const [copiedInvite, setCopiedInvite] = useState(false);

  if (!open) return null;

  const isGroupLike = chat.type !== 'direct';
  const isOwner = chat.ownerId === currentUser.uid;
  const isAdmin = isOwner || Boolean(chat.adminIds?.includes(currentUser.uid));

  const title = isGroupLike ? chat.name || 'Group Chat' : peerUser?.displayName || 'Conversation';
  const subtitle = isGroupLike
    ? `${chat.participantIds.length} members · ${chat.type}`
    : peerUser
      ? `@${peerUser.username}`
      : '';
  const avatarSrc = isGroupLike ? chat.photoURL : peerUser?.photoURL;

  const mediaMsgs = messages.filter((m) => (m.type === 'image' || m.type === 'video') && m.mediaUrl);
  const docMsgs = messages.filter((m) => m.type === 'document' && m.mediaUrl);
  const linkMsgs = messages.filter(
    (m) => m.type === 'text' && m.text && /https?:\/\/[^\s]+/.test(m.text)
  );
  const starredMsgs = messages.filter((m) => m.starredBy?.includes(currentUser.uid));

  const handleDisappearingChange = async (seconds: number) => {
    await updateDoc(doc(db, 'chats', chat.id), {
      disappearingSeconds: seconds,
      updatedAt: serverTimestamp(),
    });
  };

  const handleAddMember = async (uid: string) => {
    await updateDoc(doc(db, 'chats', chat.id), {
      participantIds: arrayUnion(uid),
      updatedAt: serverTimestamp(),
    });
  };

  const handleRemoveMember = async (uid: string) => {
    await updateDoc(doc(db, 'chats', chat.id), {
      participantIds: arrayRemove(uid),
      adminIds: arrayRemove(uid),
      updatedAt: serverTimestamp(),
    });
  };

  const handleToggleAdmin = async (uid: string) => {
    const currentlyAdmin = Boolean(chat.adminIds?.includes(uid));
    await updateDoc(doc(db, 'chats', chat.id), {
      adminIds: currentlyAdmin ? arrayRemove(uid) : arrayUnion(uid),
      updatedAt: serverTimestamp(),
    });
  };

  const handleLeaveGroup = async () => {
    await updateDoc(doc(db, 'chats', chat.id), {
      participantIds: arrayRemove(currentUser.uid),
      adminIds: arrayRemove(currentUser.uid),
      updatedAt: serverTimestamp(),
    });
    onChatDeleted();
  };

  const handleDeleteGroup = async () => {
    await deleteDoc(doc(db, 'chats', chat.id));
    onChatDeleted();
  };

  return (
    <aside className="w-full sm:w-80 lg:w-84 border-l border-[#E7EDE9] dark:border-[#23323B] bg-white dark:bg-[#111B21] flex flex-col h-full shrink-0">
      <div className="h-16 px-4 border-b border-[#E7EDE9] dark:border-[#23323B] flex items-center justify-between shrink-0">
        <h3 className="font-display font-bold text-sm text-[#111B21] dark:text-white">
          {isGroupLike ? 'Space Info' : 'Contact Info'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-[#667781] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-3 pt-2 flex items-center gap-1 border-b border-[#E7EDE9] dark:border-[#23323B] overflow-x-auto">
        {[
          { id: 'overview', label: 'Info' },
          { id: 'media', label: `Media (${mediaMsgs.length})` },
          { id: 'docs', label: `Docs (${docMsgs.length})` },
          { id: 'links', label: `Links (${linkMsgs.length})` },
          { id: 'starred', label: `Starred (${starredMsgs.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-2.5 py-2 text-[11px] font-semibold border-b-2 whitespace-nowrap cursor-pointer ${
              tab === t.id
                ? 'border-[#25D366] text-[#128C7E] dark:text-[#25D366]'
                : 'border-transparent text-[#667781]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {tab === 'overview' && (
          <>
            <div className="flex flex-col items-center text-center space-y-2 py-2">
              <Avatar src={avatarSrc} name={title} size="xl" />
              <div>
                <h4 className="font-display text-lg font-bold text-[#111B21] dark:text-white">
                  {title}
                </h4>
                <p className="text-xs font-mono-nums text-[#128C7E] dark:text-[#25D366]">
                  {subtitle}
                </p>
              </div>
              {(!isGroupLike ? peerUser?.about : chat.description) && (
                <p className="text-xs text-[#667781] dark:text-[#8696A0] max-w-xs">
                  {isGroupLike ? chat.description : peerUser?.about}
                </p>
              )}
            </div>

            {/* Invite Link for Groups/Channels */}
            {isGroupLike && chat.inviteCode && (
              <div className="rounded-2xl bg-[#F4FBF6] dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#23323B] p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#667781]">Invite Code</p>
                  <p className="text-xs font-mono-nums font-bold text-[#111B21] dark:text-white truncate">
                    {chat.inviteCode}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/?invite=${chat.inviteCode}`
                    );
                    setCopiedInvite(true);
                    setTimeout(() => setCopiedInvite(false), 1800);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#202C33] border border-[#E7EDE9] dark:border-[#2A3942] text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  {copiedInvite ? (
                    <Check className="w-3.5 h-3.5 text-[#25D366]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedInvite ? 'Copied' : 'Link'}</span>
                </button>
              </div>
            )}

            {/* Chat Preferences */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-[#111B21] dark:text-white">
                  <Clock className="w-4 h-4 text-[#128C7E]" />
                  <span>Disappearing Messages</span>
                </span>
                <select
                  value={chat.disappearingSeconds || 0}
                  onChange={(e) => handleDisappearingChange(Number(e.target.value))}
                  className="rounded-lg border border-[#E7EDE9] dark:border-[#2A3942] bg-[#F4FBF6] dark:bg-[#202C33] px-2 py-1 text-xs"
                >
                  <option value={0}>Off</option>
                  <option value={86400}>24 hours</option>
                  <option value={604800}>7 days</option>
                  <option value={7776000}>90 days</option>
                </select>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#111B21] dark:text-white">Chat Wallpaper</span>
                <select
                  value={currentWallpaper}
                  onChange={(e) => onSetWallpaper(e.target.value)}
                  className="rounded-lg border border-[#E7EDE9] dark:border-[#2A3942] bg-[#F4FBF6] dark:bg-[#202C33] px-2 py-1 text-xs"
                >
                  <option value="">Use Global</option>
                  <option value="default">Classic Doodle</option>
                  <option value="green">Light Green</option>
                  <option value="minimal">Minimal White</option>
                  <option value="abstract">Abstract</option>
                  <option value="nature">Nature Mint</option>
                  <option value="gradient">Gradient</option>
                </select>
              </div>
            </div>

            {/* Group Members */}
            {isGroupLike && (
              <div className="space-y-2 pt-2 border-t border-[#E7EDE9] dark:border-[#23323B]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#667781]">
                    Members ({chat.participantIds.length})
                  </span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {chat.participantIds.map((uid) => {
                    const member = membersMap[uid];
                    const memberIsOwner = chat.ownerId === uid;
                    const memberIsAdmin = Boolean(chat.adminIds?.includes(uid));
                    return (
                      <div
                        key={uid}
                        className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-[#F4FBF6]/70 dark:bg-[#1A262E]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar
                            src={member?.photoURL}
                            name={member?.displayName || uid.slice(0, 6)}
                            size="xs"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[#111B21] dark:text-white truncate">
                              {uid === currentUser.uid ? 'You' : member?.displayName || uid}
                            </p>
                            <p className="text-[10px] text-[#128C7E] dark:text-[#25D366]">
                              {memberIsOwner ? 'Owner' : memberIsAdmin ? 'Admin' : 'Member'}
                            </p>
                          </div>
                        </div>
                        {isOwner && uid !== currentUser.uid && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleAdmin(uid)}
                              title="Toggle Admin"
                              className="p-1 text-[#667781] hover:text-[#128C7E] cursor-pointer"
                            >
                              <Shield className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(uid)}
                              title="Remove member"
                              className="p-1 text-[#667781] hover:text-red-500 cursor-pointer"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {isAdmin && (
                  <div className="pt-1">
                    <p className="text-[11px] font-medium text-[#667781] mb-1">
                      Add Friend to {chat.type}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {friends
                        .filter((f) => !chat.participantIds.includes(f.uid))
                        .map((f) => (
                          <button
                            key={f.uid}
                            type="button"
                            onClick={() => handleAddMember(f.uid)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#E7EDE9] dark:border-[#2A3942] px-2 py-1 text-[11px] hover:border-[#25D366] cursor-pointer"
                          >
                            <UserPlus className="w-3 h-3 text-[#25D366]" />
                            <span>{f.displayName}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="space-y-1.5 pt-2 border-t border-[#E7EDE9] dark:border-[#23323B]">
              <button
                type="button"
                onClick={onToggleMute}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#111B21] dark:text-white hover:bg-[#F4FBF6] dark:hover:bg-[#1A262E] cursor-pointer"
              >
                {isMuted ? <Bell className="w-4 h-4 text-[#25D366]" /> : <BellOff className="w-4 h-4 text-[#667781]" />}
                <span>{isMuted ? 'Unmute Notifications' : 'Mute Notifications'}</span>
              </button>

              <button
                type="button"
                onClick={onToggleLock}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#111B21] dark:text-white hover:bg-[#F4FBF6] dark:hover:bg-[#1A262E] cursor-pointer"
              >
                <Lock className="w-4 h-4 text-[#128C7E]" />
                <span>{isLocked ? 'Unlock This Chat' : 'Lock Chat with PIN'}</span>
              </button>

              {!isGroupLike && (
                <button
                  type="button"
                  onClick={onToggleBlock}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                >
                  <ShieldBan className="w-4 h-4" />
                  <span>{isBlocked ? 'Unblock Contact' : 'Block Contact'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onReport}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer"
              >
                <Flag className="w-4 h-4" />
                <span>Report {isGroupLike ? 'Group' : 'User'}</span>
              </button>

              {isGroupLike && !isOwner && (
                <button
                  type="button"
                  onClick={handleLeaveGroup}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Leave {chat.type}</span>
                </button>
              )}

              {isGroupLike && isOwner && (
                <button
                  type="button"
                  onClick={handleDeleteGroup}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete {chat.type}</span>
                </button>
              )}
            </div>
          </>
        )}

        {tab === 'media' && (
          <div className="grid grid-cols-3 gap-2">
            {mediaMsgs.length === 0 ? (
              <p className="col-span-3 text-xs text-[#667781] text-center py-8">
                No shared photos or videos yet.
              </p>
            ) : (
              mediaMsgs.map((m) => (
                <a
                  key={m.id}
                  href={m.mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square rounded-xl overflow-hidden bg-[#F4FBF6] dark:bg-[#202C33]"
                >
                  {m.type === 'image' ? (
                    <img src={m.mediaUrl} alt="Shared" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-[#128C7E]" />
                    </div>
                  )}
                </a>
              ))
            )}
          </div>
        )}

        {tab === 'docs' && (
          <div className="space-y-2">
            {docMsgs.length === 0 ? (
              <p className="text-xs text-[#667781] text-center py-8">No shared documents.</p>
            ) : (
              docMsgs.map((m) => (
                <a
                  key={m.id}
                  href={m.mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-2.5 rounded-xl border border-[#E7EDE9] dark:border-[#23323B] text-xs"
                >
                  <FileText className="w-4 h-4 text-[#128C7E] shrink-0" />
                  <span className="truncate">{m.mediaName || 'Document'}</span>
                </a>
              ))
            )}
          </div>
        )}

        {tab === 'links' && (
          <div className="space-y-2">
            {linkMsgs.length === 0 ? (
              <p className="text-xs text-[#667781] text-center py-8">No shared links.</p>
            ) : (
              linkMsgs.map((m) => (
                <div
                  key={m.id}
                  className="p-2.5 rounded-xl border border-[#E7EDE9] dark:border-[#23323B] text-xs space-y-1"
                >
                  <div className="flex items-center gap-1.5 text-[#128C7E] dark:text-[#25D366]">
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span className="font-semibold">{m.senderName}</span>
                  </div>
                  <p className="break-all text-[#667781] dark:text-[#8696A0]">{m.text}</p>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'starred' && (
          <div className="space-y-2">
            {starredMsgs.length === 0 ? (
              <p className="text-xs text-[#667781] text-center py-8">No starred messages.</p>
            ) : (
              starredMsgs.map((m) => (
                <div
                  key={m.id}
                  className="p-2.5 rounded-xl border border-[#E7EDE9] dark:border-[#23323B] text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#128C7E]">{m.senderName}</span>
                    <Star className="w-3 h-3 text-amber-500" fill="currentColor" />
                  </div>
                  <p className="text-[#111B21] dark:text-white">{m.text || m.type}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
