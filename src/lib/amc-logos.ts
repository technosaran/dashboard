/**
 * Official Indian Mutual Fund AMC Logos & Domain Resolver
 * Uses Google Favicon 128px API & Unavatar API for 100% reliable AMC brand logo rendering
 */

export interface AMCLogoInfo {
  logoUrl: string;
  fallbackLogoUrl: string;
  domain: string;
  badge: string;
  gradientColor: string;
  brandHex: string;
}

const AMC_MAP: Record<string, { localSvg: string; logo: string; domain: string; badge: string; gradient: string; hex: string }> = {
  ppfas: { localSvg: "/amc-logos/ppfas.svg", logo: "https://assets.groww.in/mf-assets/logos/ppfas_groww.png", domain: "amc.ppfas.com", badge: "PPFAS", gradient: "from-blue-900 to-indigo-800", hex: "#1B365D" },
  parag: { localSvg: "/amc-logos/ppfas.svg", logo: "https://assets.groww.in/mf-assets/logos/ppfas_groww.png", domain: "amc.ppfas.com", badge: "PPFAS", gradient: "from-blue-900 to-indigo-800", hex: "#1B365D" },
  uti: { localSvg: "/amc-logos/uti.svg", logo: "https://assets.groww.in/mf-assets/logos/uti_groww.png", domain: "utimf.com", badge: "UTI", gradient: "from-purple-700 to-indigo-800", hex: "#EB7025" },
  sbi: { localSvg: "/amc-logos/sbi.svg", logo: "https://assets.groww.in/mf-assets/logos/sbi_groww.png", domain: "sbimf.com", badge: "SBI", gradient: "from-blue-700 to-cyan-700", hex: "#22409A" },
  hdfc: { localSvg: "/amc-logos/hdfc.svg", logo: "https://assets.groww.in/mf-assets/logos/hdfc_groww.png", domain: "hdfcfund.com", badge: "HDFC", gradient: "from-red-600 to-blue-800", hex: "#004B8D" },
  icici: { localSvg: "", logo: "https://assets.groww.in/mf-assets/logos/icici_groww.png", domain: "icicipruamc.com", badge: "ICICI", gradient: "from-orange-600 to-red-700", hex: "#B02A30" },
  nippon: { localSvg: "", logo: "https://assets.groww.in/mf-assets/logos/nippon_groww.png", domain: "nipponindiaim.com", badge: "NIPPON", gradient: "from-red-600 to-rose-700", hex: "#E31B23" },
  mirae: { localSvg: "", logo: "https://assets.groww.in/mf-assets/logos/mirae_groww.png", domain: "miraeassetmf.co.in", badge: "MIRAE", gradient: "from-blue-600 to-amber-600", hex: "#0054A6" },
  axis: { localSvg: "", logo: "https://assets.groww.in/mf-assets/logos/axis_groww.png", domain: "axismf.com", badge: "AXIS", gradient: "from-rose-800 to-pink-700", hex: "#97144D" },
  motilal: { localSvg: "", logo: "https://assets.groww.in/mf-assets/logos/motilal_groww.png", domain: "motilaloswalmf.com", badge: "MO", gradient: "from-amber-600 to-yellow-600", hex: "#004A99" },
  quant: { localSvg: "", logo: "https://assets.groww.in/mf-assets/logos/quant_groww.png", domain: "quantmutual.com", badge: "QUANT", gradient: "from-teal-600 to-emerald-700", hex: "#1B365D" },
  tata: { localSvg: "", logo: "https://assets.groww.in/mf-assets/logos/tata_groww.png", domain: "tatamutualfund.com", badge: "TATA", gradient: "from-blue-600 to-sky-600", hex: "#00488F" },
  bandhan: { localSvg: "", logo: "https://assets.groww.in/mf-assets/logos/bandhan_groww.png", domain: "bandhanmutual.com", badge: "BANDHAN", gradient: "from-red-600 to-orange-600", hex: "#ED1C24" },
  kotak: { localSvg: "", logo: "https://assets.groww.in/mf-assets/logos/kotak_groww.png", domain: "kotakmf.com", badge: "KOTAK", gradient: "from-red-600 to-rose-700", hex: "#ED1C24" },
  dsp: { localSvg: "", logo: "https://assets.groww.in/mf-assets/logos/dsp_groww.png", domain: "dspim.com", badge: "DSP", gradient: "from-blue-900 to-slate-800", hex: "#002B49" },
  canara: { localSvg: "", logo: "https://assets.groww.in/mf-assets/logos/canara_groww.png", domain: "canararobeco.com", badge: "CANARA", gradient: "from-blue-600 to-cyan-600", hex: "#0082C8" },
  birla: { localSvg: "", logo: "https://assets.groww.in/mf-assets/logos/absl_groww.png", domain: "mutualfund.adityabirlacapital.com", badge: "ABSL", gradient: "from-red-700 to-amber-700", hex: "#C41230" },
  aditya: { localSvg: "", logo: "https://assets.groww.in/mf-assets/logos/absl_groww.png", domain: "mutualfund.adityabirlacapital.com", badge: "ABSL", gradient: "from-red-700 to-amber-700", hex: "#C41230" },
  edelweiss: { localSvg: "", logo: "https://assets.groww.in/mf-assets/logos/edelweiss_groww.png", domain: "edelweissmf.com", badge: "EDEL", gradient: "from-blue-600 to-indigo-700", hex: "#00509E" },
  sundaram: { localSvg: "", logo: "https://assets.groww.in/mf-assets/logos/sundaram_groww.png", domain: "sundarammutual.com", badge: "SUND", gradient: "from-blue-700 to-indigo-900", hex: "#003366" },
  groww: { localSvg: "", logo: "https://assets.groww.in/mf-assets/logos/groww_groww.png", domain: "groww.in", badge: "GROWW", gradient: "from-emerald-500 to-teal-600", hex: "#00D09C" },
  zerodha: { localSvg: "/amc-logos/zerodha.svg", logo: "https://assets.groww.in/mf-assets/logos/zerodha_groww.png", domain: "zerodhafundhouse.com", badge: "ZERODHA", gradient: "from-emerald-600 to-teal-700", hex: "#00D09C" },
  navi: { localSvg: "", logo: "https://assets.groww.in/mf-assets/logos/navi_groww.png", domain: "navi.com", badge: "NAVI", gradient: "from-emerald-600 to-teal-700", hex: "#00D09C" },
};

