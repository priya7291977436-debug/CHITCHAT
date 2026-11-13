import React, { useEffect, useMemo, useState } from 'react';
import { Search, Star, Upload, Loader2, Smile, Image as ImageIcon, Sparkles } from 'lucide-react';
import { EMOJI_DATA, SKIN_TONES, BUILT_IN_STICKERS } from '../data/emojisAndStickers';
import { uploadFileToStorage, compressImageFile } from '../utils/media';

interface GifItem {
  id: string;
  title: string;
  previewUrl: string;
  url: string;
}

interface RichPickerPopoverProps {
  uid: string;
  onSelectEmoji: (emoji: string) => void;
  onSelectGif: (gifUrl: string, title: string) => void;
  onSelectSticker: (stickerUrl: string) => void;
  onClose: () => void;
}

const RECENT_EMOJIS_KEY = 'chitchat_recent_emojis';
const RECENT_GIFS_KEY = 'chitchat_recent_gifs';
const FAV_STICKERS_KEY = 'chitchat_fav_stickers';
const CUSTOM_STICKERS_KEY = 'chitchat_custom_stickers';

export const RichPickerPopover: React.FC<RichPickerPopoverProps> = ({
  uid,
  onSelectEmoji,
  onSelectGif,
  onSelectSticker,
  onClose,
}) => {
  const [tab, setTab] = useState<'emoji' | 'gif' | 'sticker'>('emoji');
  const [emojiSearch, setEmojiSearch] = useState('');
  const [emojiCategory, setEmojiCategory] = useState<string>('All');
  const [skinTone, setSkinTone] = useState(0);
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_EMOJIS_KEY) || '["👍","❤️","😂","🔥","🙌"]');
    } catch {
      return ['👍', '❤️', '😂'];
    }
  });

  // GIF state
  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);
  const [recentGifs, setRecentGifs] = useState<GifItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_GIFS_KEY) || '[]');
    } catch {
      return [];
    }
  });

  // Sticker state
  const [favStickers, setFavStickers] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(FAV_STICKERS_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [customStickers, setCustomStickers] = useState<Array<{ id: string; url: string }>>(() => {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_STICKERS_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [uploadingSticker, setUploadingSticker] = useState(false);

  const filteredEmojis = useMemo(() => {
    const q = emojiSearch.trim().toLowerCase();
    return EMOJI_DATA.filter((e) => {
      if (emojiCategory !== 'All' && e.category !== emojiCategory) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [emojiSearch, emojiCategory]);

  const loadGifs = async (q: string) => {
    setGifLoading(true);
    setGifError(null);
    try {
      const endpoint = q.trim()
        ? `/api/gifs/search?q=${encodeURIComponent(q.trim())}`
        : '/api/gifs/trending';
      const resp = await fetch(endpoint);
      const data = (await resp.json()) as { configured?: boolean; gifs?: GifItem[]; error?: string };
      if (!resp.ok || !data.configured) {
        setGifError(data.error || 'GIF provider is not configured.');
        setGifs([]);
      } else {
        setGifs(data.gifs || []);
      }
    } catch (err) {
      setGifError(err instanceof Error ? err.message : 'Unable to reach GIF service.');
    } finally {
      setGifLoading(false);
    }
  };

  useEffect(() => {
    if (tab !== 'gif') return;
    const t = window.setTimeout(() => {
      loadGifs(gifQuery);
    }, 300);
    return () => clearTimeout(t);
  }, [tab, gifQuery]);

  const pickEmoji = (char: string, supportsSkinTone?: boolean) => {
    const finalChar = supportsSkinTone && skinTone > 0 ? `${char}${SKIN_TONES[skinTone].suffix}` : char;
    const nextRecent = [finalChar, ...recentEmojis.filter((e) => e !== finalChar)].slice(0, 14);
    setRecentEmojis(nextRecent);
    localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(nextRecent));
    onSelectEmoji(finalChar);
  };

  const pickGif = (item: GifItem) => {
    const next = [item, ...recentGifs.filter((g) => g.id !== item.id)].slice(0, 12);
    setRecentGifs(next);
    localStorage.setItem(RECENT_GIFS_KEY, JSON.stringify(next));
    onSelectGif(item.url, item.title);
    onClose();
  };

  const toggleFavSticker = (id: string) => {
    const next = favStickers.includes(id)
      ? favStickers.filter((s) => s !== id)
      : [id, ...favStickers];
    setFavStickers(next);
    localStorage.setItem(FAV_STICKERS_KEY, JSON.stringify(next));
  };

  const handleCustomStickerUpload = async (file: File) => {
    setUploadingSticker(true);
    try {
      const compressed = await compressImageFile(file, 512, 0.9);
      const url = await uploadFileToStorage(`stickers/${uid}/stk_${Date.now()}.webp`, compressed);
      const next = [{ id: `custom_${Date.now()}`, url }, ...customStickers].slice(0, 24);
      setCustomStickers(next);
      localStorage.setItem(CUSTOM_STICKERS_KEY, JSON.stringify(next));
    } finally {
      setUploadingSticker(false);
    }
  };

  return (
    <div className="w-[340px] sm:w-[380px] h-[390px] rounded-2xl bg-white dark:bg-[#1A262E] border border-[#E7EDE9] dark:border-[#2A3942] shadow-2xl flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center border-b border-[#E7EDE9] dark:border-[#2A3942] px-2 pt-2">
        {[
          { id: 'emoji', label: 'Emojis', icon: Smile },
          { id: 'gif', label: 'GIFs', icon: ImageIcon },
          { id: 'sticker', label: 'Stickers', icon: Sparkles },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                tab === t.id
                  ? 'border-[#25D366] text-[#128C7E] dark:text-[#25D366]'
                  : 'border-transparent text-[#667781] hover:text-[#111B21] dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === 'emoji' && (
        <div className="flex-1 flex flex-col min-h-0 p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#667781] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={emojiSearch}
                onChange={(e) => setEmojiSearch(e.target.value)}
                placeholder="Search emojis..."
                className="w-full rounded-xl bg-[#F4FBF6] dark:bg-[#202C33] pl-8 pr-2.5 py-1.5 text-xs text-[#111B21] dark:text-white focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1" title="Skin tone">
              {SKIN_TONES.map((st, idx) => (
                <button
                  key={st.label}
                  type="button"
                  onClick={() => setSkinTone(idx)}
                  style={{ backgroundColor: st.swatch }}
                  className={`w-4 h-4 rounded-full cursor-pointer ${
                    skinTone === idx ? 'ring-2 ring-[#25D366] ring-offset-1' : ''
                  }`}
                  aria-label={st.label}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {['All', 'Smileys', 'People', 'Nature', 'Food', 'Activity', 'Objects', 'Symbols'].map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setEmojiCategory(cat)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium shrink-0 cursor-pointer ${
                    emojiCategory === cat
                      ? 'bg-[#D9FDD3] dark:bg-[#005C4B] text-[#111B21] dark:text-white'
                      : 'text-[#667781] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {cat}
                </button>
              )
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {!emojiSearch && emojiCategory === 'All' && recentEmojis.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-[#667781] mb-1">Recent</p>
                <div className="grid grid-cols-8 gap-1">
                  {recentEmojis.map((em, i) => (
                    <button
                      key={`rec_${i}`}
                      type="button"
                      onClick={() => pickEmoji(em)}
                      className="h-8 rounded-lg hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] text-lg flex items-center justify-center cursor-pointer"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-8 gap-1">
              {filteredEmojis.map((em) => (
                <button
                  key={em.char}
                  type="button"
                  onClick={() => pickEmoji(em.char, em.supportsSkinTone)}
                  className="h-8 rounded-lg hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] text-lg flex items-center justify-center cursor-pointer"
                  title={em.name}
                >
                  {em.supportsSkinTone && skinTone > 0
                    ? `${em.char}${SKIN_TONES[skinTone].suffix}`
                    : em.char}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'gif' && (
        <div className="flex-1 flex flex-col min-h-0 p-2.5 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#667781] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={gifQuery}
              onChange={(e) => setGifQuery(e.target.value)}
              placeholder="Search animated GIFs..."
              className="w-full rounded-xl bg-[#F4FBF6] dark:bg-[#202C33] pl-8 pr-3 py-1.5 text-xs text-[#111B21] dark:text-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {['Trending', 'Happy', 'Love', 'Yes', 'Clap', 'Coffee', 'Wow'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setGifQuery(cat === 'Trending' ? '' : cat)}
                className="px-2.5 py-1 rounded-lg bg-[#F4FBF6] dark:bg-[#202C33] text-[11px] text-[#111B21] dark:text-[#E9EDEF] hover:bg-[#D9FDD3] dark:hover:bg-[#005C4B] shrink-0 cursor-pointer"
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {gifLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-[#25D366]" />
              </div>
            ) : gifError ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-2">
                <p className="text-xs font-semibold text-[#111B21] dark:text-white">
                  Live GIF Search Needs API Key
                </p>
                <p className="text-[11px] text-[#667781] dark:text-[#8696A0] leading-relaxed">
                  {gifError}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {gifs.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => pickGif(g)}
                    className="rounded-xl overflow-hidden bg-[#F4FBF6] dark:bg-[#202C33] aspect-video hover:ring-2 hover:ring-[#25D366] transition-all cursor-pointer"
                  >
                    <img
                      src={g.previewUrl}
                      alt={g.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'sticker' && (
        <div className="flex-1 flex flex-col min-h-0 p-2.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#111B21] dark:text-white">
              CHIT CHAT Stickers
            </span>
            <label className="inline-flex items-center gap-1 rounded-lg bg-[#D9FDD3] dark:bg-[#005C4B] px-2.5 py-1 text-[11px] font-semibold text-[#111B21] dark:text-white cursor-pointer">
              {uploadingSticker ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Upload className="w-3 h-3" />
              )}
              <span>Upload Sticker</span>
              <input
                type="file"
                accept="image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCustomStickerUpload(file);
                }}
              />
            </label>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3">
            {customStickers.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-[#667781] mb-1.5">Your Custom Stickers</p>
                <div className="grid grid-cols-4 gap-2">
                  {customStickers.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        onSelectSticker(s.url);
                        onClose();
                      }}
                      className="p-1.5 rounded-xl hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] cursor-pointer"
                    >
                      <img src={s.url} alt="Custom sticker" className="w-full aspect-square object-contain" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2">
              {BUILT_IN_STICKERS.map((stk) => {
                const isFav = favStickers.includes(stk.id);
                return (
                  <div key={stk.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSticker(stk.svgDataUri);
                        onClose();
                      }}
                      className={`w-full p-1.5 rounded-xl hover:bg-[#F4FBF6] dark:hover:bg-[#202C33] transition-transform hover:scale-105 cursor-pointer ${
                        stk.animated ? 'animate-[bounce_3s_infinite]' : ''
                      }`}
                    >
                      <img
                        src={stk.svgDataUri}
                        alt={stk.label}
                        className="w-full aspect-square object-contain"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFavSticker(stk.id)}
                      title="Favorite sticker"
                      className={`absolute top-1 right-1 p-0.5 rounded-full bg-white/90 dark:bg-[#111B21]/90 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                        isFav ? 'opacity-100 text-amber-500' : 'text-[#667781]'
                      }`}
                    >
                      <Star className="w-3 h-3" fill={isFav ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
