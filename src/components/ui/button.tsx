/**
 * Standardized Button Component
 * Ensures consistent button styling and accessibility
 */

import { ReactNode, ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  icon,
  children,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const baseClasses = "inline-flex items-center justify-center gap-2 rounded-xl font-bold uppercase tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-[--accent-primary] focus:ring-offset-2 focus:ring-offset-[--bg-base] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none";

  const variantClasses = {
    primary: "bg-gradient-to-br from-[--accent-primary] to-[--accent-primary-light] text-white hover:shadow-lg hover:shadow-[--accent-primary]/30 hover:-translate-y-0.5 active:translate-y-0",
    secondary: "bg-[--bg-elevated] text-[--text-primary] border border-[--border-default] hover:bg-[--bg-overlay] hover:border-[--border-strong] hover:-translate-y-0.5 active:translate-y-0",
    danger: "bg-[--danger]/10 text-[--danger] border border-[--danger]/20 hover:bg-[--danger]/20 hover:-translate-y-0.5 active:translate-y-0",
    ghost: "bg-transparent text-[--text-secondary] hover:bg-white/5 hover:text-[--text-primary]",
  };

  const sizeClasses = {
    sm: "h-10 px-4 text-xs",
    md: "h-12 px-6 text-sm",
    lg: "h-14 px-8 text-base",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading...</span>
        </>
      ) : (
        <>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <span>{children}</span>
        </>
      )}
    </button>
  );
}
