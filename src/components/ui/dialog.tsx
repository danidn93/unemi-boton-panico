import React from "react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, children }: DialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      {children}
    </div>
  );
}

export function DialogContent({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`w-full max-w-md rounded-lg bg-white p-6 shadow-lg ${className}`}
    >
      {children}
    </div>
  );
}

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
