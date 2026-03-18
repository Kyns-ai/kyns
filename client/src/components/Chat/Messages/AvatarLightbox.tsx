import React, { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { cn } from '~/utils';

interface AvatarLightboxProps {
  avatarUrl: string | null | undefined;
  alt?: string;
  children: React.ReactNode;
}

/**
 * Wraps content (e.g. message avatar). When avatarUrl is set and user clicks the child,
 * opens a simple overlay showing the image large. Close on backdrop click or X.
 */
const AvatarLightbox: React.FC<AvatarLightboxProps> = ({ avatarUrl, alt = 'Avatar', children }) => {
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback(() => {
    if (avatarUrl) setOpen(true);
  }, [avatarUrl]);

  const handleClose = useCallback(() => setOpen(false), []);

  if (!avatarUrl) {
    return <>{children}</>;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={cn(
          'flex cursor-pointer items-center justify-center overflow-hidden rounded-full',
          'focus:outline-none focus:ring-2 focus:ring-border-xheavy',
        )}
        aria-label={alt}
      >
        {children}
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onClick={handleClose}
        >
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-4 rounded-full p-1 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={avatarUrl}
            alt={alt}
            className="max-h-[85vh] max-w-[85vw] rounded-full object-contain shadow-xl"
            style={{ minWidth: '300px', minHeight: '300px' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default AvatarLightbox;
