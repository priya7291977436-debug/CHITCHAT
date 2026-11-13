import React, { useState } from 'react';
import { X, Users, Plus, Trash2, BarChart3, MapPin, CalendarClock, Loader2, Radio, Megaphone } from 'lucide-react';
import type { UserPublic, MessagePoll } from '../types/chitchat';
import { createGroupOrCommunityChat } from '../services/chitchatDb';
import { Avatar } from './Avatar';

interface CreateSpaceModalProps {
  open: boolean;
  initialType: 'group' | 'channel' | 'community' | 'broadcast';
  onClose: () => void;
  currentUser: UserPublic;
  friends: UserPublic[];
  onCreated: (chatId: string) => void;
}

export const CreateSpaceModal: React.FC<CreateSpaceModalProps> = ({
  open,
  initialType,
  onClose,
  currentUser,
  friends,
  onCreated,
}) => {
  const [spaceType, setSpaceType] = useState(initialType);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [announcementsOnly, setAnnouncementsOnly] = useState(initialType === 'channel');
  const [creating, setCreating] = useState(false);

  if (!open) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const chatId = await createGroupOrCommunityChat({
        type: spaceType,
        name: name.trim(),
        description: description.trim(),
        ownerId: currentUser.uid,
        participantIds: selectedIds,
        isPublic: spaceType === 'channel' || spaceType === 'community' ? isPublic : false,
        announcementsOnly,
      });
      onCreated(chatId);
      setName('');
      setDescription('');
      setSelectedIds([]);
      onClose();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <form
        onSubmit={handleCreate}
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#23323B] p-6 shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-[#111B21] dark:text-white">
            Create {spaceType === 'group' ? 'Group' : spaceType === 'channel' ? 'Channel' : spaceType === 'community' ? 'Community' : 'Broadcast List'}
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#667781] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#F4FBF6] dark:bg-[#202C33]">
          {[
            { id: 'group', label: 'Group', icon: Users },
            { id: 'community', label: 'Community', icon: Users },
            { id: 'channel', label: 'Channel', icon: Radio },
            { id: 'broadcast', label: 'Broadcast', icon: Megaphone },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSpaceType(t.id as typeof spaceType)}
              className={`py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${
                spaceType === t.id
                  ? 'bg-white dark:bg-[#1A262E] text-[#128C7E] dark:text-[#25D366] shadow-xs'
                  : 'text-[#667781]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-medium text-[#667781] mb-1">Name</label>
          <input
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Enter ${spaceType} name`}
            className="w-full rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-[#F4FBF6] dark:bg-[#202C33] px-3.5 py-2.5 text-sm text-[#111B21] dark:text-white focus:outline-none focus:border-[#25D366]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#667781] mb-1">Description</label>
          <textarea
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Purpose or guidelines (optional)"
            rows={2}
            className="w-full rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-[#F4FBF6] dark:bg-[#202C33] px-3.5 py-2 text-sm text-[#111B21] dark:text-white focus:outline-none focus:border-[#25D366] resize-none"
          />
        </div>

        {(spaceType === 'channel' || spaceType === 'community') && (
          <label className="flex items-center justify-between text-xs text-[#111B21] dark:text-[#E9EDEF] cursor-pointer">
            <span>Public discovery (anyone can find &amp; join)</span>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
          </label>
        )}

        {spaceType !== 'broadcast' && (
          <label className="flex items-center justify-between text-xs text-[#111B21] dark:text-[#E9EDEF] cursor-pointer">
            <span>Announcements only (admins post)</span>
            <input
              type="checkbox"
              checked={announcementsOnly}
              onChange={(e) => setAnnouncementsOnly(e.target.checked)}
            />
          </label>
        )}

        <div>
          <label className="block text-xs font-medium text-[#667781] mb-1.5">
            Add Accepted Friends ({selectedIds.length} selected)
          </label>
          {friends.length === 0 ? (
            <p className="text-xs text-[#667781] py-3 text-center border border-dashed border-[#E7EDE9] dark:border-[#2A3942] rounded-xl">
              Add friends via @username first to invite them.
            </p>
          ) : (
            <div className="max-h-44 overflow-y-auto space-y-1.5 border border-[#E7EDE9] dark:border-[#2A3942] rounded-xl p-2">
              {friends.map((f) => {
                const checked = selectedIds.includes(f.uid);
                return (
                  <label
                    key={f.uid}
                    className="flex items-center justify-between p-1.5 rounded-lg hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar src={f.photoURL} name={f.displayName} size="xs" />
                      <div className="text-xs">
                        <p className="font-medium text-[#111B21] dark:text-white">{f.displayName}</p>
                        <p className="text-[11px] font-mono-nums text-[#667781]">@{f.username}</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds([...selectedIds, f.uid]);
                        else setSelectedIds(selectedIds.filter((id) => id !== f.uid));
                      }}
                    />
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={creating}
          className="w-full rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] font-semibold py-2.5 text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          {creating && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>Create</span>
        </button>
      </form>
    </div>
  );
};

export const CreatePollModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSubmitPoll: (poll: MessagePoll) => void;
}> = ({ open, onClose, onSubmitPoll }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validOpts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || validOpts.length < 2) return;
    onSubmitPoll({
      question: question.trim(),
      allowMultiple,
      options: validOpts.map((text, idx) => ({
        id: `opt_${idx}_${Date.now()}`,
        text,
        voterIds: [],
      })),
    });
    setQuestion('');
    setOptions(['', '']);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#23323B] p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#25D366]" />
            <h3 className="font-display text-lg font-bold text-[#111B21] dark:text-white">
              Create Group Poll
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#667781] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          type="text"
          required
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question..."
          className="w-full rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-[#F4FBF6] dark:bg-[#202C33] px-3.5 py-2.5 text-sm text-[#111B21] dark:text-white focus:outline-none focus:border-[#25D366]"
        />

        <div className="space-y-2">
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                required={idx < 2}
                value={opt}
                onChange={(e) => {
                  const next = [...options];
                  next[idx] = e.target.value;
                  setOptions(next);
                }}
                placeholder={`Option ${idx + 1}`}
                className="flex-1 rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-[#F4FBF6] dark:bg-[#202C33] px-3 py-2 text-sm text-[#111B21] dark:text-white focus:outline-none"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                  className="p-2 text-[#667781] hover:text-red-500 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {options.length < 6 && (
            <button
              type="button"
              onClick={() => setOptions([...options, ''])}
              className="text-xs font-semibold text-[#128C7E] dark:text-[#25D366] flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add option</span>
            </button>
          )}
        </div>

        <label className="flex items-center justify-between text-xs text-[#111B21] dark:text-[#E9EDEF] cursor-pointer">
          <span>Allow multiple answers</span>
          <input
            type="checkbox"
            checked={allowMultiple}
            onChange={(e) => setAllowMultiple(e.target.checked)}
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] font-semibold py-2.5 text-sm cursor-pointer"
        >
          Send Poll
        </button>
      </form>
    </div>
  );
};

