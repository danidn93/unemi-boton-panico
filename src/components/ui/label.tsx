import React from "react";

export function Label({
  className = "",
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`text-sm font-medium text-slate-900 ${className}`}
      {...props}
    />
  );
}