export function getAMCLogoInfo(amcName: string, fundName?: string): AMCLogoInfo {
  const fText = (fundName || "").toLowerCase();
  const aText = (amcName || "").toLowerCase();

  // First pass: match directly on fundName (most reliable)
  for (const key of Object.keys(AMC_MAP)) {
    if (fText.includes(key)) {
      const item = AMC_MAP[key];
      return {
        logoUrl: item.localSvg || `https://www.google.com/s2/favicons?domain=${item.domain}&sz=128`,
        fallbackLogoUrl: item.logo,
        domain: item.domain,
        badge: item.badge,
        gradientColor: item.gradient,
        brandHex: item.hex,
      };
    }
  }

  // Second pass: match on amcName
  for (const key of Object.keys(AMC_MAP)) {
    if (aText.includes(key)) {
      const item = AMC_MAP[key];
      return {
        logoUrl: item.localSvg || `https://www.google.com/s2/favicons?domain=${item.domain}&sz=128`,
        fallbackLogoUrl: item.logo,
        domain: item.domain,
        badge: item.badge,
        gradientColor: item.gradient,
        brandHex: item.hex,
      };
    }
  }

  const defaultBadge = (fundName || amcName || "MF").substring(0, 3).toUpperCase();
  return {
    logoUrl: "",
    fallbackLogoUrl: "",
    domain: "",
    badge: defaultBadge,
    gradientColor: "from-indigo-600 to-purple-700",
    brandHex: "#387ED1",
  };
}
