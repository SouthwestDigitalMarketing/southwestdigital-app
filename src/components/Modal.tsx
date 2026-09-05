"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Native top-layer dialog keeps focus inside and the rest of the app inert. */
export function Modal({
  open = true,
  onClose,
  labelledBy,
  describedBy,
  label,
  children,
  className = "max-w-lg",
  busy = false,
  closeOnBackdrop = true,
}: {
  open?: boolean;
  onClose: () => void;
  labelledBy?: string;
  describedBy?: string;
  label?: string;
  children: ReactNode;
  className?: string;
  busy?: boolean;
  closeOnBackdrop?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-label={labelledBy ? undefined : label}
      aria-busy={busy || undefined}
      className={`ui-modal ${className}`}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (!closeOnBackdrop || busy || event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
