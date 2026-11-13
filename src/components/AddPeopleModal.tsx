import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import jsQR from 'jsqr';
import {
  X,
  Search,
  UserPlus,
  Copy,
  Check,
  Edit3,
  QrCode,
  Camera,
  Upload,
  UserCheck,
  UserX,
  MessageSquare,
  ShieldBan,
  Loader2,
} from 'lucide-react';
import type { FriendRequest, UserPublic } from '../types/chitchat';
import { Avatar } from './Avatar';
import {
  findUserByExactUsername,
  normalizeUsername,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriend,
  swapUsername,
} from '../services/chitchatDb';

interface AddPeopleModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: UserPublic;
  friends: UserPublic[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  blockedUids: string[];
  onStartChatWithFriend: (friendUid: string) => void;
  onBlockToggle: (targetUid: string) => void;
  onUsernameUpdated: (newUsername: string) => void;
}

export const AddPeopleModal: React.FC<AddPeopleModalProps> = ({
  open,
  onClose,
  currentUser,
  friends,
  incomingRequests,
  outgoingRequests,
  blockedUids,
  onStartChatWithFriend,
  onBlockToggle,
  onUsernameUpdated,
}) => {
  const [tab, setTab] = useState<'find' | 'requests' | 'friends' | 'qr'>('find');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<UserPublic | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(currentUser.username);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // QR Scanner state
  const [scanningCamera, setScanningCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setNewUsername(currentUser.username);
  }, [currentUser.username]);

  useEffect(() => {
    if (!open && streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setScanningCamera(false);
    }
  }, [open]);

  if (!open) return null;

  const stopQrCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanningCamera(false);
  };

  const handleExactSearch = async (e?: React.FormEvent, overrideUsername?: string) => {
    if (e) e.preventDefault();
    const raw = overrideUsername ?? searchQuery;
    const clean = normalizeUsername(raw);
    setFoundUser(null);
    setSearchMessage(null);
    if (!clean || clean.length < 3) {
      setSearchMessage('Enter an exact lowercase @username (at least 3 characters).');
      return;
    }
    if (clean === currentUser.username) {
      setSearchMessage('That is your own @username.');
      return;
    }
    setSearching(true);
    try {
      const user = await findUserByExactUsername(clean);
      if (!user) {
        setSearchMessage(`No CHIT CHAT user found with @${clean}.`);
      } else {
        setFoundUser(user);
      }
    } catch (err) {
      setSearchMessage(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  const handleQrPayload = (payload: string) => {
    const clean = payload.startsWith('chitchat:@')
      ? payload.replace('chitchat:@', '')
      : payload;
    const normalized = normalizeUsername(clean);
    if (normalized.length >= 3) {
      stopQrCamera();
      setTab('find');
      setSearchQuery(normalized);
      handleExactSearch(undefined, normalized);
    }
  };

  const startQrCamera = async () => {
    setFeedback(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setScanningCamera(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const tick = () => {
            if (!streamRef.current || !videoRef.current) return;
            if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && ctx) {
              canvas.width = videoRef.current.videoWidth;
              canvas.height = videoRef.current.videoHeight;
              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const decoded = jsQR(imgData.data, imgData.width, imgData.height);
              if (decoded?.data) {
                handleQrPayload(decoded.data);
                return;
              }
            }
            if (streamRef.current) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      }, 100);
    } catch {
      setFeedback('Camera permission denied or unavailable. Try uploading a QR image instead.');
    }
  };

  const handleQrImageUpload = (file: File) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const decoded = jsQR(data.data, data.width, data.height);
      if (decoded?.data) {
        handleQrPayload(decoded.data);
      } else {
        setFeedback('Could not detect a valid CHIT CHAT QR code in that image.');
      }
    };
    img.src = url;
  };

  const handleSaveUsername = async () => {
    setBusyAction('username');
    setFeedback(null);
    try {
      const updated = await swapUsername(
        currentUser.uid,
        currentUser.username,
        newUsername,
        currentUser.displayName,
        currentUser.photoURL
      );
      onUsernameUpdated(updated);
      setEditingUsername(false);
      setFeedback(`Username updated to @${updated}`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to update username.');
    } finally {
      setBusyAction(null);
    }
  };

  const isAlreadyFriend = (uid: string) => friends.some((f) => f.uid === uid);
  const hasPendingOutgoing = (uid: string) =>
    outgoingRequests.some((r) => r.toUid === uid && r.status === 'pending');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-xl rounded-3xl bg-white dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#23323B] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E7EDE9] dark:border-[#23323B] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#25D366] text-[#111B21] flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-[#111B21] dark:text-white">
                Add People &amp; Connections
              </h2>
              <p className="text-xs text-[#667781] dark:text-[#8696A0]">
                Connect privately using exact @usernames or QR codes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopQrCamera();
              onClose();
            }}
            className="p-2 rounded-xl text-[#667781] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* My Username Card */}
        <div className="px-6 py-4 bg-[#F4FBF6] dark:bg-[#111B21] border-b border-[#E7EDE9] dark:border-[#23323B] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar src={currentUser.photoURL} name={currentUser.displayName} size="md" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#111B21] dark:text-white truncate">
                {currentUser.displayName}
              </p>
              {!editingUsername ? (
                <p className="text-xs font-mono-nums text-[#128C7E] dark:text-[#25D366]">
                  @{currentUser.username}
                </p>
              ) : (
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(normalizeUsername(e.target.value))}
                    className="rounded-lg border border-[#25D366] bg-white dark:bg-[#202C33] px-2 py-1 text-xs font-mono-nums text-[#111B21] dark:text-white w-36 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={busyAction === 'username'}
                    onClick={handleSaveUsername}
                    className="px-2.5 py-1 rounded-lg bg-[#25D366] text-[#111B21] text-xs font-semibold cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUsername(false);
                      setNewUsername(currentUser.username);
                    }}
                    className="px-2 py-1 text-xs text-[#667781] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`@${currentUser.username}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-white dark:bg-[#1A262E] px-3 py-1.5 text-xs font-medium text-[#111B21] dark:text-white hover:border-[#25D366] cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#25D366]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={() => setEditingUsername(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-white dark:bg-[#1A262E] px-3 py-1.5 text-xs font-medium text-[#111B21] dark:text-white hover:border-[#25D366] cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 flex items-center gap-1 border-b border-[#E7EDE9] dark:border-[#23323B]">
          {[
            { id: 'find', label: 'Find People' },
            {
              id: 'requests',
              label: `Requests (${incomingRequests.length + outgoingRequests.length})`,
            },
            { id: 'friends', label: `Friends (${friends.length})` },
            { id: 'qr', label: 'QR Share & Scan' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id !== 'qr') stopQrCamera();
                setTab(item.id as typeof tab);
                setFeedback(null);
              }}
              className={`px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                tab === item.id
                  ? 'border-[#25D366] text-[#128C7E] dark:text-[#25D366]'
                  : 'border-transparent text-[#667781] hover:text-[#111B21] dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {feedback && (
            <div className="rounded-xl bg-[#D9FDD3] dark:bg-[#005C4B] px-4 py-2.5 text-xs text-[#111B21] dark:text-white">
              {feedback}
            </div>
          )}

          {tab === 'find' && (
            <div className="space-y-4">
              <form onSubmit={handleExactSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#667781] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value.toLowerCase())}
                    placeholder="Enter exact @username (e.g. aarav_k)"
                    className="w-full rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-[#F4FBF6] dark:bg-[#202C33] pl-10 pr-4 py-2.5 text-sm font-mono-nums text-[#111B21] dark:text-white focus:outline-none focus:border-[#25D366]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] font-semibold px-4 py-2.5 text-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {searching && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Search</span>
                </button>
              </form>

              {searchMessage && (
                <p className="text-xs text-[#667781] dark:text-[#8696A0] text-center py-6">
                  {searchMessage}
                </p>
              )}

              {foundUser && (
                <div className="rounded-2xl border border-[#E7EDE9] dark:border-[#2A3942] p-4 flex items-center justify-between gap-4 bg-[#F4FBF6]/60 dark:bg-[#202C33]">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar src={foundUser.photoURL} name={foundUser.displayName} size="lg" />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[#111B21] dark:text-white truncate">
                        {foundUser.displayName}
                      </p>
                      <p className="text-xs font-mono-nums text-[#128C7E] dark:text-[#25D366]">
                        @{foundUser.username}
                      </p>
                      {foundUser.about && (
                        <p className="text-xs text-[#667781] dark:text-[#8696A0] truncate mt-0.5">
                          {foundUser.about}
                        </p>
                      )}
                    </div>
                  </div>

                  {isAlreadyFriend(foundUser.uid) ? (
                    <button
                      type="button"
                      onClick={() => {
                        onStartChatWithFriend(foundUser.uid);
                        onClose();
                      }}
                      className="rounded-xl bg-[#128C7E] text-white px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Message</span>
                    </button>
                  ) : hasPendingOutgoing(foundUser.uid) ? (
                    <span className="text-xs font-medium text-[#667781] shrink-0">
                      Request Sent
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busyAction === foundUser.uid}
                      onClick={async () => {
                        setBusyAction(foundUser.uid);
                        try {
                          await sendFriendRequest(currentUser, foundUser);
                          setFeedback(`Friend request sent to @${foundUser.username}`);
                        } catch (err) {
                          setFeedback(
                            err instanceof Error ? err.message : 'Unable to send request.'
                          );
                        } finally {
                          setBusyAction(null);
                        }
                      }}
                      className="rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add Friend</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'requests' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-semibold text-[#667781] dark:text-[#8696A0] mb-2">
                  Incoming Requests ({incomingRequests.length})
                </h3>
                {incomingRequests.length === 0 ? (
                  <p className="text-xs text-[#667781] py-3">No incoming friend requests.</p>
                ) : (
                  <div className="space-y-2">
                    {incomingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="rounded-2xl border border-[#E7EDE9] dark:border-[#2A3942] p-3 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar src={req.fromPhotoURL} name={req.fromDisplayName} size="md" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#111B21] dark:text-white truncate">
                              {req.fromDisplayName}
                            </p>
                            <p className="text-xs font-mono-nums text-[#128C7E] dark:text-[#25D366]">
                              @{req.fromUsername}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => respondToFriendRequest(req, 'accepted', currentUser)}
                            className="rounded-xl bg-[#25D366] text-[#111B21] px-3 py-1.5 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Accept</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => respondToFriendRequest(req, 'declined', currentUser)}
                            className="rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] px-3 py-1.5 text-xs font-medium text-[#667781] hover:text-red-500 cursor-pointer"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[#667781] dark:text-[#8696A0] mb-2">
                  Sent Requests ({outgoingRequests.length})
                </h3>
                {outgoingRequests.length === 0 ? (
                  <p className="text-xs text-[#667781] py-3">No pending outgoing requests.</p>
                ) : (
                  <div className="space-y-2">
                    {outgoingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="rounded-2xl border border-[#E7EDE9] dark:border-[#2A3942] p-3 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar src={req.toPhotoURL} name={req.toDisplayName} size="md" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#111B21] dark:text-white truncate">
                              {req.toDisplayName}
                            </p>
                            <p className="text-xs font-mono-nums text-[#667781]">
                              @{req.toUsername} · Pending
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => respondToFriendRequest(req, 'cancelled', currentUser)}
                          className="rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] px-3 py-1.5 text-xs font-medium text-[#667781] hover:text-red-500 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'friends' && (
            <div className="space-y-2">
              {friends.length === 0 ? (
                <p className="text-xs text-[#667781] text-center py-8">
                  You haven&apos;t added any friends yet. Search by exact @username to connect!
                </p>
              ) : (
                friends.map((friend) => {
                  const isBlocked = blockedUids.includes(friend.uid);
                  return (
                    <div
                      key={friend.uid}
                      className="rounded-2xl border border-[#E7EDE9] dark:border-[#2A3942] p-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          src={friend.photoURL}
                          name={friend.displayName}
                          size="md"
                          online={friend.presence === 'online'}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#111B21] dark:text-white truncate">
                            {friend.displayName}
                          </p>
                          <p className="text-xs font-mono-nums text-[#128C7E] dark:text-[#25D366]">
                            @{friend.username}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onStartChatWithFriend(friend.uid);
                            onClose();
                          }}
                          className="rounded-xl bg-[#D9FDD3] dark:bg-[#005C4B] text-[#111B21] dark:text-white px-3 py-1.5 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Chat</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onBlockToggle(friend.uid)}
                          title={isBlocked ? 'Unblock user' : 'Block user'}
                          className="p-2 rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] text-xs text-[#667781] hover:text-amber-600 cursor-pointer"
                        >
                          <ShieldBan className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFriend(currentUser.uid, friend.uid)}
                          title="Remove friend"
                          className="p-2 rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] text-xs text-[#667781] hover:text-red-500 cursor-pointer"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'qr' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
              <div className="rounded-2xl border border-[#E7EDE9] dark:border-[#2A3942] bg-[#F4FBF6] dark:bg-[#111B21] p-5 flex flex-col items-center text-center space-y-3">
                <div className="bg-white p-3 rounded-2xl shadow-xs">
                  <QRCodeSVG
                    value={`chitchat:@${currentUser.username}`}
                    size={150}
                    fgColor="#111B21"
                    bgColor="#FFFFFF"
                  />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#111B21] dark:text-white">
                    {currentUser.displayName}
                  </p>
                  <p className="text-xs font-mono-nums text-[#128C7E] dark:text-[#25D366]">
                    @{currentUser.username}
                  </p>
                </div>
                <p className="text-[11px] text-[#667781]">
                  Share this QR code so friends can find you instantly.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#111B21] dark:text-white">
                  <QrCode className="w-4 h-4 text-[#128C7E]" />
                  <span>Scan a Friend&apos;s QR Code</span>
                </div>
                {scanningCamera ? (
                  <div className="space-y-2">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full aspect-square object-cover rounded-2xl border border-[#25D366] bg-black"
                    />
                    <button
                      type="button"
                      onClick={stopQrCamera}
                      className="w-full rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] py-2 text-xs font-medium cursor-pointer"
                    >
                      Stop Camera
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={startQrCamera}
                      className="w-full rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] font-semibold py-2.5 text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Scan with Camera</span>
                    </button>
                    <label className="w-full rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] py-2.5 text-xs font-medium text-[#111B21] dark:text-white flex items-center justify-center gap-2 hover:border-[#25D366] cursor-pointer">
                      <Upload className="w-4 h-4" />
                      <span>Upload QR Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleQrImageUpload(file);
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
