import React, { useState } from 'react';
import {
  X,
  User as UserIcon,
  Palette,
  Bell,
  Shield,
  HardDrive,
  Lock,
  LogOut,
  Trash2,
  Camera,
  Loader2,
  Smartphone,
  Check,
} from 'lucide-react';
import {
  GoogleAuthProvider,
  linkWithPopup,
  updatePassword,
  deleteUser,
  signOut,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import type {
  AppearancePrefs,
  NotificationPrefs,
  PrivacyVisibility,
  UserPrivate,
  UserPublic,
  UserPrivacySettings,
} from '../types/chitchat';
import { Avatar } from './Avatar';
import { PWAInstallButton } from './PWAInstallButton';
import { compressImageFile, uploadFileToStorage } from '../utils/media';
import {
  DEFAULT_APPEARANCE,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_PRIVACY,
  deleteAccountData,
  sha256Hex,
  updatePrivateSettings,
  updatePublicProfile,
} from '../services/chitchatDb';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: UserPublic;
  privateData: UserPrivate | null;
  friends: UserPublic[];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  currentUser,
  privateData,
  friends,
}) => {
  const [section, setSection] = useState<
    'profile' | 'appearance' | 'notifications' | 'privacy' | 'security' | 'storage'
  >('profile');
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [about, setAbout] = useState(currentUser.about || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [twoStepPin, setTwoStepPin] = useState('');
  const [chatLockPin, setChatLockPin] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!open) return null;

  const appearance: AppearancePrefs = {
    ...DEFAULT_APPEARANCE,
    ...(privateData?.appearancePrefs || {}),
  };
  const notifications: NotificationPrefs = {
    ...DEFAULT_NOTIFICATIONS,
    ...(privateData?.notificationPrefs || {}),
  };
  const privacy: UserPrivacySettings = {
    ...DEFAULT_PRIVACY,
    ...(currentUser.privacy || {}),
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await updatePublicProfile(currentUser.uid, currentUser.username, {
        displayName,
        about,
      });
      setMsg('Profile updated.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (file: File) => {
    setSaving(true);
    setMsg(null);
    try {
      const compressed = await compressImageFile(file, 512, 0.85);
      const url = await uploadFileToStorage(
        `avatars/${currentUser.uid}/profile_${Date.now()}.webp`,
        compressed
      );
      await updatePublicProfile(currentUser.uid, currentUser.username, { photoURL: url });
      setMsg('Profile photo updated.');
    } finally {
      setSaving(false);
    }
  };

  const updateAppearance = (patch: Partial<AppearancePrefs>) => {
    updatePrivateSettings(currentUser.uid, {
      appearancePrefs: { ...appearance, ...patch },
    });
  };

  const updateNotifications = (patch: Partial<NotificationPrefs>) => {
    updatePrivateSettings(currentUser.uid, {
      notificationPrefs: { ...notifications, ...patch },
    });
  };

  const updatePrivacy = (patch: Partial<UserPrivacySettings>) => {
    updatePublicProfile(currentUser.uid, currentUser.username, {
      privacy: { ...privacy, ...patch },
    });
  };

  const handleDeleteAccount = async () => {
    setSaving(true);
    try {
      await deleteAccountData(currentUser.uid, currentUser.username);
      if (auth.currentUser) {
        await deleteUser(auth.currentUser);
      }
      onClose();
    } catch (err) {
      setMsg(
        err instanceof Error
          ? err.message
          : 'Recent login required to delete account. Please sign out and log back in first.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-3xl h-[82vh] rounded-3xl bg-white dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#23323B] shadow-2xl overflow-hidden flex flex-col sm:flex-row">
        {/* Left Navigation */}
        <div className="sm:w-56 bg-[#F4FBF6] dark:bg-[#111B21] border-b sm:border-b-0 sm:border-r border-[#E7EDE9] dark:border-[#23323B] p-4 flex flex-col justify-between">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-bold text-[#111B21] dark:text-white px-2 pb-3">
              CHIT CHAT Settings
            </h2>
            {[
              { id: 'profile', label: 'Account & Profile', icon: UserIcon },
              { id: 'appearance', label: 'Theme & Wallpaper', icon: Palette },
              { id: 'notifications', label: 'Notifications & Sound', icon: Bell },
              { id: 'privacy', label: 'Privacy & Blocked', icon: Shield },
              { id: 'security', label: 'Security & Devices', icon: Lock },
              { id: 'storage', label: 'Storage & App', icon: HardDrive },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSection(item.id as typeof section);
                    setMsg(null);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    section === item.id
                      ? 'bg-[#D9FDD3] dark:bg-[#005C4B] text-[#111B21] dark:text-white'
                      : 'text-[#667781] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => signOut(auth)}
            className="mt-4 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>

        {/* Right Detail Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-6 py-4 border-b border-[#E7EDE9] dark:border-[#23323B] flex items-center justify-between">
            <span className="font-display font-semibold text-sm text-[#111B21] dark:text-white capitalize">
              {section}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#667781] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {msg && (
              <div className="rounded-xl bg-[#D9FDD3] dark:bg-[#005C4B] px-4 py-2.5 text-xs text-[#111B21] dark:text-white flex items-center gap-2">
                <Check className="w-4 h-4 text-[#128C7E] dark:text-[#25D366]" />
                <span>{msg}</span>
              </div>
            )}

            {section === 'profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar src={currentUser.photoURL} name={currentUser.displayName} size="xl" />
                    <label className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#25D366] text-[#111B21] flex items-center justify-center shadow-md cursor-pointer">
                      <Camera className="w-3.5 h-3.5" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleAvatarChange(file);
                        }}
                      />
                    </label>
                  </div>
                  <div>
                    <p className="font-bold text-[#111B21] dark:text-white">{currentUser.displayName}</p>
                    <p className="text-xs font-mono-nums text-[#128C7E] dark:text-[#25D366]">
                      @{currentUser.username}
                    </p>
                    {privateData?.phoneE164 && (
                      <p className="text-xs text-[#667781] font-mono-nums mt-0.5">
                        Phone: {privateData.phoneE164}
                      </p>
                    )}
                    {privateData?.email && (
                      <p className="text-xs text-[#667781] mt-0.5">Email: {privateData.email}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#667781] mb-1">Display Name</label>
                  <input
                    type="text"
                    required
                    maxLength={64}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-[#F4FBF6] dark:bg-[#202C33] px-3.5 py-2.5 text-sm text-[#111B21] dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#667781] mb-1">About / Bio</label>
                  <input
                    type="text"
                    maxLength={200}
                    value={about}
                    onChange={(e) => setAbout(e.target.value)}
                    className="w-full rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-[#F4FBF6] dark:bg-[#202C33] px-3.5 py-2.5 text-sm text-[#111B21] dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] font-semibold px-5 py-2.5 text-sm inline-flex items-center gap-2 cursor-pointer"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Profile</span>
                </button>
              </form>
            )}

            {section === 'appearance' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-[#667781] mb-2">Theme Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['light', 'dark', 'system'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => updateAppearance({ theme: t })}
                        className={`py-2.5 rounded-xl text-xs font-semibold capitalize border cursor-pointer ${
                          appearance.theme === t
                            ? 'border-[#25D366] bg-[#D9FDD3] dark:bg-[#005C4B] text-[#111B21] dark:text-white'
                            : 'border-[#E7EDE9] dark:border-[#2A3942] text-[#667781]'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#667781] mb-2">
                    Global Chat Wallpaper
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'default', label: 'Classic Doodle' },
                      { id: 'green', label: 'Light Green' },
                      { id: 'minimal', label: 'Minimal White' },
                      { id: 'abstract', label: 'Abstract' },
                      { id: 'nature', label: 'Nature Mint' },
                      { id: 'gradient', label: 'Gradient' },
                    ].map((wp) => (
                      <button
                        key={wp.id}
                        type="button"
                        onClick={() => updateAppearance({ globalWallpaper: wp.id })}
                        className={`py-2.5 px-2 rounded-xl text-xs font-medium border cursor-pointer ${
                          appearance.globalWallpaper === wp.id
                            ? 'border-[#25D366] bg-[#D9FDD3] dark:bg-[#005C4B] text-[#111B21] dark:text-white'
                            : 'border-[#E7EDE9] dark:border-[#2A3942] text-[#667781]'
                        }`}
                      >
                        {wp.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#667781] mb-2">
                    Message Font Size
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['small', 'medium', 'large'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => updateAppearance({ fontSize: sz })}
                        className={`py-2 rounded-xl text-xs font-semibold capitalize border cursor-pointer ${
                          appearance.fontSize === sz
                            ? 'border-[#25D366] bg-[#D9FDD3] dark:bg-[#005C4B] text-[#111B21] dark:text-white'
                            : 'border-[#E7EDE9] dark:border-[#2A3942] text-[#667781]'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {section === 'notifications' && (
              <div className="space-y-4">
                {[
                  { key: 'soundEnabled', label: 'Enable In-App Sound Effects' },
                  { key: 'sentSound', label: 'Sent Message Sound' },
                  { key: 'receivedSound', label: 'Received Message Sound' },
                  { key: 'ringtoneEnabled', label: 'Incoming Call Ringtone' },
                  { key: 'desktopAlerts', label: 'Desktop Browser Notifications' },
                  { key: 'showPreviews', label: 'Show Message Previews in Alerts' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between text-sm text-[#111B21] dark:text-white cursor-pointer"
                  >
                    <span>{item.label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(notifications[item.key as keyof NotificationPrefs])}
                      onChange={(e) =>
                        updateNotifications({ [item.key]: e.target.checked } as Partial<NotificationPrefs>)
                      }
                    />
                  </label>
                ))}

                <div>
                  <label className="block text-xs font-semibold text-[#667781] mb-1">
                    Sound Volume ({Math.round(notifications.volume * 100)}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={notifications.volume}
                    onChange={(e) => updateNotifications({ volume: Number(e.target.value) })}
                    className="w-full accent-[#25D366]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#667781] mb-2">Sound Pack</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['chime', 'drop', 'crystal'] as const).map((pack) => (
                      <button
                        key={pack}
                        type="button"
                        onClick={() => updateNotifications({ soundPack: pack })}
                        className={`py-2 rounded-xl text-xs font-semibold capitalize border cursor-pointer ${
                          notifications.soundPack === pack
                            ? 'border-[#25D366] bg-[#D9FDD3] dark:bg-[#005C4B] text-[#111B21] dark:text-white'
                            : 'border-[#E7EDE9] dark:border-[#2A3942] text-[#667781]'
                        }`}
                      >
                        {pack}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if ('Notification' in window) {
                      Notification.requestPermission().then((res) => {
                        setMsg(`Browser notification permission: ${res}`);
                      });
                    }
                  }}
                  className="rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] px-4 py-2 text-xs font-semibold text-[#128C7E] dark:text-[#25D366] cursor-pointer"
                >
                  Request Browser Notification Permission
                </button>
              </div>
            )}

            {section === 'privacy' && (
              <div className="space-y-4">
                {(
                  [
                    ['lastSeen', 'Last Seen'],
                    ['onlineStatus', 'Online Status'],
                    ['profilePhoto', 'Profile Picture'],
                    ['about', 'About Info'],
                    ['status', '24h Status Updates'],
                  ] as const
                ).map(([field, label]) => (
                  <div key={field} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-[#111B21] dark:text-white">{label}</span>
                    <select
                      value={privacy[field]}
                      onChange={(e) =>
                        updatePrivacy({ [field]: e.target.value as PrivacyVisibility })
                      }
                      className="rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-[#F4FBF6] dark:bg-[#202C33] px-3 py-1.5 text-xs text-[#111B21] dark:text-white"
                    >
                      <option value="everyone">Everyone</option>
                      <option value="contacts">My contacts</option>
                      <option value="nobody">Nobody</option>
                    </select>
                  </div>
                ))}

                <label className="flex items-center justify-between text-sm text-[#111B21] dark:text-white cursor-pointer">
                  <span>Read Receipts (Green Double Ticks)</span>
                  <input
                    type="checkbox"
                    checked={privacy.readReceipts}
                    onChange={(e) => updatePrivacy({ readReceipts: e.target.checked })}
                  />
                </label>

                <label className="flex items-center justify-between text-sm text-[#111B21] dark:text-white cursor-pointer">
                  <span>Typing Indicators</span>
                  <input
                    type="checkbox"
                    checked={privacy.typingIndicators}
                    onChange={(e) => updatePrivacy({ typingIndicators: e.target.checked })}
                  />
                </label>

                <div className="pt-2 border-t border-[#E7EDE9] dark:border-[#23323B]">
                  <p className="text-xs font-semibold text-[#667781] mb-2">
                    Blocked Users ({privateData?.blockedUids?.length || 0})
                  </p>
                  {(!privateData?.blockedUids || privateData.blockedUids.length === 0) ? (
                    <p className="text-xs text-[#667781]">No blocked users.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {privateData.blockedUids.map((bUid) => {
                        const match = friends.find((f) => f.uid === bUid);
                        return (
                          <div
                            key={bUid}
                            className="flex items-center justify-between rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] px-3 py-2 text-xs"
                          >
                            <span>{match ? `${match.displayName} (@${match.username})` : bUid}</span>
                            <button
                              type="button"
                              onClick={() =>
                                updatePrivateSettings(currentUser.uid, {
                                  blockedUids: (privateData.blockedUids || []).filter(
                                    (id) => id !== bUid
                                  ),
                                })
                              }
                              className="text-[#128C7E] dark:text-[#25D366] font-semibold cursor-pointer"
                            >
                              Unblock
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {section === 'security' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#667781]">Two-Step Verification PIN</p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      maxLength={8}
                      value={twoStepPin}
                      onChange={(e) => setTwoStepPin(e.target.value)}
                      placeholder="Enter 4–8 digit PIN"
                      className="flex-1 rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-[#F4FBF6] dark:bg-[#202C33] px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (twoStepPin.length < 4) return;
                        const hash = await sha256Hex(twoStepPin);
                        await updatePrivateSettings(currentUser.uid, { twoStepPinHash: hash });
                        setTwoStepPin('');
                        setMsg('Two-Step Verification PIN saved.');
                      }}
                      className="rounded-xl bg-[#25D366] text-[#111B21] font-semibold px-4 py-2 text-xs cursor-pointer"
                    >
                      Set PIN
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#667781]">Chat Lock PIN</p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      maxLength={8}
                      value={chatLockPin}
                      onChange={(e) => setChatLockPin(e.target.value)}
                      placeholder="PIN to unlock locked chats"
                      className="flex-1 rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-[#F4FBF6] dark:bg-[#202C33] px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (chatLockPin.length < 4) return;
                        const hash = await sha256Hex(chatLockPin);
                        await updatePrivateSettings(currentUser.uid, { chatLockPinHash: hash });
                        setChatLockPin('');
                        setMsg('Chat Lock PIN saved.');
                      }}
                      className="rounded-xl bg-[#25D366] text-[#111B21] font-semibold px-4 py-2 text-xs cursor-pointer"
                    >
                      Save Lock PIN
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#E7EDE9] dark:border-[#23323B]">
                  <p className="text-xs font-semibold text-[#667781]">Account Linking &amp; Password</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!auth.currentUser) return;
                        try {
                          await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
                          setMsg('Google account linked!');
                        } catch (err) {
                          setMsg(err instanceof Error ? err.message : 'Unable to link Google.');
                        }
                      }}
                      className="rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] px-3.5 py-2 text-xs font-semibold cursor-pointer"
                    >
                      Link Google Account
                    </button>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password (min 6 chars)"
                      className="flex-1 rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-[#F4FBF6] dark:bg-[#202C33] px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!auth.currentUser || newPassword.length < 6) return;
                        try {
                          await updatePassword(auth.currentUser, newPassword);
                          setNewPassword('');
                          setMsg('Password updated successfully.');
                        } catch (err) {
                          setMsg(err instanceof Error ? err.message : 'Re-login required to change password.');
                        }
                      }}
                      className="rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] px-4 py-2 text-xs font-semibold cursor-pointer"
                    >
                      Change Password
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E7EDE9] dark:border-[#23323B] space-y-2">
                  <p className="text-xs font-semibold text-[#667781]">Linked Devices</p>
                  {(privateData?.devices || []).map((dev) => (
                    <div
                      key={dev.id}
                      className="flex items-center justify-between text-xs rounded-xl bg-[#F4FBF6] dark:bg-[#202C33] px-3 py-2"
                    >
                      <span className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-[#128C7E]" />
                        <span>{dev.platform} · {dev.label}</span>
                      </span>
                      <span className="font-mono-nums text-[11px] text-[#667781]">
                        {new Date(dev.lastActiveAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-red-200 dark:border-red-900/40">
                  {!confirmDelete ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete CHIT CHAT Account</span>
                    </button>
                  ) : (
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 space-y-2">
                      <p className="text-xs text-red-700 dark:text-red-300">
                        This permanently deletes your profile and frees your @username. Confirm?
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleDeleteAccount}
                          className="rounded-lg bg-red-600 text-white px-3 py-1.5 text-xs font-semibold cursor-pointer"
                        >
                          Yes, Delete Permanently
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="rounded-lg border px-3 py-1.5 text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {section === 'storage' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#E7EDE9] dark:border-[#2A3942] p-4 space-y-2">
                  <p className="text-sm font-semibold text-[#111B21] dark:text-white">
                    Progressive Web App
                  </p>
                  <p className="text-xs text-[#667781]">
                    Install CHIT CHAT on your device for instant launch and cached offline shell.
                  </p>
                  <PWAInstallButton variant="full" />
                </div>

                <div className="rounded-2xl border border-[#E7EDE9] dark:border-[#2A3942] p-4 space-y-2">
                  <p className="text-sm font-semibold text-[#111B21] dark:text-white">
                    Local Drafts &amp; Cache Management
                  </p>
                  <p className="text-xs text-[#667781]">
                    Clear cached drafts, recent emoji history, and muted status filters on this browser.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      Object.keys(localStorage).forEach((k) => {
                        if (k.startsWith('chitchat_')) localStorage.removeItem(k);
                      });
                      setMsg('Local cache cleared.');
                    }}
                    className="rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] px-4 py-2 text-xs font-semibold text-[#111B21] dark:text-white hover:border-[#25D366] cursor-pointer"
                  >
                    Clear Local Cache
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
