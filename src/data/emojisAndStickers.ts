export interface EmojiEntry {
  char: string;
  name: string;
  category: 'Smileys' | 'People' | 'Nature' | 'Food' | 'Activity' | 'Objects' | 'Symbols';
  supportsSkinTone?: boolean;
}

export const SKIN_TONES = [
  { label: 'Default', suffix: '', swatch: '#FFCC4D' },
  { label: 'Light', suffix: '\u{1F3FB}', swatch: '#FADCBC' },
  { label: 'Medium-Light', suffix: '\u{1F3FC}', swatch: '#E0BB95' },
  { label: 'Medium', suffix: '\u{1F3FD}', swatch: '#BF8F68' },
  { label: 'Medium-Dark', suffix: '\u{1F3FE}', swatch: '#9B643D' },
  { label: 'Dark', suffix: '\u{1F3FF}', swatch: '#594539' },
];

export const EMOJI_DATA: EmojiEntry[] = [
  // Smileys
  { char: '😀', name: 'grinning happy smile', category: 'Smileys' },
  { char: '😃', name: 'smiley happy big eyes', category: 'Smileys' },
  { char: '😄', name: 'smile laugh happy', category: 'Smileys' },
  { char: '😁', name: 'grin beam teeth', category: 'Smileys' },
  { char: '😅', name: 'sweat smile nervous laugh', category: 'Smileys' },
  { char: '😂', name: 'joy tears laugh crying', category: 'Smileys' },
  { char: '🤣', name: 'rofl laughing floor', category: 'Smileys' },
  { char: '😊', name: 'blush warm smile', category: 'Smileys' },
  { char: '😇', name: 'angel halo innocent', category: 'Smileys' },
  { char: '🙂', name: 'slightly smiling', category: 'Smileys' },
  { char: '😉', name: 'wink flirt', category: 'Smileys' },
  { char: '😍', name: 'heart eyes love', category: 'Smileys' },
  { char: '🥰', name: 'smiling hearts adore', category: 'Smileys' },
  { char: '😘', name: 'kiss blowing heart', category: 'Smileys' },
  { char: '😋', name: 'yum delicious tongue', category: 'Smileys' },
  { char: '😜', name: 'winking tongue silly', category: 'Smileys' },
  { char: '😎', name: 'sunglasses cool', category: 'Smileys' },
  { char: '🤩', name: 'star struck excited', category: 'Smileys' },
  { char: '🥳', name: 'party celebrate birthday', category: 'Smileys' },
  { char: '🤔', name: 'thinking hmm ponder', category: 'Smileys' },
  { char: '🤨', name: 'raised eyebrow skeptical', category: 'Smileys' },
  { char: '😐', name: 'neutral meh', category: 'Smileys' },
  { char: '🙄', name: 'eye roll whatever', category: 'Smileys' },
  { char: '😴', name: 'sleeping tired zzz', category: 'Smileys' },
  { char: '😌', name: 'relieved peaceful', category: 'Smileys' },
  { char: '😢', name: 'cry sad tear', category: 'Smileys' },
  { char: '😭', name: 'sob crying loud', category: 'Smileys' },
  { char: '😤', name: 'triumph huff', category: 'Smileys' },
  { char: '😡', name: 'angry mad rage', category: 'Smileys' },
  { char: '🤯', name: 'mind blown shocked', category: 'Smileys' },
  { char: '😱', name: 'scream fear shock', category: 'Smileys' },
  { char: '🥺', name: 'pleading puppy eyes', category: 'Smileys' },
  { char: '🤗', name: 'hugging warm hug', category: 'Smileys' },
  { char: '🤫', name: 'shushing quiet secret', category: 'Smileys' },
  // People
  { char: '👍', name: 'thumbs up yes good', category: 'People', supportsSkinTone: true },
  { char: '👎', name: 'thumbs down no bad', category: 'People', supportsSkinTone: true },
  { char: '👏', name: 'clap applause bravo', category: 'People', supportsSkinTone: true },
  { char: '🙌', name: 'raising hands hooray', category: 'People', supportsSkinTone: true },
  { char: '🙏', name: 'pray please thank you namaste', category: 'People', supportsSkinTone: true },
  { char: '🤝', name: 'handshake deal agree', category: 'People' },
  { char: '👋', name: 'wave hello bye', category: 'People', supportsSkinTone: true },
  { char: '👌', name: 'ok hand perfect', category: 'People', supportsSkinTone: true },
  { char: '✌️', name: 'peace victory two', category: 'People', supportsSkinTone: true },
  { char: '🤞', name: 'crossed fingers luck', category: 'People', supportsSkinTone: true },
  { char: '💪', name: 'muscle strong flex', category: 'People', supportsSkinTone: true },
  { char: '🫶', name: 'heart hands love', category: 'People', supportsSkinTone: true },
  { char: '👀', name: 'eyes looking watch', category: 'People' },
  // Nature
  { char: '🌿', name: 'herb leaf green plant', category: 'Nature' },
  { char: '🌱', name: 'seedling sprout plant', category: 'Nature' },
  { char: '🌸', name: 'cherry blossom flower', category: 'Nature' },
  { char: '🌻', name: 'sunflower bloom', category: 'Nature' },
  { char: '🌞', name: 'sun bright warm', category: 'Nature' },
  { char: '🌙', name: 'crescent moon night', category: 'Nature' },
  { char: '⭐', name: 'star favorite', category: 'Nature' },
  { char: '🌈', name: 'rainbow color', category: 'Nature' },
  { char: '🔥', name: 'fire hot lit flame', category: 'Nature' },
  { char: '💧', name: 'water drop', category: 'Nature' },
  { char: '🌊', name: 'ocean wave sea', category: 'Nature' },
  // Food
  { char: '☕', name: 'coffee tea cup morning', category: 'Food' },
  { char: '🍵', name: 'matcha green tea', category: 'Food' },
  { char: '🍕', name: 'pizza slice food', category: 'Food' },
  { char: '🍔', name: 'burger lunch', category: 'Food' },
  { char: '🌮', name: 'taco food', category: 'Food' },
  { char: '🍣', name: 'sushi japanese', category: 'Food' },
  { char: '🍰', name: 'cake dessert sweet', category: 'Food' },
  { char: '🍎', name: 'apple fruit', category: 'Food' },
  { char: '🥑', name: 'avocado green', category: 'Food' },
  { char: '🥂', name: 'cheers toast celebrate', category: 'Food' },
  // Activity
  { char: '🎉', name: 'party popper confetti celebrate', category: 'Activity' },
  { char: '🎊', name: 'confetti ball', category: 'Activity' },
  { char: '🏆', name: 'trophy win champion', category: 'Activity' },
  { char: '⚽', name: 'soccer football sport', category: 'Activity' },
  { char: '🏀', name: 'basketball sport', category: 'Activity' },
  { char: '🎮', name: 'video game controller', category: 'Activity' },
  { char: '🎧', name: 'headphones music audio', category: 'Activity' },
  { char: '🎬', name: 'movie film clapper', category: 'Activity' },
  { char: '✈️', name: 'airplane travel flight', category: 'Activity' },
  { char: '🚀', name: 'rocket launch fast', category: 'Activity' },
  // Objects
  { char: '📱', name: 'phone mobile smartphone', category: 'Objects' },
  { char: '💻', name: 'laptop computer work', category: 'Objects' },
  { char: '📷', name: 'camera photo', category: 'Objects' },
  { char: '📍', name: 'pin location map', category: 'Objects' },
  { char: '🔔', name: 'bell notification alert', category: 'Objects' },
  { char: '🔒', name: 'lock security private', category: 'Objects' },
  { char: '💡', name: 'lightbulb idea bright', category: 'Objects' },
  { char: '📝', name: 'memo note write', category: 'Objects' },
  { char: '🎁', name: 'gift present box', category: 'Objects' },
  // Symbols
  { char: '❤️', name: 'red heart love', category: 'Symbols' },
  { char: '💚', name: 'green heart chitchat', category: 'Symbols' },
  { char: '💙', name: 'blue heart', category: 'Symbols' },
  { char: '💛', name: 'yellow heart', category: 'Symbols' },
  { char: '💜', name: 'purple heart', category: 'Symbols' },
  { char: '✅', name: 'check mark done yes', category: 'Symbols' },
  { char: '❌', name: 'cross mark no cancel', category: 'Symbols' },
  { char: '💯', name: 'hundred 100 perfect', category: 'Symbols' },
  { char: '✨', name: 'sparkles magic', category: 'Symbols' },
  { char: '⚡', name: 'lightning fast', category: 'Symbols' },
  { char: '💬', name: 'speech bubble chat', category: 'Symbols' },
];