export const ScheduleMessageModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSchedule: (date: Date) => void;
}> = ({ open, onClose, onSchedule }) => {
  const [dateTime, setDateTime] = useState(() => {
    const d = new Date(Date.now() + 15 * 60 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#23323B] p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-[#25D366]" />
            <h3 className="font-display text-lg font-bold text-[#111B21] dark:text-white">
              Schedule Message
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-[#667781] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          type="datetime-local"
          value={dateTime}
          onChange={(e) => setDateTime(e.target.value)}
          className="w-full rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-[#F4FBF6] dark:bg-[#202C33] px-3 py-2.5 text-sm text-[#111B21] dark:text-white"
        />

        <button
          type="button"
          onClick={() => {
            const parsed = new Date(dateTime);
            if (!isNaN(parsed.getTime())) {
              onSchedule(parsed);
              onClose();
            }
          }}
          className="w-full rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] font-semibold py-2.5 text-sm cursor-pointer"
        >
          Schedule Send
        </button>
      </div>
    </div>
  );
};

export const ShareContactModal: React.FC<{
  open: boolean;
  onClose: () => void;
  friends: UserPublic[];
  onSelectContact: (friend: UserPublic) => void;
}> = ({ open, onClose, friends, onSelectContact }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#23323B] p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-[#111B21] dark:text-white">
            Share Contact Card
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 text-[#667781] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        {friends.length === 0 ? (
          <p className="text-xs text-[#667781] text-center py-6">No friends available to share.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {friends.map((f) => (
              <button
                key={f.uid}
                type="button"
                onClick={() => {
                  onSelectContact(f);
                  onClose();
                }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] text-left cursor-pointer"
              >
                <Avatar src={f.photoURL} name={f.displayName} size="sm" />
                <div>
                  <p className="text-sm font-semibold text-[#111B21] dark:text-white">
                    {f.displayName}
                  </p>
                  <p className="text-xs font-mono-nums text-[#128C7E] dark:text-[#25D366]">
                    @{f.username}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const ShareLocationModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onShareLocation: (loc: { lat: number; lng: number; label: string; isLive: boolean }) => void;
}> = ({ open, onClose, onShareLocation }) => {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [label, setLabel] = useState('');

  if (!open) return null;

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setErr('Geolocation is not supported by this browser.');
      return;
    }
    setLoading(true);
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        onShareLocation({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          label: label.trim() || (isLive ? 'Live Location' : 'Current Location'),
          isLive,
        });
        onClose();
      },
      (geoErr) => {
        setLoading(false);
        setErr(geoErr.message || 'Location permission denied.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#23323B] p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#25D366]" />
            <h3 className="font-display text-lg font-bold text-[#111B21] dark:text-white">
              Share Location
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-[#667781] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g., Central Café)"
          className="w-full rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] bg-[#F4FBF6] dark:bg-[#202C33] px-3 py-2 text-sm text-[#111B21] dark:text-white"
        />
        <label className="flex items-center justify-between text-xs text-[#111B21] dark:text-[#E9EDEF] cursor-pointer">
          <span>Share as live location</span>
          <input type="checkbox" checked={isLive} onChange={(e) => setIsLive(e.target.checked)} />
        </label>
        {err && <p className="text-xs text-red-500">{err}</p>}
        <button
          type="button"
          disabled={loading}
          onClick={handleGetLocation}
          className="w-full rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#111B21] font-semibold py-2.5 text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>Share My Coordinates</span>
        </button>
      </div>
    </div>
  );
};
