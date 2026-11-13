import React from 'react';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  hasUnseenStatus?: boolean;
  hasSeenStatus?: boolean;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  online = false,
  hasUnseenStatus = false,
  hasSeenStatus = false,
  className = '',
}) => {
  const sizeClass =
    size === 'xs'
      ? 'w-7 h-7 text-[11px]'
      : size === 'sm'
        ? 'w-9 h-9 text-xs'
        : size === 'lg'
          ? 'w-12 h-12 text-base'
          : size === 'xl'
            ? 'w-20 h-20 text-2xl'
            : 'w-10 h-10 text-sm';

  const initials = (name || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const ringClass = hasUnseenStatus
    ? 'ring-2 ring-[#25D366] ring-offset-2 ring-offset-white dark:ring-offset-[#111B21]'
    : hasSeenStatus
      ? 'ring-2 ring-[#667781]/50 ring-offset-2 ring-offset-white dark:ring-offset-[#111B21]'
      : '';

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`${sizeClass} ${ringClass} rounded-full overflow-hidden bg-[#D9FDD3] dark:bg-[#005C4B] text-[#128C7E] dark:text-[#D9FDD3] font-display font-bold flex items-center justify-center select-none`}
      >
        {src ? (
          <img
            src={src}
            alt={name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      {online && (
        <span
          title="Online"
          className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#25D366] border-2 border-white dark:border-[#111B21]"
        />
      )}
    </div>
  );
};