export interface BuiltInSticker {
  id: string;
  label: string;
  svgDataUri: string;
  animated?: boolean;
}

function svgUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const BUILT_IN_STICKERS: BuiltInSticker[] = [
  {
    id: 'stk_hi',
    label: 'Hey!',
    animated: true,
    svgDataUri: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect x="12" y="24" width="136" height="104" rx="28" fill="#25D366"/><path d="M40 128l-14 20 34-16z" fill="#25D366"/><text x="80" y="88" font-family="sans-serif" font-weight="800" font-size="38" text-anchor="middle" fill="#FFFFFF">HEY!</text></svg>`),
  },
  {
    id: 'stk_onmyway',
    label: 'On my way',
    animated: true,
    svgDataUri: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><circle cx="80" cy="80" r="68" fill="#128C7E"/><text x="80" y="74" font-family="sans-serif" font-weight="700" font-size="22" text-anchor="middle" fill="#D9FDD3">ON MY</text><text x="80" y="104" font-family="sans-serif" font-weight="800" font-size="28" text-anchor="middle" fill="#FFFFFF">WAY!</text></svg>`),
  },
  {
    id: 'stk_cheers',
    label: 'Awesome',
    svgDataUri: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect x="10" y="34" width="140" height="92" rx="24" fill="#D9FDD3" stroke="#128C7E" stroke-width="5"/><text x="80" y="78" font-family="sans-serif" font-size="34" text-anchor="middle">🎉</text><text x="80" y="110" font-family="sans-serif" font-weight="800" font-size="20" text-anchor="middle" fill="#111B21">AWESOME</text></svg>`),
  },
  {
    id: 'stk_coffee',
    label: 'Coffee?',
    svgDataUri: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><circle cx="80" cy="80" r="66" fill="#F4FBF6" stroke="#25D366" stroke-width="6"/><text x="80" y="82" font-family="sans-serif" font-size="48" text-anchor="middle">☕</text><text x="80" y="120" font-family="sans-serif" font-weight="700" font-size="20" text-anchor="middle" fill="#128C7E">COFFEE?</text></svg>`),
  },
  {
    id: 'stk_love',
    label: 'Love it',
    animated: true,
    svgDataUri: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><circle cx="80" cy="80" r="66" fill="#25D366"/><text x="80" y="86" font-family="sans-serif" font-size="52" text-anchor="middle">💚</text><text x="80" y="124" font-family="sans-serif" font-weight="800" font-size="18" text-anchor="middle" fill="#FFFFFF">LOVE IT</text></svg>`),
  },
  {
    id: 'stk_brb',
    label: 'BRB',
    svgDataUri: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect x="18" y="34" width="124" height="92" rx="22" fill="#111B21"/><text x="80" y="84" font-family="sans-serif" font-weight="800" font-size="36" text-anchor="middle" fill="#25D366">BRB</text><text x="80" y="110" font-family="sans-serif" font-weight="600" font-size="14" text-anchor="middle" fill="#D9FDD3">BACK SOON</text></svg>`),
  },
  {
    id: 'stk_gg',
    label: 'Nice!',
    svgDataUri: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><circle cx="80" cy="80" r="66" fill="#128C7E"/><text x="80" y="82" font-family="sans-serif" font-size="46" text-anchor="middle">🙌</text><text x="80" y="122" font-family="sans-serif" font-weight="800" font-size="20" text-anchor="middle" fill="#FFFFFF">NICE!</text></svg>`),
  },
  {
    id: 'stk_goodnight',
    label: 'Good Night',
    svgDataUri: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><circle cx="80" cy="80" r="66" fill="#111B21"/><text x="80" y="82" font-family="sans-serif" font-size="46" text-anchor="middle">🌙</text><text x="80" y="120" font-family="sans-serif" font-weight="700" font-size="17" text-anchor="middle" fill="#D9FDD3">GOOD NIGHT</text></svg>`),
  },
];
