import React from "react";

type ButtonVariant = "default" | "outline" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  className = "",
  variant = "default",
  size = "md",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";

  const variants: Record<ButtonVariant, string> = {
    default: "bg-slate-900 text-white hover:bg-slate-800",
    outline:
      "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100",
    destructive:
      "bg-red-600 text-white hover:bg-red-700",
  };

  const sizes: Record<ButtonSize, string> = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
