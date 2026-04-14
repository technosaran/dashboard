"use client";

import { useState } from "react";
import Image from "next/image";
import { getBankDomain } from "@/lib/banks";

type BankLogoProps = {
  bankName: string | null | undefined;
  size?: number;
  className?: string;
};

/**
 * Brand-accurate colors for major Indian banks.
 * Used as the fallback logo when real image fails to load.
 */
const BANK_BRANDS: Record<string, { abbr: string; bg: string; fg: string }> = {
  "state bank of india (sbi)":  { abbr: "SBI",   bg: "#1a4d8f", fg: "#ffffff" },
  "sbi":                         { abbr: "SBI",   bg: "#1a4d8f", fg: "#ffffff" },
  "punjab national bank (pnb)": { abbr: "PNB",   bg: "#d71920", fg: "#ffffff" },
  "pnb":                         { abbr: "PNB",   bg: "#d71920", fg: "#ffffff" },
  "bank of baroda (bob)":       { abbr: "BOB",   bg: "#f36f21", fg: "#ffffff" },
  "canara bank":                 { abbr: "CB",    bg: "#ffd700", fg: "#1a237e" },
  "union bank of india":        { abbr: "UBI",   bg: "#e53935", fg: "#ffffff" },
  "bank of india (boi)":        { abbr: "BOI",   bg: "#ff6f00", fg: "#ffffff" },
  "indian bank":                 { abbr: "IB",    bg: "#1565c0", fg: "#ffffff" },
  "central bank of india":      { abbr: "CBI",   bg: "#c62828", fg: "#ffffff" },
  "indian overseas bank":       { abbr: "IOB",   bg: "#0d47a1", fg: "#ffffff" },
  "uco bank":                    { abbr: "UCO",   bg: "#7b1fa2", fg: "#ffffff" },
  "bank of maharashtra":        { abbr: "BOM",   bg: "#1b5e20", fg: "#ffffff" },
  "punjab & sind bank":         { abbr: "PSB",   bg: "#880e4f", fg: "#ffffff" },
  "hdfc bank":                   { abbr: "HDFC",  bg: "#004b8d", fg: "#ffffff" },
  "hdfc":                        { abbr: "HDFC",  bg: "#004b8d", fg: "#ffffff" },
  "icici bank":                  { abbr: "ICICI", bg: "#f57c00", fg: "#ffffff" },
  "icici":                       { abbr: "ICICI", bg: "#f57c00", fg: "#ffffff" },
  "axis bank":                   { abbr: "AXIS",  bg: "#97144d", fg: "#ffffff" },
  "axis":                        { abbr: "AXIS",  bg: "#97144d", fg: "#ffffff" },
  "kotak mahindra bank":        { abbr: "KMB",   bg: "#ed1c24", fg: "#ffffff" },
  "kotak":                       { abbr: "KMB",   bg: "#ed1c24", fg: "#ffffff" },
  "indusind bank":               { abbr: "IIB",   bg: "#1a237e", fg: "#ffffff" },
  "yes bank":                    { abbr: "YES",   bg: "#0033a0", fg: "#ffffff" },
  "idfc first bank":            { abbr: "IDFC",  bg: "#9c1d26", fg: "#ffffff" },
  "federal bank":                { abbr: "FB",    bg: "#002f6c", fg: "#ffd700" },
  "south indian bank":          { abbr: "SIB",   bg: "#009688", fg: "#ffffff" },
  "karnataka bank":              { abbr: "KB",    bg: "#e65100", fg: "#ffffff" },
  "rbl bank":                    { abbr: "RBL",   bg: "#003399", fg: "#ff6600" },
  "karur vysya bank":           { abbr: "KVB",   bg: "#6a1b9a", fg: "#ffffff" },
  "bandhan bank":                { abbr: "BB",    bg: "#e53935", fg: "#ffffff" },
  "idbi bank":                   { abbr: "IDBI",  bg: "#1b5e20", fg: "#ffffff" },
  "city union bank":            { abbr: "CUB",   bg: "#0d47a1", fg: "#ffd700" },
  "dcb bank":                    { abbr: "DCB",   bg: "#1a237e", fg: "#ffffff" },
  "tamilnad mercantile bank":   { abbr: "TMB",   bg: "#b71c1c", fg: "#ffd700" },
  "j&k bank":                   { abbr: "JKB",   bg: "#0d47a1", fg: "#ffffff" },
  "csb bank":                    { abbr: "CSB",   bg: "#f44336", fg: "#ffffff" },
  "dhanlaxmi bank":              { abbr: "DLB",   bg: "#1565c0", fg: "#ffffff" },
  "hsbc india":                  { abbr: "HSBC",  bg: "#db0011", fg: "#ffffff" },
  "hsbc":                        { abbr: "HSBC",  bg: "#db0011", fg: "#ffffff" },
  "standard chartered":         { abbr: "SC",    bg: "#0072aa", fg: "#ffffff" },
  "citibank india":              { abbr: "CITI",  bg: "#003b70", fg: "#ffffff" },
  "citibank":                    { abbr: "CITI",  bg: "#003b70", fg: "#ffffff" },
  "dbs bank india":              { abbr: "DBS",   bg: "#e4002b", fg: "#ffffff" },
  "dbs":                         { abbr: "DBS",   bg: "#e4002b", fg: "#ffffff" },
  "deutsche bank india":        { abbr: "DB",    bg: "#0018a8", fg: "#ffffff" },
  "barclays india":              { abbr: "BRC",   bg: "#00aeef", fg: "#ffffff" },
  "j.p. morgan india":          { abbr: "JPM",   bg: "#003087", fg: "#ffffff" },
  "au small finance bank":      { abbr: "AU",    bg: "#6a1b9a", fg: "#ffd740" },
  "equitas small finance bank": { abbr: "EQ",    bg: "#00695c", fg: "#ffffff" },
  "ujjivan small finance bank": { abbr: "UJ",    bg: "#ff6f00", fg: "#ffffff" },
  "paytm payments bank":        { abbr: "PTM",   bg: "#00baf2", fg: "#042e60" },
  "paytm":                       { abbr: "PTM",   bg: "#00baf2", fg: "#042e60" },
  "airtel payments bank":       { abbr: "AIR",   bg: "#ed1c24", fg: "#ffffff" },
  "jio payments bank":          { abbr: "JIO",   bg: "#0a3878", fg: "#ffffff" },
  "india post payments bank":   { abbr: "IPPB",  bg: "#e53935", fg: "#ffffff" },
  "fino payments bank":         { abbr: "FINO",  bg: "#1565c0", fg: "#ffffff" },
  "jupiter":                     { abbr: "JUP",   bg: "#6c5ce7", fg: "#ffffff" },
  "fi money":                    { abbr: "Fi",    bg: "#6200ea", fg: "#ffffff" },
  "niyo":                        { abbr: "NIYO",  bg: "#1de9b6", fg: "#1a1a2e" },
  "slice":                       { abbr: "SLC",   bg: "#ff3d00", fg: "#ffffff" },
  "onecard":                     { abbr: "1C",    bg: "#000000", fg: "#c0c0c0" },
  "fampay":                      { abbr: "FAM",   bg: "#ffea00", fg: "#1a1a2e" },
  "mobikwik":                    { abbr: "MK",    bg: "#0070f3", fg: "#ffffff" },
  "phonepe":                     { abbr: "PPe",   bg: "#5f259f", fg: "#ffffff" },
  "google pay":                  { abbr: "GPay",  bg: "#4285f4", fg: "#ffffff" },
  "amazon pay":                  { abbr: "APay",  bg: "#ff9900", fg: "#232f3e" },
  "cred":                        { abbr: "CRED",  bg: "#1a1a2e", fg: "#c5a47e" },
  "bharatpe":                    { abbr: "BPe",   bg: "#0041c4", fg: "#ffffff" },
  "zerodha":                     { abbr: "ZRD",   bg: "#387ed1", fg: "#ffffff" },
  "upstox":                      { abbr: "UPX",   bg: "#6c3dab", fg: "#ffffff" },
  "groww":                       { abbr: "GRW",   bg: "#5367ff", fg: "#ffffff" },
  "angel one":                   { abbr: "AO",    bg: "#1f1f2e", fg: "#00d09c" },
  "kuvera":                      { abbr: "KUV",   bg: "#0070f3", fg: "#ffffff" },
  "smallcase":                   { abbr: "SC",    bg: "#2f363f", fg: "#17caa6" },
};

