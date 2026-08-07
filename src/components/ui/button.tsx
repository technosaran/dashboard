"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: "primary" | "secondary" | "danger" | "success" | "outline" | "ghost";
  size?: "sm" | "md" | "lg" | "xl" | "icon";
  isLoading?: boolean;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-medium tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none relative overflow-hidden";
    
    const variants = {
      primary: "bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/35 border border-amber-300/40 active:brightness-95",
      secondary: "bg-slate-800/90 hover:bg-slate-700/90 text-slate-100 hover:text-white border border-slate-600/70 hover:border-slate-500/90 shadow-md shadow-slate-950/40 backdrop-blur-md active:bg-slate-800",
      danger: "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold shadow-lg shadow-rose-600/25 hover:shadow-rose-600/40 border border-rose-400/30 active:brightness-90",
      success: "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 border border-emerald-400/30 active:brightness-90",
      outline: "bg-transparent hover:bg-slate-800/60 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 shadow-sm",
      ghost: "bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-white",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
      md: "h-10 px-4 text-xs gap-2 rounded-xl",
      lg: "h-12 px-6 text-sm gap-2.5 rounded-xl",
      xl: "h-14 px-7 text-base gap-3 rounded-2xl",
      icon: "h-10 w-10 p-0 rounded-xl",
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ y: -1, scale: 1.01 }}
        whileTap={{ scale: 0.96 }}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : children}
      </motion.button>
    );
  }
);
Button.displayName = "Button";
