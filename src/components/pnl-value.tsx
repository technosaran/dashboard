"use client";

interface PnLValueProps {
  value?: number;
  amount?: number;
  percentage?: number;
  prefix?: string;
  currency?: string;
  suffix?: string;
  className?: string;
  showSign?: boolean;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  glow?: boolean;
}

export default function PnLValue({ 
  value,
  amount,
  percentage, 
  prefix,
  currency,
  suffix = "",
  className = "", 
  showSign = true,
  showIcon,
  size = "md",
  glow = false
}: PnLValueProps) {
  const finalValue = value !== undefined ? value : (amount || 0);
  const finalPrefix = prefix !== undefined ? prefix : (currency === 'USD' ? '$' : '₹');
  const finalShowSign = showIcon !== undefined ? showIcon : showSign;

  const isPositive = finalValue > 0;
  const isNegative = finalValue < 0;
  
  const colorClass = isPositive 
    ? "text-success" 
    : isNegative 
      ? "text-danger" 
      : "text-[--text-secondary]";

  const sizeClasses = {
    sm: "text-[11px] font-bold",
    md: "text-[14px] font-black",
    lg: "text-xl md:text-2xl font-black"
  };

  const glowStyle = glow 
    ? {
        color: isPositive ? '#34d399' : isNegative ? '#f87171' : undefined,
        textShadow: isPositive 
          ? "0 0 8px rgba(52,211,153,0.35)" 
          : isNegative 
            ? "0 0 8px rgba(248,113,113,0.35)" 
            : undefined
      } 
    : undefined;

  return (
    <div className={`flex flex-col items-end ${className}`}>
      <span 
        className={`${sizeClasses[size]} tabular-nums ${colorClass}`}
        style={glowStyle}
      >
        {finalShowSign && isPositive ? "+" : ""}{isNegative ? "-" : ""}{finalPrefix}{Math.abs(finalValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{suffix}
      </span>
      {percentage !== undefined && (
        <span 
          className={`text-[10px] font-black opacity-60 tabular-nums ${colorClass}`}
          style={glowStyle}
        >
          ({isPositive ? "+" : ""}{percentage.toFixed(2)}%)
        </span>
      )}
    </div>
  );
}

