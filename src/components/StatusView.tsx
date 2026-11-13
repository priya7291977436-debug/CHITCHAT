import React, { useEffect, useState } from 'react';
import {
  Plus,
  X,
  Eye,
  Trash2,
  Send,
  Image as ImageIcon,
  Type,
  VolumeX,
  Loader2,
} from 'lucide-react';
import {
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { StatusUpdate, UserPublic } from '../types/chitchat';
import { Avatar } from './Avatar';
import { createStatusUpdate } from '../services/chitchatDb';
import { compressImageFile, uploadFileToStorage } from '../utils/media';

interface StatusViewProps {
  currentUser: UserPublic;
  friends: UserPublic[];
  statuses: StatusUpdate[];
  onReplyToStatus: (ownerUid: string, text: string) => void;
}

const BG_SWATCHES = ['#128C7E', '#111B21', '#25D366', '#1E3A8A', '#7C2D12', '#4C1D95'];
const MUTED_STATUS_KEY = 'chitchat_muted_statuses';

export const StatusView: React.FC<StatusViewProps> = ({
  currentUser,
  friends,
  statuses,
  onReplyToStatus,
}) => {
  const [composerOpen, setComposerOpen] = useState(false);
  const [statusType, setStatusType] = useState<'text' | 'image' | 'video'>('text');
  const [textContent, setTextContent] = useState('');
  const [bgColor, setBgColor] = useState(BG_SWATCHES[0]);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [privacyMode, setPrivacyMode] = useState<'all' | 'only'>('all');
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

  const [viewingGroup, setViewingGroup] = useState<StatusUpdate[] | null>(null);
  const [viewIndex, setViewIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState('');

  const [mutedOwners, setMutedOwners] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(MUTED_STATUS_KEY) || '[]');
    } catch {
      return [];
    }
  });

  // Filter non-expired statuses
  const nowMs = Date.now();
  const activeStatuses = statuses.filter((st) => {
    const exp = st.expiresAt as { toMillis?: () => number } | undefined;
    if (exp?.toMillis && exp.toMillis() < nowMs) return false;
    return !mutedOwners.includes(st.ownerId);
  });

  const myStatuses = activeStatuses.filter((s) => s.ownerId === currentUser.uid);
  const friendStatusesMap = new Map<string, StatusUpdate[]>();
  activeStatuses
    .filter((s) => s.ownerId !== currentUser.uid)
    .forEach((s) => {
      const list = friendStatusesMap.get(s.ownerId) || [];
      list.push(s);
      friendStatusesMap.set(s.ownerId, list);
    });

  // Auto-advance status viewer progress bar
  useEffect(() => {
    if (!viewingGroup || paused) return;
    const current = viewingGroup[viewIndex];
    if (!current) return;

    // Record view if not owner
    if (
      current.ownerId !== currentUser.uid &&
      !current.views?.some((v) => v.uid === currentUser.uid)
    ) {
      updateDoc(doc(db, 'statuses', current.id), {
        views: arrayUnion({
          uid: currentUser.uid,
          name: currentUser.displayName,
          viewedAt: new Date().toISOString(),
        }),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }

    setProgress(0);
    const duration = current.type === 'video' ? 12000 : 5500;
    const step = 60;
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        const next = prev + (step / duration) * 100;
        if (next >= 100) {
          if (viewIndex < viewingGroup.length - 1) {
            setViewIndex((i) => i + 1);
            return 0;
          } else {
            setViewingGroup(null);
            return 100;
          }
        }
        return next;
      });
    }, step);
    return () => clearInterval(timer);
  }, [viewingGroup, viewIndex, paused]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishing(true);
    try {
      const allowedUids =
        privacyMode === 'all' ? friends.map((f) => f.uid) : selectedFriendIds;
      let mediaUrl: string | undefined;
      if (statusType !== 'text' && mediaFile) {
        const toUpload =
          statusType === 'image' ? await compressImageFile(mediaFile, 1280, 0.85) : mediaFile;
        mediaUrl = await uploadFileToStorage(
          `statuses/${currentUser.uid}/st_${Date.now()}_${toUpload.name}`,
          toUpload
        );
      }
      await createStatusUpdate({
        owner: currentUser,
        type: statusType,
        text: statusType === 'text' ? textContent : undefined,
        bgColor: statusType === 'text' ? bgColor : undefined,
        mediaUrl,
        caption: caption.trim() || undefined,
        allowedUids,
      });
      setComposerOpen(false);
      setTextContent('');
      setMediaFile(null);
      setCaption('');
    } finally {
      setPublishing(false);
    }
  };

  const activeStory = viewingGroup?.[viewIndex];

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5">
      {/* My Status Card */}
      <div className="rounded-2xl border border-[#E7EDE9] dark:border-[#23323B] bg-white dark:bg-[#1A262E] p-3.5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (myStatuses.length > 0) {
              setViewingGroup(myStatuses);
              setViewIndex(0);
            } else {
              setComposerOpen(true);
            }
          }}
          className="flex items-center gap-3 text-left flex-1 min-w-0 cursor-pointer"
        >
          <Avatar
            src={currentUser.photoURL}
            name={currentUser.displayName}
            size="md"
            hasUnseenStatus={myStatuses.length > 0}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#111B21] dark:text-white truncate">
              My Status
            </p>
            <p className="text-xs text-[#667781] dark:text-[#8696A0]">
              {myStatuses.length > 0
                ? `${myStatuses.length} active update${myStatuses.length > 1 ? 's' : ''} (24h)`
                : 'Tap to post a 24h status update'}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="w-9 h-9 rounded-full bg-[#25D366] text-[#111B21] flex items-center justify-center shrink-0 hover:bg-[#20bd5a] cursor-pointer"
          title="Add status update"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Friend Updates */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-[#667781] dark:text-[#8696A0] px-1">
          Recent Updates
        </h3>
        {friendStatusesMap.size === 0 ? (
          <p className="text-xs text-[#667781] dark:text-[#8696A0] text-center py-8">
            No status updates from your contacts right now.
          </p>
        ) : (
          Array.from(friendStatusesMap.entries()).map(([ownerId, group]) => {
            const first = group[0];
            const hasUnseen = group.some(
              (s) => !s.views?.some((v) => v.uid === currentUser.uid)
            );
            return (
              <div
                key={ownerId}
                className="rounded-2xl border border-[#E7EDE9] dark:border-[#23323B] bg-white dark:bg-[#1A262E] p-3 flex items-center justify-between gap-3"
              >
                <button
                  type="button"
                  onClick={() => {
                    setViewingGroup(group);
                    setViewIndex(0);
                  }}
                  className="flex items-center gap-3 text-left flex-1 min-w-0 cursor-pointer"
                >
                  <Avatar
                    src={first.ownerPhotoURL}
                    name={first.ownerName}
                    size="md"
                    hasUnseenStatus={hasUnseen}
                    hasSeenStatus={!hasUnseen}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#111B21] dark:text-white truncate">
                      {first.ownerName}
                    </p>
                    <p className="text-xs text-[#667781] dark:text-[#8696A0]">
                      {group.length} update{group.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  title="Mute this contact's statuses"
                  onClick={() => {
                    const next = [...mutedOwners, ownerId];
                    setMutedOwners(next);
                    localStorage.setItem(MUTED_STATUS_KEY, JSON.stringify(next));
                  }}
                  className="p-2 rounded-xl text-[#667781] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  <VolumeX className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Status Composer Modal */}
      {composerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handlePublish}
            className="w-full max-w-md rounded-3xl bg-white dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#23323B] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#111B21] dark:text-white">
                Create 24h Status
              </h3>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="p-1.5 rounded-lg text-[#667781] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'text', label: 'Text', icon: Type },
                { id: 'image', label: 'Photo', icon: ImageIcon },
                { id: 'video', label: 'Video', icon: ImageIcon },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setStatusType(t.id as typeof statusType)}
                    className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border cursor-pointer ${
                      statusType === t.id
                        ? 'border-[#25D366] bg-[#D9FDD3] dark:bg-[#005C4B] text-[#111B21] dark:text-white'
                        : 'border-[#E7EDE9] dark:border-[#2A3942] text-[#667781]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {statusType === 'text' ? (
              <div className="space-y-2">
                <textarea
                  required
                  maxLength={700}
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  style={{ backgroundColor: bgColor }}
                  placeholder="Share a quick thought..."
                  className="w-full h-40 rounded-2xl p-5 text-center text-white font-display text-lg font-semibold placeholder:text-white/60 focus:outline-none resize-none flex items-center justify-center"
                />
                <div className="flex items-center gap-2">
                  {BG_SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setBgColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-6 h-6 rounded-full cursor-pointer ${
                        bgColor === c ? 'ring-2 ring-[#25D366] ring-offset-2' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="file"
                  required
                  accept={statusType === 'image' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/webm'}
                  onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[#667781]"
                />
                <input
                  type="text"
                  maxLength={300}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption (optional)"
                  className="w-full rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-[#F4FBF6] dark:bg-[#202C33] px-3 py-2 text-sm text-[#111B21] dark:text-white focus:outline-none"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#667781]">Who can see this?</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPrivacyMode('all')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-medium border cursor-pointer ${
                    privacyMode === 'all'
                      ? 'border-[#25D366] bg-[#D9FDD3]/60 dark:bg-[#005C4B] text-[#111B21] dark:text-white'
                      : 'border-[#E7EDE9] dark:border-[#2A3942] text-[#667781]'
                  }`}
                >
                  All Friends ({friends.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPrivacyMode('only')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-medium border cursor-pointer ${
                    privacyMode === 'only'
                      ? 'border-[#25D366] bg-[#D9FDD3]/60 dark:bg-[#005C4B] text-[#111B21] dark:text-white'
                      : 'border-[#E7EDE9] dark:border-[#2A3942] text-[#667781]'
                  }`}
                >
                  Select Friends
                </button>
              </div>
              {privacyMode === 'only' && friends.length > 0 && (
                <div className="max-h-28 overflow-y-auto space-y-1 border border-[#E7EDE9] dark:border-[#2A3942] rounded-xl p-2">
                  {friends.map((f) => (
                    <label key={f.uid} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedFriendIds.includes(f.uid)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedFriendIds([...selectedFriendIds, f.uid]);
                          else setSelectedFriendIds(selectedFriendIds.filter((id) => id !== f.uid));
                        }}
                      />
                      <span>{f.displayName} (@{f.username})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={publishing}
              className="w-full rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] font-semibold py-2.5 text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Publish Status (24h)</span>
            </button>
          </form>
        </div>
      )}

      {/* Fullscreen Story Viewer */}
      {viewingGroup && activeStory && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4"
          onMouseDown={() => setPaused(true)}
          onMouseUp={() => setPaused(false)}
        >
          <div className="w-full max-w-md flex flex-col h-[85vh] rounded-3xl overflow-hidden bg-[#111B21] border border-[#23323B] relative">
            {/* Progress Bars */}
            <div className="absolute top-3 left-3 right-3 z-20 flex gap-1">
              {viewingGroup.map((st, idx) => (
                <div key={st.id} className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden">
                  <div
                    style={{
                      width:
                        idx < viewIndex ? '100%' : idx === viewIndex ? `${progress}%` : '0%',
                    }}
                    className="h-full bg-[#25D366]"
                  />
                </div>
              ))}
            </div>

            {/* Viewer Header */}
            <div className="absolute top-6 left-4 right-4 z-20 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <Avatar src={activeStory.ownerPhotoURL} name={activeStory.ownerName} size="sm" />
                <div>
                  <p className="text-sm font-semibold">{activeStory.ownerName}</p>
                  <p className="text-[11px] text-white/70">@{activeStory.ownerUsername}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeStory.ownerId === currentUser.uid && (
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await deleteDoc(doc(db, 'statuses', activeStory.id));
                      setViewingGroup(null);
                    }}
                    className="p-2 rounded-full bg-black/40 hover:bg-red-500/80 cursor-pointer"
                    title="Delete status"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingGroup(null)}
                  className="p-2 rounded-full bg-black/40 hover:bg-white/20 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div
              className="flex-1 flex items-center justify-center p-6 text-center relative"
              style={{
                backgroundColor: activeStory.type === 'text' ? activeStory.bgColor || '#128C7E' : '#000',
              }}
            >
              {activeStory.type === 'text' && (
                <p className="font-display text-2xl font-bold text-white leading-relaxed">
                  {activeStory.text}
                </p>
              )}
              {activeStory.type === 'image' && activeStory.mediaUrl && (
                <img
                  src={activeStory.mediaUrl}
                  alt="Status"
                  className="max-h-full max-w-full object-contain"
                />
              )}
              {activeStory.type === 'video' && activeStory.mediaUrl && (
                <video
                  src={activeStory.mediaUrl}
                  autoPlay
                  playsInline
                  controls
                  className="max-h-full max-w-full"
                />
              )}

              {activeStory.caption && (
                <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-xs rounded-xl px-3 py-2 text-xs text-white">
                  {activeStory.caption}
                </div>
              )}
            </div>

            {/* Footer (Views for owner, Reply/Reactions for friends) */}
            <div className="p-3 bg-[#0B141A] border-t border-[#23323B] text-white">
              {activeStory.ownerId === currentUser.uid ? (
                <div className="flex items-center justify-between text-xs px-2 py-1">
                  <span className="flex items-center gap-1.5 text-[#8696A0]">
                    <Eye className="w-4 h-4 text-[#25D366]" />
                    <span>{activeStory.views?.length || 0} views</span>
                  </span>
                  <span className="text-[11px] text-[#8696A0] truncate max-w-[200px]">
                    {activeStory.views?.map((v) => v.name).join(', ')}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {['❤️', '🔥', '👏', '😂'].map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => {
                        updateDoc(doc(db, 'statuses', activeStory.id), {
                          reactions: arrayUnion({
                            uid: currentUser.uid,
                            emoji: em,
                            at: new Date().toISOString(),
                          }),
                          updatedAt: serverTimestamp(),
                        }).catch(() => {});
                      }}
                      className="text-lg hover:scale-125 transition-transform cursor-pointer"
                    >
                      {em}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Reply to status..."
                    className="flex-1 rounded-xl bg-[#202C33] px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!replyText.trim()) return;
                      onReplyToStatus(activeStory.ownerId, `Replied to status: ${replyText.trim()}`);
                      setReplyText('');
                      setViewingGroup(null);
                    }}
                    className="p-2 rounded-xl bg-[#25D366] text-[#111B21] cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
