import React from 'react';

interface ChitChatLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export const ChitChatLogo: React.FC<ChitChatLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
}) => {
  const dims = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-9 h-9';
  const textClass =
    size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';

  return (
    <div className={`inline-flex items-center gap-2.5 shrink-0 ${className}`}>
      <svg
        viewBox="0 0 64 64"
        className={`${dims} shrink-0 drop-shadow-xs`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="chitChatBrandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#25D366" />
            <stop offset="100%" stopColor="#128C7E" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="url(#chitChatBrandGrad)" />
        <path
          d="M32 14c-10.8 0-19.5 7.8-19.5 17.4 0 4 1.5 7.7 4 10.6-.7 3-2.1 5.8-3.9 7.7-.6.6-.1 1.7.7 1.6 3.9-.2 7.7-1.4 10.5-2.9 2.5.8 5.2 1.2 8.1 1.2 10.8 0 19.5-7.8 19.5-17.4S42.8 14 32 14z"
          fill="#FFFFFF"
        />
        <circle cx="24.5" cy="31.5" r="2.3" fill="#128C7E" />
        <circle cx="32" cy="31.5" r="2.3" fill="#25D366" />
        <circle cx="39.5" cy="31.5" r="2.3" fill="#128C7E" />
      </svg>
      {showText && (
        <span
          className={`font-display font-bold tracking-tight whitespace-nowrap text-[#111B21] dark:text-white ${textClass}`}
        >
          CHIT CHAT
        </span>
      )}
    </div>
  );
};
