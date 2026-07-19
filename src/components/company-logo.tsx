"use client";

import { useState, useMemo } from "react";
import Image from "next/image";

type CompanyLogoProps = {
  companyName: string | null | undefined;
  category?: string | null | undefined;
  size?: number;
  className?: string;
};

const COMPANY_DOMAINS: Record<string, string> = {
  google: "google.com",
  microsoft: "microsoft.com",
  apple: "apple.com",
  amazon: "amazon.com",
  facebook: "facebook.com",
  meta: "meta.com",
  netflix: "netflix.com",
  "netflix india": "netflix.com",
  "google india": "google.com",
  tcs: "tcs.com",
  "tata consultancy services": "tcs.com",
  infosys: "infosys.com",
  wipro: "wipro.com",
  cognizant: "cognizant.com",
  accenture: "accenture.com",
  hcl: "hcltech.com",
  hcltech: "hcltech.com",
  stripe: "stripe.com",
  paypal: "paypal.com",
  uber: "uber.com",
  ola: "ola.in",
  swiggy: "swiggy.com",
  zomato: "zomato.com",
  paytm: "paytm.com",
  phonepe: "phonepe.com",
  cred: "cred.club",
  upwork: "upwork.com",
  fiverr: "fiverr.com",
  github: "github.com",
  gitlab: "gitlab.com",
};

const CATEGORIES: Record<string, string> = {
  "salary": "🏢",
  "work": "💻",
  "freelance": "🚀",
  "gift": "💝",
  "bonus": "✨",
  "refund": "↩️",
  "others": "📦",
};

function getCompanyDomain(name: string): string | null {
  const clean = name.toLowerCase().trim();
  
  // Exact mapping match
  if (COMPANY_DOMAINS[clean]) return COMPANY_DOMAINS[clean];
  
  // Check if mapping matches any word in description
  for (const [key, value] of Object.entries(COMPANY_DOMAINS)) {
    if (clean.includes(key)) {
      return value;
    }
  }

  // If already looks like a domain name
  if (clean.includes(".") && !clean.includes(" ") && clean.length > 4) {
    return clean;
  }

  // Simple heuristic: strip words that are not the company name
  const words = clean.split(/\s+/).filter(w => !["salary", "income", "payment", "payout", "invoice", "refund", "july", "june", "august", "september", "october", "november", "december", "january", "february", "march", "april", "may"].includes(w));
  if (words.length > 0 && words[0].length > 2) {
    const simplified = words[0].replace(/[^a-z0-9]/g, "");
    if (simplified.length > 2) {
      return `${simplified}.com`;
    }
  }

  return null;
}

export default function CompanyLogo({ companyName, category, size = 40, className = "" }: CompanyLogoProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [srcIndex, setSrcIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  const domain = useMemo(() => {
    return companyName ? getCompanyDomain(companyName) : null;
  }, [companyName]);

  const sources = useMemo(() => {
    if (!domain) return [];
    return [
      `https://logos.hunter.io/${domain}`,
      `https://logo.clearbit.com/${domain}`,
      `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    ];
  }, [domain]);

  const fallbackIcon = useMemo(() => {
    const cat = (category || "").toLowerCase().trim();
    return CATEGORIES[cat] || "📦";
  }, [category]);

  const handleImgError = () => {
    if (srcIndex < sources.length - 1) {
      setSrcIndex((prev) => prev + 1);
    } else {
      setAllFailed(true);
    }
  };

  const handleImgLoad = () => {
    setImgLoaded(true);
  };

  const showImage = domain && !allFailed && sources.length > 0;

  return (
    <div
      className={`relative flex items-center justify-center rounded-xl overflow-hidden shrink-0 transition-all bg-white/5 border border-white/10 ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
      }}
    >
      {/* Fallback emoji icon */}
      <div 
        className="absolute inset-0 flex items-center justify-center select-none"
        style={{ fontSize: `${size * 0.45}px` }}
      >
        {fallbackIcon}
      </div>

      {/* Real company logo image loaded on the fly */}
      {showImage && (
        <Image
          src={sources[srcIndex]}
          alt={companyName || "Company logo"}
          fill
          unoptimized
          className={`object-contain bg-white transition-opacity duration-300 ${
            imgLoaded ? "opacity-100" : "opacity-0"
          }`}
          onError={handleImgError}
          onLoad={handleImgLoad}
        />
      )}
    </div>
  );
}
