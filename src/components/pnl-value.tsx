"use client";

interface PnLValueProps {
  value: number;
  percentage?: number;
  prefix?: string;
  className?: string;
  showSign?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function PnLValue({ 
  value, 
  percentage, 
  prefix = "₹", 
  className = "", 
  showSign = true,
  size = "md"
}: PnLValueProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  
  const colorClass = isPositive 
    ? "text-[--success]" 
    : isNegative 
      ? "text-[--danger]" 
      : "text-[--text-secondary]";

  const sizeClasses = {
    sm: "text-[11px] font-bold",
    md: "text-[14px] font-black",
    lg: "text-xl md:text-2xl font-black"
  };

  return (
    <div className={`flex flex-col items-end ${className}`}>
      <span className={`${sizeClasses[size]} tabular-nums ${colorClass}`}>
        {showSign && isPositive ? "+" : ""}{isNegative ? "-" : ""}{prefix}{Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      {percentage !== undefined && (
        <span className={`text-[10px] font-black opacity-60 tabular-nums ${colorClass}`}>
          ({isPositive ? "+" : ""}{percentage.toFixed(2)}%)
        </span>
      )}
    </div>
  );
}
