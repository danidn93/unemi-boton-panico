import React from "react";
import { createPortal } from "react-dom";

/* =========================
   Dialog Root
========================= */

interface DialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, children }: DialogProps) {
  if (!open) return null;
  return <>{children}</>;
}

/* =========================
   Portal
========================= */

export function DialogPortal({
  children,
}: {
  children: React.ReactNode;
}) {
  return createPortal(children, document.body);
}

/* =========================
   Overlay
========================= */

export function DialogOverlay({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`fixed inset-0 bg-black/50 z-[9998] ${className}`}
    />
  );
}

/* =========================
   Content
========================= */

export function DialogContent({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <div
        className={`fixed left-1/2 top-1/2 z-[9999] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl ${className}`}
      >
        {children}
      </div>
    </DialogPortal>
  );
}

/* =========================
   Header / Title / Description
========================= */

export function DialogHeader({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`mb-4 ${className}`} {...props} />;
}

export function DialogTitle({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={`text-lg font-semibold ${className}`} {...props} />
  );
}

export function DialogDescription({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-sm text-slate-600 ${className}`} {...props} />
  );
}