/**
 * Build a list of real logo image URLs from free, no-API-key logo services.
 * Tries multiple CDNs in priority order for maximum coverage.
 */
function getLogoSources(bankName: string): string[] {
  const domain = getBankDomain(bankName);
  if (!domain) return [];

  return [
    // 1. Hunter.io — free, no API key, high-quality real logos
    `https://logos.hunter.io/${domain}`,
    // 2. CompanyEnrich — free, no API key, CDN-backed
    `https://companyenrich.com/api/logo/${domain}`,
    // 3. Google high-res favicon — reliable fallback
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  ];
}

/**
 * BankLogo component — shows the REAL official bank logo.
 *
 * Strategy:
 * 1. Immediately shows brand-colored abbreviation as placeholder
 * 2. Loads real logo image in background from free CDNs
 * 3. If real logo loads → fades it in over the placeholder
 * 4. If all sources fail → keeps the beautiful branded placeholder
 */
export default function BankLogo({ bankName, size = 40, className = "" }: BankLogoProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [srcIndex, setSrcIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  const sources = bankName ? getLogoSources(bankName) : [];
  const key = bankName?.toLowerCase().trim() || "";
  const brand = BANK_BRANDS[key];

  // Generate fallback styling
  const getFallbackStyle = () => {
    if (brand) {
      const fontSize = size * (brand.abbr.length > 3 ? 0.22 : brand.abbr.length > 2 ? 0.26 : 0.32);
      return {
        background: brand.bg,
        color: brand.fg,
        fontSize: `${fontSize}px`,
        boxShadow: `0 4px 14px ${brand.bg}44, inset 0 1px 0 rgba(255,255,255,0.15)`,
      };
    }

    // Unknown bank — deterministic color
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    const bgColor = `hsl(${hue}, 55%, 45%)`;

    const initials = getInitials(bankName || "");
    const fontSize = size * (initials.length > 2 ? 0.26 : 0.34);
    return {
      background: `linear-gradient(135deg, ${bgColor}, hsl(${(hue + 30) % 360}, 55%, 50%))`,
      color: "#ffffff",
      fontSize: `${fontSize}px`,
      boxShadow: `0 4px 14px ${bgColor}44, inset 0 1px 0 rgba(255,255,255,0.2)`,
    };
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    if (brand) return brand.abbr;
    return name
      .replace(/\(.*?\)/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || name.charAt(0).toUpperCase();
  };

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

  if (!bankName) {
    return (
      <div
        className={`flex items-center justify-center rounded-full ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <svg
          width={size * 0.45}
          height={size * 0.45}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
          style={{ color: "var(--text-muted)" }}
        >
          <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>
    );
  }

  const fallbackStyle = getFallbackStyle();
  const brandBg = brand?.bg || "rgba(108,92,231,0.5)";

  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center select-none ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: "var(--radius-md, 12px)",
        background: imgLoaded ? "white" : `${brandBg}18`,
        border: imgLoaded ? "1px solid rgba(255,255,255,0.08)" : `1px solid ${brandBg}35`,
        transition: "all 0.3s ease",
      }}
      title={bankName}
    >
      {/* Branded abbreviation (visible until real logo loads) */}
      <span
        style={{
          ...fallbackStyle,
          background: "none",
          boxShadow: "none",
          opacity: imgLoaded ? 0 : 1,
          transition: "opacity 0.3s ease",
          letterSpacing: "0.3px",
          fontWeight: 900,
        }}
      >
        {getInitials(bankName)}
      </span>

      {/* Real logo image (fades in over the abbreviation) */}
      {sources.length > 0 && !allFailed && (
        <Image
          src={sources[srcIndex]}
          alt={`${bankName} logo`}
          width={size}
          height={size}
          sizes={`${size}px`}
          onLoad={handleImgLoad}
          onError={handleImgError}
          style={{
            position: "absolute",
            inset: "0",
            width: `${size}px`,
            height: `${size}px`,
            objectFit: "contain",
            padding: `${Math.max(size * 0.15, 6)}px`,
            borderRadius: "var(--radius-md, 12px)",
            opacity: imgLoaded ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        />
      )}
    </div>
  );
}
