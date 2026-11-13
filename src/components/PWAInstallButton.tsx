import React, { useState } from 'react';
import { Download, Smartphone, X, WifiOff } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'compact' | 'full' }> = ({
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          variant === 'full'
            ? 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#128C7E] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0e7367] transition-colors whitespace-nowrap shrink-0 cursor-pointer'
            : 'inline-flex items-center gap-1.5 rounded-lg border border-[#E7EDE9] dark:border-[#23323B] bg-white dark:bg-[#1A262E] px-3 py-1.5 text-xs font-medium text-[#111B21] dark:text-[#E9EDEF] hover:border-[#25D366] transition-colors whitespace-nowrap shrink-0 cursor-pointer'
        }
      >
        <Download className="w-3.5 h-3.5 text-[#128C7E] dark:text-[#25D366]" />
        <span>Install CHIT CHAT</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E7EDE9] dark:border-[#23323B] bg-white dark:bg-[#1A262E] px-3 py-1.5 text-xs font-medium text-[#111B21] dark:text-[#E9EDEF] hover:border-[#25D366] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#128C7E]" />
          <span>Install App</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1A262E] p-6 shadow-xl border border-[#E7EDE9] dark:border-[#23323B]">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-[#111B21] dark:text-white">
                  Install CHIT CHAT on iOS
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1.5 rounded-lg text-[#667781] hover:bg-black/5 dark:hover:bg-white/5"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="mt-3 space-y-2 text-sm text-[#667781] dark:text-[#8696A0]">
                <li>1. Tap the <strong>Share</strong> button in Safari.</li>
                <li>2. Scroll down and select <strong>Add to Home Screen</strong>.</li>
                <li>3. Tap <strong>Add</strong> to launch CHIT CHAT full-screen.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-[#25D366] py-2.5 text-sm font-semibold text-[#111B21] hover:bg-[#20bd5a] transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-[#111B21] text-white px-3.5 py-2 text-xs font-medium shadow-lg border border-amber-500/40">
      <WifiOff className="w-3.5 h-3.5 text-amber-400" />
      <span>Offline Mode — Reconnecting when network returns</span>
    </div>
  );
};
