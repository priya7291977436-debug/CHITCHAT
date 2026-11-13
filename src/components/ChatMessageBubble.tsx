import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Check,
  CheckCheck,
  Clock,
  Star,
  Reply,
  Forward,
  Copy,
  Trash2,
  Edit3,
  Pin,
  Info,
  Languages,
  BellRing,
  FileText,
  Download,
  MapPin,
  User as UserIcon,
  MoreVertical,
  SmilePlus,
  Loader2,
} from 'lucide-react';
import type { Message, UserPublic } from '../types/chitchat';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { formatBytes } from '../utils/media';

interface ChatMessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showSenderName: boolean;
  currentUserId: string;
  animateEntrance: boolean;
  fontSizeClass: string;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onReply: () => void;
  onForward: () => void;
  onEdit: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
  onReact: (emoji: string) => void;
  onStar: () => void;
  onPin: () => void;
  onShowInfo: () => void;
  onRemind: () => void;
  onVotePoll: (optionId: string) => void;
  onOpenMedia: (url: string, type: 'image' | 'video') => void;
  onMessageContact?: (uid: string) => void;
  friends: UserPublic[];
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message,
  isOwn,
  showSenderName,
  currentUserId,
  animateEntrance,
  fontSizeClass,
  selectionMode,
  selected,
  onToggleSelect,
  onReply,
  onForward,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  onReact,
  onStar,
  onPin,
  onShowInfo,
  onRemind,
  onVotePoll,
  onOpenMedia,
  onMessageContact,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateLang, setTranslateLang] = useState('Spanish');
  const [showTranslateMenu, setShowTranslateMenu] = useState(false);

  const isStarred = Boolean(message.starredBy?.includes(currentUserId));
  const isDeleted = Boolean(message.deletedForEveryone);

  const createdAtDate = (() => {
    const c = message.createdAt as { toDate?: () => Date } | undefined;
    if (c?.toDate) return c.toDate();
    return new Date();
  })();

  const timeLabel = createdAtDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const renderTicks = () => {
    if (!isOwn) return null;
    if (message.pendingLocal) {
      return <Clock className="w-3 h-3 text-[#667781] dark:text-[#A3E4D7]" />;
    }
    const readCount = (message.readBy || []).filter((id) => id !== currentUserId).length;
    const deliveredCount = (message.deliveredTo || []).filter((id) => id !== currentUserId).length;
    if (readCount > 0) {
      return <CheckCheck className="w-3.5 h-3.5 text-[#25D366]" />;
    }
    if (deliveredCount > 0) {
      return <CheckCheck className="w-3.5 h-3.5 text-[#667781] dark:text-[#A3E4D7]" />;
    }
    return <Check className="w-3.5 h-3.5 text-[#667781] dark:text-[#A3E4D7]" />;
  };

  const handleTranslate = async (lang: string) => {
    if (!message.text) return;
    setTranslateLang(lang);
    setShowTranslateMenu(false);
    setTranslating(true);
    try {
      const resp = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message.text, targetLanguage: lang }),
      });
      const data = (await resp.json()) as { translatedText?: string; error?: string };
      if (resp.ok && data.translatedText) {
        setTranslatedText(data.translatedText);
      } else {
        setTranslatedText(`Translation unavailable: ${data.error || 'configure GEMINI_API_KEY'}`);
      }
    } catch {
      setTranslatedText('Translation request failed.');
    } finally {
      setTranslating(false);
    }
  };

  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, idx) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={idx}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-[#128C7E] dark:text-[#53bdeb] break-all"
          >
            {part}
          </a>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  const totalReactions = Object.entries(message.reactions || {}).filter(
    ([, uids]) => uids.length > 0
  );

  const BubbleWrapper = animateEntrance ? motion.div : 'div';
  const motionProps = animateEntrance
    ? {
        initial: { opacity: 0, x: isOwn ? 14 : -14 },
        animate: { opacity: 1, x: 0 },
        transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const },
      }
    : {};

  return (
    <BubbleWrapper
      {...(motionProps as Record<string, unknown>)}
      className={`group flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
    >
      {selectionMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="w-4 h-4 accent-[#25D366] mb-2 cursor-pointer"
        />
      )}

      <div
        className={`relative max-w-[82%] sm:max-w-[68%] rounded-2xl px-3.5 py-2 shadow-xs transition-shadow ${
          message.type === 'sticker' && !isDeleted
            ? 'bg-transparent shadow-none px-1 py-1'
            : isOwn
              ? 'bg-[#D9FDD3] dark:bg-[#005C4B] text-[#111B21] dark:text-white rounded-tr-sm'
              : 'bg-white dark:bg-[#202C33] text-[#111B21] dark:text-[#E9EDEF] rounded-tl-sm border border-[#E7EDE9]/80 dark:border-transparent'
        } ${selected ? 'ring-2 ring-[#25D366]' : ''}`}
      >
        {/* Hover quick actions */}
        {!isDeleted && (
          <div
            className={`absolute top-1 ${
              isOwn ? '-left-16' : '-right-16'
            } opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-white/95 dark:bg-[#1A262E]/95 rounded-xl border border-[#E7EDE9] dark:border-[#2A3942] px-1 py-0.5 shadow-sm z-20`}
          >
            <button
              type="button"
              onClick={() => setReactOpen((r) => !r)}
              className="p-1 text-[#667781] hover:text-[#128C7E] cursor-pointer"
              title="React"
            >
              <SmilePlus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((m) => !m)}
              className="p-1 text-[#667781] hover:text-[#111B21] dark:hover:text-white cursor-pointer"
              title="Message actions"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Quick Reaction Bar */}
        {reactOpen && (
          <div
            className={`absolute -top-10 ${
              isOwn ? 'right-0' : 'left-0'
            } z-30 flex items-center gap-1 rounded-2xl bg-white dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#2A3942] px-2 py-1 shadow-lg`}
          >
            {QUICK_REACTIONS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => {
                  onReact(em);
                  setReactOpen(false);
                }}
                className="text-base hover:scale-125 transition-transform px-0.5 cursor-pointer"
              >
                {em}
              </button>
            ))}
          </div>
        )}

        {/* Context Menu */}
        {menuOpen && (
          <div
            className={`absolute top-7 ${
              isOwn ? 'right-0' : 'left-0'
            } z-30 w-44 rounded-2xl bg-white dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#2A3942] shadow-xl py-1.5 text-xs text-[#111B21] dark:text-[#E9EDEF]`}
          >
            <button
              type="button"
              onClick={() => {
                onReply();
                setMenuOpen(false);
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
            >
              <Reply className="w-3.5 h-3.5" /> <span>Reply</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onForward();
                setMenuOpen(false);
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
            >
              <Forward className="w-3.5 h-3.5" /> <span>Forward</span>
            </button>
            {message.text && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(message.text || '');
                  setMenuOpen(false);
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" /> <span>Copy Text</span>
              </button>
            )}
            {message.text && (
              <button
                type="button"
                onClick={() => {
                  setShowTranslateMenu(true);
                  setMenuOpen(false);
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
              >
                <Languages className="w-3.5 h-3.5" /> <span>Translate</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onStar();
                setMenuOpen(false);
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
            >
              <Star className="w-3.5 h-3.5" /> <span>{isStarred ? 'Unstar' : 'Star'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onPin();
                setMenuOpen(false);
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
            >
              <Pin className="w-3.5 h-3.5" /> <span>Pin</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onRemind();
                setMenuOpen(false);
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
            >
              <BellRing className="w-3.5 h-3.5" /> <span>Remind Me</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onShowInfo();
                setMenuOpen(false);
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
            >
              <Info className="w-3.5 h-3.5" /> <span>Message Info</span>
            </button>
            {isOwn && message.type === 'text' && (
              <button
                type="button"
                onClick={() => {
                  onEdit();
                  setMenuOpen(false);
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" /> <span>Edit</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onDeleteForMe();
                setMenuOpen(false);
              }}
              className="w-full px-3 py-1.5 flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> <span>Delete for me</span>
            </button>
            {isOwn && (
              <button
                type="button"
                onClick={() => {
                  onDeleteForEveryone();
                  setMenuOpen(false);
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> <span>Delete for all</span>
              </button>
            )}
          </div>
        )}

        {/* Sender Name for Groups */}
        {showSenderName && !isOwn && (
          <p className="text-[11px] font-semibold text-[#128C7E] dark:text-[#25D366] mb-0.5">
            {message.senderName}
          </p>
        )}

        {/* Forwarded Badge */}
        {message.forwardedFrom && !isDeleted && (
          <p className="text-[11px] italic text-[#667781] dark:text-[#A3E4D7] flex items-center gap-1 mb-1">
            <Forward className="w-3 h-3" /> Forwarded
          </p>
        )}

        {/* Reply Quote */}
        {message.replyTo && !isDeleted && (
          <div className="mb-1.5 rounded-xl bg-black/5 dark:bg-black/25 px-2.5 py-1.5 border border-black/10 dark:border-white/10 text-xs">
            <p className="font-semibold text-[#128C7E] dark:text-[#25D366] text-[11px]">
              {message.replyTo.senderName}
            </p>
            <p className="truncate text-[#667781] dark:text-[#8696A0]">{message.replyTo.text}</p>
          </div>
        )}

        {/* Main Message Content */}
        {isDeleted ? (
          <p className="text-xs italic text-[#667781] dark:text-[#8696A0]">
            This message was deleted
          </p>
        ) : (
          <div className={fontSizeClass}>
            {message.type === 'text' && message.text && (
              <p className="whitespace-pre-wrap break-words leading-relaxed">
                {renderTextWithLinks(message.text)}
              </p>
            )}

            {message.type === 'image' && message.mediaUrl && (
              <div className="space-y-1.5">
                <img
                  src={message.mediaUrl}
                  alt={message.mediaName || 'Shared photo'}
                  onClick={() => onOpenMedia(message.mediaUrl!, 'image')}
                  className="max-h-72 rounded-xl object-cover cursor-pointer hover:opacity-95"
                />
                {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
              </div>
            )}

            {message.type === 'video' && message.mediaUrl && (
              <div className="space-y-1.5">
                <video
                  src={message.mediaUrl}
                  controls
                  className="max-h-72 rounded-xl w-full bg-black"
                />
                {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
              </div>
            )}

            {message.type === 'gif' && message.mediaUrl && (
              <img
                src={message.mediaUrl}
                alt={message.mediaName || 'Animated GIF'}
                onClick={() => onOpenMedia(message.mediaUrl!, 'image')}
                className="max-h-60 rounded-xl object-cover cursor-pointer"
              />
            )}

            {message.type === 'sticker' && message.mediaUrl && (
              <img
                src={message.mediaUrl}
                alt="Sticker"
                className="w-32 h-32 object-contain"
              />
            )}

            {(message.type === 'voice' || message.type === 'audio') && message.mediaUrl && (
              <VoiceMessagePlayer
                src={message.mediaUrl}
                durationSec={message.durationSec}
                waveform={message.waveform}
                isOwn={isOwn}
              />
            )}

            {message.type === 'document' && message.mediaUrl && (
              <a
                href={message.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={message.mediaName}
                className="flex items-center gap-3 rounded-xl bg-black/5 dark:bg-black/20 p-2.5 hover:bg-black/10 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-[#128C7E] text-white flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">
                    {message.mediaName || 'Document'}
                  </p>
                  <p className="text-[11px] text-[#667781] dark:text-[#8696A0] font-mono-nums">
                    {formatBytes(message.mediaSize || 0)}
                  </p>
                </div>
                <Download className="w-4 h-4 text-[#128C7E] dark:text-[#25D366] shrink-0" />
              </a>
            )}

            {message.type === 'location' && message.location && (
              <a
                href={`https://www.openstreetmap.org/?mlat=${message.location.lat}&mlon=${message.location.lng}#map=15/${message.location.lat}/${message.location.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-xl bg-black/5 dark:bg-black/20 p-2.5 hover:bg-black/10"
              >
                <div className="w-9 h-9 rounded-lg bg-[#25D366] text-[#111B21] flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold">
                    {message.location.label || 'Shared Location'}
                  </p>
                  <p className="text-[11px] font-mono-nums text-[#667781] dark:text-[#A3E4D7]">
                    {message.location.lat}, {message.location.lng}
                  </p>
                </div>
              </a>
            )}

            {message.type === 'contact' && message.contactCard && (
              <div className="rounded-xl bg-black/5 dark:bg-black/20 p-2.5 flex items-center justify-between gap-3 min-w-[200px]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#128C7E] text-white flex items-center justify-center shrink-0">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{message.contactCard.displayName}</p>
                    <p className="text-[11px] font-mono-nums text-[#128C7E] dark:text-[#25D366]">
                      @{message.contactCard.username}
                    </p>
                  </div>
                </div>
                {onMessageContact && (
                  <button
                    type="button"
                    onClick={() => onMessageContact(message.contactCard!.uid)}
                    className="text-[11px] font-semibold text-[#128C7E] dark:text-[#25D366] hover:underline cursor-pointer"
                  >
                    Chat
                  </button>
                )}
              </div>
            )}

            {message.type === 'poll' && message.poll && (
              <div className="space-y-2 min-w-[230px]">
                <p className="font-semibold text-sm">{message.poll.question}</p>
                <div className="space-y-1.5">
                  {(() => {
                    const totalVotes = message.poll!.options.reduce(
                      (acc, o) => acc + (o.voterIds?.length || 0),
                      0
                    );
                    return message.poll!.options.map((opt) => {
                      const count = opt.voterIds?.length || 0;
                      const voted = opt.voterIds?.includes(currentUserId);
                      const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onVotePoll(opt.id)}
                          className={`w-full text-left rounded-xl border p-2 text-xs relative overflow-hidden cursor-pointer ${
                            voted
                              ? 'border-[#25D366] bg-[#25D366]/10 font-semibold'
                              : 'border-black/10 dark:border-white/15'
                          }`}
                        >
                          <div
                            style={{ width: `${pct}%` }}
                            className="absolute inset-y-0 left-0 bg-[#25D366]/20 transition-all"
                          />
                          <div className="relative flex items-center justify-between gap-2">
                            <span>{opt.text}</span>
                            <span className="font-mono-nums text-[11px]">{count}</span>
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Language picker for translation */}
        {showTranslateMenu && (
          <div className="mt-2 p-2 rounded-xl bg-black/5 dark:bg-black/25 flex flex-wrap gap-1.5">
            {['Spanish', 'Hindi', 'French', 'German', 'Arabic', 'Japanese', 'English'].map(
              (lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => handleTranslate(lang)}
                  className="px-2 py-0.5 rounded-lg bg-white dark:bg-[#1A262E] text-[11px] font-medium hover:bg-[#25D366] hover:text-[#111B21] cursor-pointer"
                >
                  {lang}
                </button>
              )
            )}
          </div>
        )}

        {translating && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#667781]">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Translating to {translateLang}...</span>
          </div>
        )}

        {translatedText && (
          <div className="mt-1.5 pt-1.5 border-t border-black/10 dark:border-white/10 text-xs">
            <span className="text-[10px] font-semibold text-[#128C7E] dark:text-[#25D366] block">
              Translated ({translateLang}):
            </span>
            <p className="italic">{translatedText}</p>
          </div>
        )}

        {/* Timestamp, Edited, Star & Ticks */}
        <div className="flex items-center justify-end gap-1 mt-1 text-[10px] font-mono-nums text-[#667781] dark:text-[#A3E4D7]">
          {isStarred && <Star className="w-2.5 h-2.5 text-amber-500" fill="currentColor" />}
          {Boolean(message.editedAt) && !isDeleted && <span>Edited</span>}
          <span>{timeLabel}</span>
          {renderTicks()}
        </div>

        {/* Reactions Row */}
        {totalReactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {totalReactions.map(([emoji, uids]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(emoji)}
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] border cursor-pointer ${
                  uids.includes(currentUserId)
                    ? 'bg-[#D9FDD3] dark:bg-[#005C4B] border-[#25D366]'
                    : 'bg-white/90 dark:bg-[#1A262E] border-[#E7EDE9] dark:border-[#2A3942]'
                }`}
              >
                <span>{emoji}</span>
                <span className="font-mono-nums text-[10px]">{uids.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </BubbleWrapper>
  );
};
