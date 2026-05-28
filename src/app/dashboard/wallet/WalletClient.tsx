"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Wifi, CreditCard, Plus, X, ArrowUpRight, Check, Lock, Plane, 
  Film, MapPin, Sparkles, Send, TrendingUp, User, ShoppingBag, 
  Utensils, Car, Tv, ChevronRight, RefreshCw, CircleAlert 
} from "lucide-react";
import { useFinanceData } from "@/hooks/use-finance-data";
import { createClient } from "@/lib/supabase-browser";
import { useUser } from "@/context/user-context";
import toast from "react-hot-toast";

type Transaction = {
  id: string;
  merchant: string;
  category: "food" | "shopping" | "travel" | "entertainment" | "transfer";
  amount: number;
  date: string;
  time: string;
  status: "completed" | "pending" | "declined";
  location: string;
  coordinates: { x: number; y: number };
  receiptId: string;
};

type CardTheme = "chroma" | "sunset" | "stealth" | "cyber" | "royal" | "pass-flight" | "pass-cinema" | "pass-transit";

type WalletItem = {
  id: string;
  type: "credit" | "debit" | "boarding-pass" | "cinema-ticket" | "transit-card";
  name: string;
  bankName: string;
  cardNumber: string;
  balance: number;
  currency: string;
  expiry: string;
  cvv: string;
  theme: CardTheme;
  limit?: number;
  // Ticket-specific fields
  flightNumber?: string;
  from?: string;
  to?: string;
  gate?: string;
  seat?: string;
  boardingTime?: string;
  movieTitle?: string;
  theater?: string;
  screen?: string;
  showTime?: string;
};

// Preset cards and tickets
const PRESET_ITEMS: WalletItem[] = [
  {
    id: "preset-chroma",
    type: "credit",
    name: "Alex Mercer",
    bankName: "Chase Sapphire",
    cardNumber: "•••• •••• •••• 4892",
    balance: 14250.75,
    currency: "USD",
    expiry: "09/29",
    cvv: "382",
    theme: "chroma",
    limit: 25000,
  },
  {
    id: "preset-sunset",
    type: "credit",
    name: "Alex Mercer",
    bankName: "Apple Card",
    cardNumber: "•••• •••• •••• 8831",
    balance: 8320.00,
    currency: "USD",
    expiry: "12/28",
    cvv: "109",
    theme: "sunset",
    limit: 15000,
  },
  {
    id: "preset-stealth",
    type: "debit",
    name: "Alex Mercer",
    bankName: "Stealth Wealth",
    cardNumber: "•••• •••• •••• 2050",
    balance: 2450.40,
    currency: "USD",
    expiry: "04/31",
    cvv: "910",
    theme: "stealth",
  },
  {
    id: "preset-boarding",
    type: "boarding-pass",
    name: "Alex Mercer",
    bankName: "United Airlines",
    cardNumber: "UA9281",
    balance: 0,
    currency: "USD",
    expiry: "28 May",
    cvv: "",
    theme: "pass-flight",
    flightNumber: "UA 248",
    from: "SFO",
    to: "JFK",
    gate: "B12",
    seat: "08F",
    boardingTime: "14:20",
  },
  {
    id: "preset-cinema",
    type: "cinema-ticket",
    name: "Alex Mercer",
    bankName: "IMAX Theaters",
    cardNumber: "IMX-9921",
    balance: 0,
    currency: "USD",
    expiry: "Tonight",
    cvv: "",
    theme: "pass-cinema",
    movieTitle: "Dune: Part Two",
    theater: "AMC Metreon 16",
    screen: "IMAX Laser 1",
    showTime: "20:15",
    seat: "H-12",
  }
];

const MOCK_TRANSACTIONS: Record<string, Transaction[]> = {
  "preset-chroma": [
    { id: "tx-1", merchant: "Apple Store Infinite Loop", category: "shopping", amount: 1299.00, date: "May 26, 2026", time: "14:32", status: "completed", location: "Cupertino, CA", coordinates: { x: 30, y: 40 }, receiptId: "RC-8921-X9" },
    { id: "tx-2", merchant: "Le Bernardin French", category: "food", amount: 382.40, date: "May 25, 2026", time: "20:15", status: "completed", location: "New York, NY", coordinates: { x: 60, y: 70 }, receiptId: "RC-4829-Y3" },
    { id: "tx-3", merchant: "Shell Fuel Station", category: "travel", amount: 64.20, date: "May 24, 2026", time: "11:05", status: "completed", location: "San Jose, CA", coordinates: { x: 45, y: 20 }, receiptId: "RC-1029-A1" }
  ],
  "preset-sunset": [
    { id: "tx-4", merchant: "Whole Foods Market", category: "food", amount: 142.10, date: "May 27, 2026", time: "09:45", status: "completed", location: "San Francisco, CA", coordinates: { x: 25, y: 80 }, receiptId: "RC-3891-W2" },
    { id: "tx-5", merchant: "Uber Premium Drive", category: "travel", amount: 35.80, date: "May 26, 2026", time: "18:22", status: "completed", location: "San Francisco, CA", coordinates: { x: 75, y: 45 }, receiptId: "RC-7721-P0" },
    { id: "tx-6", merchant: "Netflix Subscription", category: "entertainment", amount: 22.99, date: "May 18, 2026", time: "01:00", status: "completed", location: "Online Auto-Pay", coordinates: { x: 50, y: 50 }, receiptId: "RC-2281-Z7" }
  ],
  "preset-stealth": [
    { id: "tx-7", merchant: "Starbucks Coffee", category: "food", amount: 8.75, date: "May 28, 2026", time: "07:30", status: "completed", location: "Palo Alto, CA", coordinates: { x: 10, y: 90 }, receiptId: "RC-9981-D1" },
    { id: "tx-8", merchant: "Blue Bottle Roastery", category: "food", amount: 14.50, date: "May 27, 2026", time: "15:40", status: "completed", location: "Oakland, CA", coordinates: { x: 85, y: 15 }, receiptId: "RC-4481-H8" }
  ]
};

export default function WalletClient({ initialData }: { initialData?: any }) {
  const { data: finance } = useFinanceData(initialData);
  const { user_id } = useUser();
  const [dbAccounts, setDbAccounts] = useState<WalletItem[]>([]);
  const [items, setItems] = useState<WalletItem[]>(PRESET_ITEMS);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  
  // Apple Pay checkout state
  const [isApplePayOpen, setIsApplePayOpen] = useState(false);
  const [dynamicIsland, setDynamicIsland] = useState<"idle" | "charging" | "faceid" | "success" | "nfc" | "card-added">("idle");
  const [faceIdText, setFaceIdText] = useState("Double Click to Pay");
  
  // Customizer state
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [newCard, setNewCard] = useState<Partial<WalletItem>>({
    type: "credit",
    name: "Alex Mercer",
    bankName: "Apex Platinum",
    cardNumber: "4532 9812 4028 1192",
    balance: 5000.00,
    currency: "USD",
    expiry: "08/30",
    cvv: "329",
    theme: "royal",
    limit: 10000,
  });
  const [cvvFocused, setCvvFocused] = useState(false);

  // Send Money state
  const [sendMoneyOpen, setSendMoneyOpen] = useState(false);
  const [sendAmount, setSendAmount] = useState("");
  const [selectedRecipientId, setSelectedRecipientId] = useState("");

  // Detailed Transaction Drawer state
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Active items mapping
  const activeItem = useMemo(() => items.find(i => i.id === activeItemId), [items, activeItemId]);
  const activeTransactions = useMemo(() => {
    if (!activeItemId) return [];
    return MOCK_TRANSACTIONS[activeItemId] || [
      { id: "tx-mock-1", merchant: "Simulated Transaction", category: "shopping", amount: 45.00, date: "Just now", time: "10:15", status: "completed", location: "Simulated Shop", coordinates: { x: 50, y: 50 }, receiptId: "RC-SIM-01" },
      { id: "tx-mock-2", merchant: "Monthly Cashback Credited", category: "transfer", amount: -15.50, date: "Yesterday", time: "12:00", status: "completed", location: "Loyalty Program", coordinates: { x: 30, y: 30 }, receiptId: "RC-SIM-02" }
    ];
  }, [activeItemId]);

  // Load real Supabase accounts as Cards
  useEffect(() => {
    if (finance?.accounts && finance.accounts.length > 0) {
      const formatted: WalletItem[] = finance.accounts.map((acc: any, idx: number) => {
        const themes: CardTheme[] = ["royal", "chroma", "sunset", "stealth"];
        const selectedTheme = themes[idx % themes.length];
        
        return {
          id: `db-${acc.id}`,
          type: acc.type === "cash" ? "debit" : "credit",
          name: finance.profile?.username || "Account Owner",
          bankName: acc.bank_name || acc.name,
          cardNumber: `•••• •••• •••• ${idx + 2}04${idx}`,
          balance: Number(acc.balance),
          currency: acc.currency || "USD",
          expiry: "09/30",
          cvv: "305",
          theme: selectedTheme,
          limit: acc.type === "credit" ? 10000 : undefined
        };
      });
      setDbAccounts(formatted);
      // Merge them into the list, keeping preset tickets and standard cards
      setItems([...formatted, ...PRESET_ITEMS]);
    }
  }, [finance]);

  // Handle Apple Pay Double Click Trigger
  const triggerApplePay = () => {
    if (isApplePayOpen) return;
    setIsApplePayOpen(true);
    setDynamicIsland("faceid");
    setFaceIdText("Verifying Face ID...");
    
    // Animate Face ID recognition
    setTimeout(() => {
      setDynamicIsland("success");
      setFaceIdText("Verified");
      
      // Animate to NFC Wave
      setTimeout(() => {
        setDynamicIsland("nfc");
        
        // Complete transaction
        setTimeout(() => {
          setDynamicIsland("idle");
          setIsApplePayOpen(false);
          toast.success("Contactless payment processed via Apple Pay!", {
            icon: "💳",
            style: {
              background: "#1e293b",
              color: "#fff",
              border: "1px solid rgba(14,165,233,0.2)"
            }
          });
        }, 3000);
      }, 1500);
    }, 2000);
  };

  // Add Custom Card
  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCard.bankName || !newCard.cardNumber) {
      toast.error("Please fill in all card details.");
      return;
    }

    const cardId = `custom-${Date.now()}`;
    const formattedCard: WalletItem = {
      id: cardId,
      type: newCard.type as "credit" | "debit",
      name: newCard.name || "Cardholder",
      bankName: newCard.bankName,
      cardNumber: newCard.cardNumber.replace(/(\d{4})/g, "$1 ").trim(),
      balance: Number(newCard.balance) || 0,
      currency: newCard.currency || "USD",
      expiry: newCard.expiry || "12/30",
      cvv: newCard.cvv || "000",
      theme: newCard.theme as CardTheme,
      limit: newCard.type === "credit" ? Number(newCard.limit) : undefined
    };

    setItems([formattedCard, ...items]);
    setCustomizerOpen(false);
    
    // Dynamic Island notification
    setDynamicIsland("card-added");
    setTimeout(() => setDynamicIsland("idle"), 3000);
    
    toast.success("New digital card added to your secure wallet!", {
      icon: "⚡",
      style: {
        background: "#0f172a",
        color: "#fff",
        border: "1px solid rgba(16,185,129,0.3)"
      }
    });
  };

  // Process Money Transfer
  const handleSendMoney = async () => {
    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount to send.");
      return;
    }

    if (!activeItem) {
      toast.error("No active card selected.");
      return;
    }

    if (activeItem.balance < amount) {
      toast.error("Insufficient funds on this card.");
      return;
    }

    // Trigger FaceID confirmation animation
    setDynamicIsland("faceid");
    setFaceIdText("Confirming Transfer...");
    
    setTimeout(async () => {
      setDynamicIsland("success");
      setFaceIdText("Transferred Successfully");
      
      // Update UI balance
      setItems(prev => prev.map(item => {
        if (item.id === activeItem.id) {
          return { ...item, balance: item.balance - amount };
        }
        return item;
      }));

      // Add mock transaction
      const newTx: Transaction = {
        id: `tx-send-${Date.now()}`,
        merchant: selectedRecipientId 
          ? `Transfer to ${finance?.recipients?.find((r: any) => r.id === selectedRecipientId)?.name || "Recipient"}`
          : "Secure Cash Transfer",
        category: "transfer",
        amount: amount,
        date: "Today",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: "completed",
        location: "Digital Transfer Network",
        coordinates: { x: 50, y: 50 },
        receiptId: `RC-TX-${Date.now().toString().slice(-6)}`
      };

      MOCK_TRANSACTIONS[activeItem.id] = [newTx, ...(MOCK_TRANSACTIONS[activeItem.id] || [])];
      
      // Attempt database sync if real account
      if (activeItem.id.startsWith("db-") && user_id) {
        const dbId = activeItem.id.replace("db-", "");
        const supabase = createClient();
        
        // Log transaction to database using atomic operations
        if (selectedRecipientId) {
          // Log a family recipient transfer
          const { error } = await supabase.rpc("process_family_transfer", {
            p_account_id: dbId,
            p_amount: amount,
            p_note: `Mobile Wallet Transfer to Contact`,
            p_recipient_id: selectedRecipientId,
            p_user_id: user_id
          });
          if (error) console.error("Family transfer database sync failed:", error.message);
        } else {
          // Log an adjustment (outflow) for peer cash transfer
          const { error } = await supabase.rpc("adjust_account_balance", {
            p_account_id: dbId,
            p_amount: -amount,
            p_note: `Mobile Wallet Cash Outflow`,
            p_user_id: user_id
          });
          if (error) console.error("Cash balance adjust database sync failed:", error.message);
        }
      }

      setTimeout(() => {
        setDynamicIsland("idle");
        setSendMoneyOpen(false);
        setSendAmount("");
        toast.success(`Sent $${amount.toFixed(2)} successfully!`);
      }, 1500);

    }, 2000);
  };

  // Process Card Top-Up
  const handleTopUp = () => {
    if (!activeItem) return;
    const topUpAmount = 500;
    
    setDynamicIsland("charging");
    setTimeout(() => {
      setItems(prev => prev.map(item => {
        if (item.id === activeItem.id) {
          return { ...item, balance: item.balance + topUpAmount };
        }
        return item;
      }));

      const newTx: Transaction = {
        id: `tx-topup-${Date.now()}`,
        merchant: "Direct Deposit Funding",
        category: "transfer",
        amount: -topUpAmount, // Negative represents incoming funding
        date: "Today",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: "completed",
        location: "Mobile Top-Up Hub",
        coordinates: { x: 50, y: 50 },
        receiptId: `RC-DEP-${Date.now().toString().slice(-6)}`
      };

      MOCK_TRANSACTIONS[activeItem.id] = [newTx, ...(MOCK_TRANSACTIONS[activeItem.id] || [])];
      setDynamicIsland("idle");
      toast.success(`Topped up card balance by $${topUpAmount.toFixed(2)}!`);
    }, 1500);
  };

  // Helper theme renderers
  const getCardStyle = (theme: CardTheme) => {
    switch (theme) {
      case "chroma":
        return "bg-gradient-to-tr from-sky-400 via-indigo-500 to-purple-600 shadow-[0_15px_30px_rgba(99,102,241,0.3)] text-white";
      case "sunset":
        return "bg-gradient-to-tr from-amber-500 via-orange-600 to-rose-600 shadow-[0_15px_30px_rgba(244,63,94,0.3)] text-white";
      case "stealth":
        return "bg-gradient-to-br from-neutral-800 via-neutral-900 to-black border border-neutral-700/40 shadow-[0_15px_35px_rgba(0,0,0,0.6)] text-white";
      case "cyber":
        return "bg-gradient-to-tr from-teal-400 via-cyan-500 to-fuchsia-600 shadow-[0_15px_30px_rgba(6,182,212,0.3)] text-white";
      case "royal":
        return "bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 border border-indigo-500/20 shadow-[0_15px_30px_rgba(79,70,229,0.25)] text-indigo-100";
      case "pass-flight":
        return "bg-blue-600 text-white shadow-[0_12px_24px_rgba(37,99,235,0.2)]";
      case "pass-cinema":
        return "bg-rose-950/95 border border-rose-500/25 text-rose-100 shadow-[0_12px_24px_rgba(244,63,94,0.15)]";
      default:
        return "bg-gradient-to-tr from-slate-600 to-slate-800 text-white";
    }
  };

  const getCategoryIcon = (cat: Transaction["category"]) => {
    switch (cat) {
      case "food": return <Utensils className="w-4 h-4 text-emerald-400" />;
      case "shopping": return <ShoppingBag className="w-4 h-4 text-sky-400" />;
      case "travel": return <Car className="w-4 h-4 text-amber-400" />;
      case "entertainment": return <Tv className="w-4 h-4 text-fuchsia-400" />;
      default: return <Send className="w-4 h-4 text-indigo-400" />;
    }
  };

  const formatCardNumber = (num: string) => {
    const raw = num.replace(/\s+/g, "");
    const parts = raw.match(/.{1,4}/g);
    return parts ? parts.join(" ") : num;
  };

  return (
    <div className="w-full relative min-h-screen">
      
      {/* Background radial spotlights */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[90px] pointer-events-none z-0" />

      {/* Main Grid: Info Section & Simulator Mockup */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start relative z-10">
        
        {/* Left Side: Dynamic App Features & Sandbox Info */}
        <div className="xl:col-span-7 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[rgba(14,165,233,0.1)] text-[--accent-primary-light] border border-[rgba(14,165,233,0.15)]">
              <Sparkles className="w-3.5 h-3.5" /> Premium Simulator
            </div>
            <h1 className="text-4xl font-black text-[--text-primary] tracking-tight sm:text-5xl">
              Digital Wallet <span className="text-gradient">Experience</span>
            </h1>
            <p className="text-sm text-[--text-secondary] max-w-xl leading-relaxed">
              Explore your personal credit cards, debit accounts, transit vouchers, and boarding passes in a hyper-realistic, interactive mobile environment.
            </p>
          </div>

          {/* Quick Actions Panel */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button 
              onClick={() => setCustomizerOpen(true)}
              className="glass-card flex flex-col items-start gap-4 p-5 hover:border-[--accent-primary]/40 transition-all hover:-translate-y-0.5 group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-[--accent-primary]/15 flex items-center justify-center text-[--accent-primary-light] group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-[--text-primary]">Add Custom Card</h3>
                <p className="text-[10px] text-[--text-muted] mt-1">Design & inject custom physical gradients.</p>
              </div>
            </button>

            <button 
              onClick={() => {
                if (!activeItemId) {
                  toast.error("Please click on a card inside the phone to select it first!");
                  return;
                }
                setSendMoneyOpen(true);
              }}
              className="glass-card flex flex-col items-start gap-4 p-5 hover:border-emerald-500/40 transition-all hover:-translate-y-0.5 group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-[--text-primary]">Send Peer Money</h3>
                <p className="text-[10px] text-[--text-muted] mt-1">Transfer simulated cash to household contacts.</p>
              </div>
            </button>

            <button 
              onClick={() => {
                if (!activeItemId) {
                  toast.error("Please select a card inside the phone frame first!");
                  return;
                }
                handleTopUp();
              }}
              className="glass-card flex flex-col items-start gap-4 p-5 hover:border-amber-500/40 transition-all hover:-translate-y-0.5 group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-[--text-primary]">Add Funds</h3>
                <p className="text-[10px] text-[--text-muted] mt-1">Quick top-up your active card by $500.</p>
              </div>
            </button>
          </div>

          {/* Interactive instruction guides */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-[--text-primary] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[--accent-primary]" /> Simulator Controls
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-[--text-secondary]">
              <li className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-[--accent-primary]/15 text-[--accent-primary-light] flex items-center justify-center font-bold text-[8px] mt-0.5">1</span>
                <span>Click **Lock/Power button** on the right side of the phone frame to prompt **Apple Pay checkout**.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-[--accent-primary]/15 text-[--accent-primary-light] flex items-center justify-center font-bold text-[8px] mt-0.5">2</span>
                <span>Click any card/ticket in the phone screen to expand details, balances, and real-time transaction ledger.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-[--accent-primary]/15 text-[--accent-primary-light] flex items-center justify-center font-bold text-[8px] mt-0.5">3</span>
                <span>Focus the **CVV field** in the custom card form to trigger an automatic **3D physics flip**!</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-[--accent-primary]/15 text-[--accent-primary-light] flex items-center justify-center font-bold text-[8px] mt-0.5">4</span>
                <span>Double click the side power button inside the Apple Pay sheet to verify Face ID identity.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Side: iPhone 16 Pro Simulator Mockup */}
        <div className="xl:col-span-5 flex justify-center py-4">
          
          {/* Main phone body container */}
          <div className="relative group/phone">
            
            {/* Phone physical buttons overlay */}
            {/* Action button (Left top) */}
            <div className="absolute top-[130px] -left-[3px] w-[3px] h-[24px] bg-neutral-800 rounded-l-md border-l border-neutral-700/50 z-20" />
            {/* Volume Up (Left middle) */}
            <div className="absolute top-[175px] -left-[3px] w-[3px] h-[50px] bg-neutral-800 rounded-l-md border-l border-neutral-700/50 z-20" />
            {/* Volume Down (Left lower) */}
            <div className="absolute top-[240px] -left-[3px] w-[3px] h-[50px] bg-neutral-800 rounded-l-md border-l border-neutral-700/50 z-20" />
            
            {/* Lock / Power button (Right side) - Double-click trigger */}
            <button 
              onClick={triggerApplePay}
              title="Click to Lock / Double-Click to pay with Apple Pay"
              className="absolute top-[180px] -right-[3px] w-[3.5px] h-[80px] bg-neutral-800 hover:bg-neutral-600 rounded-r-md border-r border-neutral-700/50 z-25 active:scale-x-75 transition-all"
            />
            {/* Double click helper spotlight */}
            <div className="absolute top-[205px] -right-16 hidden lg:flex flex-col items-center gap-1.5 z-10 pointer-events-none group-hover/phone:translate-x-1 transition-transform">
              <span className="text-[8px] font-black uppercase bg-sky-500 text-white px-2 py-0.5 rounded-full shadow-md animate-pulse">Power Button</span>
              <span className="text-[7px] font-black text-sky-400/80 uppercase">Click for Apple Pay</span>
            </div>

            {/* Simulated Phone Chassis */}
            <div 
              className="w-[340px] h-[680px] rounded-[52px] border-[10px] border-neutral-900 bg-neutral-950 relative overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.8)]"
              style={{ outline: "1px solid #262626" }}
            >
              
              {/* Phone screen glare line */}
              <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-white/[0.02] to-transparent pointer-events-none z-40" />

              {/* IOS StatusBar */}
              <div className="absolute top-0 inset-x-0 h-10 px-8 flex items-center justify-between z-30 select-none pointer-events-none text-white text-[11px] font-bold">
                <span>9:41</span>
                <div className="flex items-center gap-1.5 opacity-80">
                  <span className="text-[8px] tracking-widest font-black uppercase">5G</span>
                  <Wifi className="w-3 h-3" />
                  {/* Battery cell */}
                  <div className="w-5 h-2.5 rounded-[3px] border border-white/50 p-0.5 flex items-center justify-start">
                    <div className="h-full w-4 bg-white rounded-[1px]" />
                  </div>
                </div>
              </div>

              {/* Dynamic Island Component */}
              <div className="absolute top-3.5 inset-x-0 flex justify-center z-50 pointer-events-none">
                <motion.div 
                  layout
                  className={`bg-black rounded-full flex items-center justify-center text-white px-3 relative border border-white/10 ${
                    dynamicIsland === "idle" ? "w-24 h-6" :
                    dynamicIsland === "charging" ? "w-44 h-12" :
                    dynamicIsland === "faceid" ? "w-48 h-32 rounded-[28px]" :
                    dynamicIsland === "success" ? "w-40 h-12" :
                    dynamicIsland === "nfc" ? "w-44 h-20" :
                    "w-48 h-10"
                  }`}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                >
                  <AnimatePresence mode="wait">
                    {dynamicIsland === "idle" && (
                      <motion.div key="idle" className="w-2 h-2 bg-neutral-800 rounded-full absolute left-4" />
                    )}

                    {dynamicIsland === "charging" && (
                      <motion.div 
                        key="charging" 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }} 
                        className="flex items-center gap-3 text-xs w-full justify-between px-2"
                      >
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-amber-400">⚡</span>
                          <span className="font-bold text-[9px] uppercase tracking-wide">Adding Funds...</span>
                        </div>
                        <span className="text-[10px] font-black text-amber-400">+$500.00</span>
                      </motion.div>
                    )}

                    {dynamicIsland === "faceid" && (
                      <motion.div 
                        key="faceid" 
                        initial={{ opacity: 0, scale: 0.8 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        exit={{ opacity: 0 }} 
                        className="flex flex-col items-center justify-center gap-3 w-full"
                      >
                        <div className="relative w-10 h-10 flex items-center justify-center">
                          {/* Face ID outer ring */}
                          <div className="absolute inset-0 border-[2px] border-dashed border-sky-400 rounded-full animate-[spin_8s_linear_infinite]" />
                          {/* Face ID camera look */}
                          <div className="w-4 h-4 rounded-full border-2 border-sky-400 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-sky-400 rounded-full" />
                          </div>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-sky-400 text-center">Face ID Scanning</span>
                      </motion.div>
                    )}

                    {dynamicIsland === "success" && (
                      <motion.div 
                        key="success" 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }} 
                        className="flex items-center gap-2 text-xs w-full justify-center text-emerald-400"
                      >
                        <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                        <span className="font-black text-[9px] uppercase tracking-wider">Verification OK</span>
                      </motion.div>
                    )}

                    {dynamicIsland === "nfc" && (
                      <motion.div 
                        key="nfc" 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }} 
                        className="flex flex-col items-center justify-center gap-1.5 w-full text-center"
                      >
                        {/* NFC concentric waves */}
                        <div className="flex items-center justify-center gap-1">
                          <div className="w-1 h-3 bg-sky-400 rounded-full animate-pulse" />
                          <div className="w-1 h-5 bg-sky-400 rounded-full" style={{ animationDelay: "0.2s" }} />
                          <div className="w-1 h-3 bg-sky-400 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }} />
                        </div>
                        <span className="text-[8px] font-bold tracking-widest text-sky-200 uppercase">Hold Near Reader</span>
                      </motion.div>
                    )}

                    {dynamicIsland === "card-added" && (
                      <motion.div 
                        key="card-added" 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }} 
                        className="flex items-center gap-2 text-xs w-full justify-center text-indigo-400"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="font-black text-[9px] uppercase tracking-widest">Passbook Synced</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>

              {/* IOS Main Screen Content */}
              <div className="absolute inset-0 pt-11 px-4 pb-6 overflow-y-auto no-scrollbar flex flex-col justify-between select-none">
                
                {/* Active / Expanded Card view */}
                <AnimatePresence mode="wait">
                  {activeItemId ? (
                    <motion.div 
                      key="expanded-card"
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 50 }}
                      className="flex-1 flex flex-col justify-between mt-2"
                    >
                      {/* Expanded header (Back to Stack) */}
                      <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
                        <button 
                          onClick={() => {
                            setActiveItemId(null);
                            setSelectedTx(null);
                          }}
                          className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white flex items-center gap-1"
                        >
                          ✕ Back to Wallet
                        </button>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          {activeItem?.type === "boarding-pass" ? "Boarding Pass" : 
                           activeItem?.type === "cinema-ticket" ? "Cinema Stub" : 
                           activeItem?.type === "transit-card" ? "Metro Card" : "Card Account"}
                        </span>
                      </div>

                      {/* The active card front itself */}
                      <div className="perspective-1000">
                        <div 
                          className={`w-full aspect-[1.586/1] rounded-[20px] p-5 flex flex-col justify-between relative overflow-hidden ${getCardStyle(activeItem!.theme)}`}
                        >
                          {/* Card Glass shine */}
                          <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-b from-white/10 to-transparent pointer-events-none transform -skew-x-12" />

                          {/* Top Row: Brand & Chip */}
                          <div className="flex justify-between items-start">
                            <span className="text-[11px] font-black uppercase tracking-wider opacity-90">{activeItem?.bankName}</span>
                            {/* Metallic card chip */}
                            {(activeItem?.type === "credit" || activeItem?.type === "debit") && (
                              <div className="w-8 h-6 bg-amber-200/90 rounded-[4px] relative overflow-hidden border border-amber-300 shadow-[inset_0_1px_4px_rgba(0,0,0,0.2)]">
                                <div className="absolute inset-y-0 left-1/3 w-[1px] bg-neutral-600/40" />
                                <div className="absolute inset-y-0 right-1/3 w-[1px] bg-neutral-600/40" />
                                <div className="absolute inset-x-0 top-1/2 h-[1px] bg-neutral-600/40" />
                              </div>
                            )}
                            {activeItem?.type === "boarding-pass" && <Plane className="w-5 h-5 opacity-80" />}
                            {activeItem?.type === "cinema-ticket" && <Film className="w-5 h-5 opacity-80" />}
                          </div>

                          {/* Middle Row: Numbers & details */}
                          {activeItem?.type === "boarding-pass" ? (
                            <div className="flex justify-between items-center text-white">
                              <div>
                                <div className="text-xs opacity-60">FROM</div>
                                <div className="text-xl font-black">{activeItem?.from}</div>
                              </div>
                              <div className="border-t border-dashed border-white/40 flex-1 mx-3" />
                              <div className="text-right">
                                <div className="text-xs opacity-60">TO</div>
                                <div className="text-xl font-black">{activeItem?.to}</div>
                              </div>
                            </div>
                          ) : activeItem?.type === "cinema-ticket" ? (
                            <div>
                              <div className="text-xs opacity-60 font-medium">IMAX MOVIE</div>
                              <div className="text-sm font-black truncate">{activeItem?.movieTitle}</div>
                            </div>
                          ) : (
                            <div className="text-sm tracking-[0.2em] font-mono opacity-80">{activeItem?.cardNumber}</div>
                          )}

                          {/* Bottom Row: Balance or Holder */}
                          <div className="flex justify-between items-end">
                            <div>
                              <div className="text-[8px] font-black uppercase tracking-widest opacity-60">
                                {activeItem?.type === "boarding-pass" ? "Seat" : 
                                 activeItem?.type === "cinema-ticket" ? "Theater / Seat" : "Cardholder"}
                              </div>
                              <div className="text-[10px] font-black tracking-wide truncate max-w-[150px]">
                                {activeItem?.type === "boarding-pass" ? activeItem.seat : 
                                 activeItem?.type === "cinema-ticket" ? `${activeItem.screen} • Seat ${activeItem.seat}` : activeItem?.name}
                              </div>
                            </div>
                            <div className="text-right">
                              {activeItem?.type === "boarding-pass" ? (
                                <>
                                  <div className="text-[8px] font-black uppercase tracking-widest opacity-60">Boarding</div>
                                  <div className="text-xs font-black">{activeItem.boardingTime}</div>
                                </>
                              ) : activeItem?.type === "cinema-ticket" ? (
                                <>
                                  <div className="text-[8px] font-black uppercase tracking-widest opacity-60">Showtime</div>
                                  <div className="text-xs font-black">{activeItem.showTime}</div>
                                </>
                              ) : (
                                <>
                                  <div className="text-[8px] font-black uppercase tracking-widest opacity-60">Balance</div>
                                  <div className="text-xs font-mono font-black">${activeItem?.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card Operations Quick Menu */}
                      <div className="flex gap-2.5 mt-3.5">
                        <button 
                          onClick={() => setSendMoneyOpen(true)}
                          className="flex-1 h-9 rounded-xl text-[9px] font-black uppercase tracking-wider bg-white/5 hover:bg-white/10 text-white flex items-center justify-center gap-1.5 border border-white/10 active:scale-95 transition-all"
                        >
                          <Send className="w-3 h-3 text-sky-400" /> Send Cash
                        </button>
                        <button 
                          onClick={handleTopUp}
                          className="flex-1 h-9 rounded-xl text-[9px] font-black uppercase tracking-wider bg-white/5 hover:bg-white/10 text-white flex items-center justify-center gap-1.5 border border-white/10 active:scale-95 transition-all"
                        >
                          <RefreshCw className="w-3 h-3 text-amber-400" /> Fund $500
                        </button>
                      </div>

                      {/* Transactions List Header */}
                      <div className="mt-5 space-y-3 flex-1 flex flex-col">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recent Transactions</h4>
                        
                        <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 max-h-[220px]">
                          {activeTransactions.map(tx => (
                            <button
                              key={tx.id}
                              onClick={() => setSelectedTx(tx)}
                              className="w-full glass-card p-3 flex items-center justify-between text-left hover:border-white/20 hover:bg-white/[0.04] transition-all group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-white/5 flex items-center justify-center">
                                  {getCategoryIcon(tx.category)}
                                </div>
                                <div>
                                  <div className="text-[10px] font-black text-white group-hover:text-[--accent-primary-light] transition-colors truncate max-w-[120px]">{tx.merchant}</div>
                                  <div className="text-[8px] text-slate-500 uppercase mt-0.5">{tx.date} • {tx.time}</div>
                                </div>
                              </div>
                              <span className={`text-[10px] font-black font-mono ${tx.amount > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                                {tx.amount > 0 ? `-$${tx.amount.toFixed(2)}` : `+$${Math.abs(tx.amount).toFixed(2)}`}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                    </motion.div>
                  ) : (
                    // Default Cards Stack view
                    <motion.div 
                      key="wallet-stack"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex-1 flex flex-col mt-4"
                    >
                      {/* Header title */}
                      <div className="flex justify-between items-center pb-4 mb-4 border-b border-white/5">
                        <div>
                          <h2 className="text-xl font-black tracking-tight text-white">Apple Wallet</h2>
                          <p className="text-[9px] font-black uppercase tracking-widest text-sky-400">Security Sandbox</p>
                        </div>
                        <button 
                          onClick={() => setCustomizerOpen(true)}
                          className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 active:scale-95 transition-all text-white"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Overlay card deck view */}
                      <div className="relative w-full h-[400px] flex flex-col justify-start">
                        {items.map((item, idx) => {
                          const topOffset = idx * 48; // Overlapping cards
                          return (
                            <motion.button
                              layoutId={`card-motion-${item.id}`}
                              key={item.id}
                              onClick={() => setActiveItemId(item.id)}
                              className={`w-full aspect-[1.586/1] rounded-[20px] p-5 flex flex-col justify-between text-left relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:brightness-110 active:scale-95 ${getCardStyle(item.theme)}`}
                              style={{ 
                                position: idx === 0 ? "relative" : "absolute",
                                top: idx === 0 ? 0 : `${topOffset}px`,
                                zIndex: idx,
                                boxShadow: "0 8px 30px rgba(0,0,0,0.4)"
                              }}
                            >
                              {/* Glass shine on hover */}
                              <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-b from-white/10 to-transparent pointer-events-none transform -skew-x-12" />

                              {/* Card Brand Header */}
                              <div className="flex justify-between items-start">
                                <span className="text-[10px] font-black uppercase tracking-wider opacity-90">{item.bankName}</span>
                                {item.type === "boarding-pass" ? (
                                  <Plane className="w-4 h-4 opacity-80" />
                                ) : item.type === "cinema-ticket" ? (
                                  <Film className="w-4 h-4 opacity-80" />
                                ) : (
                                  <div className="w-7 h-5 bg-amber-200/90 rounded-[4px] relative border border-amber-300" />
                                )}
                              </div>

                              {/* Numbers or Pass route */}
                              {item.type === "boarding-pass" ? (
                                <div className="flex justify-between items-center text-white">
                                  <div>
                                    <div className="text-[9px] opacity-60">FROM</div>
                                    <div className="text-sm font-black">{item.from}</div>
                                  </div>
                                  <div className="border-t border-dashed border-white/40 flex-1 mx-2" />
                                  <div>
                                    <div className="text-[9px] opacity-60 text-right">TO</div>
                                    <div className="text-sm font-black text-right">{item.to}</div>
                                  </div>
                                </div>
                              ) : item.type === "cinema-ticket" ? (
                                <div className="text-xs font-black truncate max-w-[200px]">{item.movieTitle}</div>
                              ) : (
                                <div className="text-[11px] font-mono opacity-80">{item.cardNumber}</div>
                              )}

                              {/* Cardholder or Seat bottom row */}
                              <div className="flex justify-between items-end">
                                <div>
                                  <div className="text-[7px] font-black uppercase tracking-widest opacity-60">
                                    {item.type === "boarding-pass" ? "Seat" : 
                                     item.type === "cinema-ticket" ? "IMAX seat" : "Cardholder"}
                                  </div>
                                  <div className="text-[9px] font-black truncate max-w-[120px]">
                                    {item.type === "boarding-pass" ? item.seat : 
                                     item.type === "cinema-ticket" ? item.seat : item.name}
                                  </div>
                                </div>
                                <div className="text-right">
                                  {item.type === "boarding-pass" ? (
                                    <>
                                      <div className="text-[7px] font-black uppercase tracking-widest opacity-60">Gate</div>
                                      <div className="text-[9px] font-black">{item.gate}</div>
                                    </>
                                  ) : item.type === "cinema-ticket" ? (
                                    <>
                                      <div className="text-[7px] font-black uppercase tracking-widest opacity-60">Time</div>
                                      <div className="text-[9px] font-black">{item.showTime}</div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="text-[7px] font-black uppercase tracking-widest opacity-60">Balance</div>
                                      <div className="text-[9px] font-mono font-black">${item.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>

                      {/* Pay with passcode indicator */}
                      <button 
                        onClick={triggerApplePay}
                        className="mt-auto w-full py-3 rounded-2xl bg-white/[0.04] hover:bg-white/10 border border-white/5 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-white"
                      >
                        <Lock className="w-3.5 h-3.5 text-sky-400" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Double-Click Side Button to Pay</span>
                      </button>

                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
              
              {/* Apple Pay Overlay Slide Up Panel */}
              <AnimatePresence>
                {isApplePayOpen && (
                  <motion.div 
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", stiffness: 220, damping: 25 }}
                    className="absolute inset-0 bg-neutral-950/98 backdrop-blur-md z-45 pt-16 px-6 pb-8 flex flex-col justify-between"
                  >
                    {/* Face ID check visual ring */}
                    <div className="flex flex-col items-center gap-6 mt-8">
                      <div className="relative w-20 h-20 flex items-center justify-center">
                        <div className="absolute inset-0 border-4 border-dashed border-sky-500 rounded-full animate-[spin_10s_linear_infinite]" />
                        <div className="w-10 h-10 border-4 border-sky-400 rounded-full flex items-center justify-center">
                          <div className="w-2.5 h-2.5 bg-sky-400 rounded-full animate-pulse" />
                        </div>
                      </div>
                      
                      <div className="text-center space-y-1">
                        <h3 className="text-base font-black text-white uppercase tracking-wider">{faceIdText}</h3>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">Simulating Apple Pay Contactless</p>
                      </div>
                    </div>

                    {/* Passive billing card details display */}
                    <div className="glass-card p-4 flex items-center justify-between bg-white/[0.02]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-6 rounded bg-gradient-to-tr from-sky-400 to-indigo-600 flex items-center justify-center">
                          <span className="text-[7px] font-black text-white">VISA</span>
                        </div>
                        <div>
                          <div className="text-[10px] font-black text-white">Chase Sapphire Card</div>
                          <div className="text-[8px] text-slate-500 uppercase mt-0.5">•••• 4892</div>
                        </div>
                      </div>
                      <span className="text-xs font-black font-mono text-white">$14,250.75</span>
                    </div>

                    {/* Pay button helper */}
                    <div className="space-y-3">
                      <button 
                        onClick={() => {
                          setDynamicIsland("success");
                          setFaceIdText("Authorized");
                          setTimeout(() => {
                            setDynamicIsland("nfc");
                            setTimeout(() => {
                              setDynamicIsland("idle");
                              setIsApplePayOpen(false);
                              toast.success("Apple Pay contactless successful!");
                            }, 2500);
                          }, 1500);
                        }}
                        className="w-full py-3 rounded-2xl bg-sky-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
                      >
                        Bypass Face ID (Simulate)
                      </button>
                      <button 
                        onClick={() => {
                          setIsApplePayOpen(false);
                          setDynamicIsland("idle");
                        }}
                        className="w-full py-3 rounded-2xl bg-white/5 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>

        </div>

      </div>

      {/* Transaction Detail Drawer overlay */}
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card max-w-sm w-full p-6 space-y-6 relative overflow-hidden"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            >
              <button 
                onClick={() => setSelectedTx(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                ✕
              </button>

              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-neutral-900 mx-auto border border-white/5 flex items-center justify-center text-xl shadow-lg">
                  🛍️
                </div>
                <h3 className="text-sm font-black text-white tracking-wide uppercase">{selectedTx.merchant}</h3>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{selectedTx.category} • {selectedTx.date} {selectedTx.time}</p>
              </div>

              {/* Invoice Breakdown details */}
              <div className="space-y-2 border-y border-white/5 py-4 text-xs font-semibold text-slate-400">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono text-white">${(selectedTx.amount * 0.92).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax & processing</span>
                  <span className="font-mono text-white">${(selectedTx.amount * 0.08).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-black pt-2 border-t border-white/5">
                  <span className="text-white uppercase tracking-wider">Total</span>
                  <span className="font-mono text-sky-400">${selectedTx.amount.toFixed(2)}</span>
                </div>
              </div>

              {/* Receipt details */}
              <div className="text-[9px] text-slate-500 font-mono space-y-1 bg-white/[0.01] p-3 rounded-xl border border-white/5">
                <div>RECEIPT ID: {selectedTx.receiptId}</div>
                <div>TERMINAL: AP-SIM-9921-SFO</div>
                <div>STATUS: {selectedTx.status.toUpperCase()}</div>
                <div>SECURE ID: SHA-256 (MOBILE-PASS)</div>
              </div>

              {/* Simulated Map */}
              <div className="space-y-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" /> Merchant Location ({selectedTx.location})
                </span>
                
                {/* Visual mock Map grid */}
                <div className="w-full h-24 bg-neutral-900 rounded-xl relative overflow-hidden border border-white/5 flex items-center justify-center">
                  {/* Grid lines */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:10px_10px]" />
                  <div className="absolute top-1/2 inset-x-0 h-0.5 bg-neutral-800" />
                  <div className="absolute left-1/2 inset-y-0 w-0.5 bg-neutral-800" />
                  {/* River representation */}
                  <div className="absolute top-1/4 left-1/4 right-0 h-3 bg-sky-950/80 -rotate-12 blur-[1px]" />
                  
                  {/* Merchant marker pin */}
                  <div 
                    className="absolute w-3 h-3 bg-rose-500 rounded-full flex items-center justify-center animate-bounce shadow-md shadow-rose-500/50"
                    style={{ left: `${selectedTx.coordinates.x}%`, top: `${selectedTx.coordinates.y}%` }}
                  >
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  </div>
                  
                  <span className="absolute bottom-2 right-2 text-[7px] font-black uppercase bg-neutral-950/80 px-2 py-0.5 rounded text-slate-400">Mock Map Sandbox</span>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Peer Transfer Modal Numpad layout */}
      <AnimatePresence>
        {sendMoneyOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card max-w-sm w-full p-6 space-y-6 relative"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            >
              <button 
                onClick={() => setSendMoneyOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                ✕
              </button>

              <div className="text-center space-y-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-[--text-primary]">Send Peer Cash</h3>
                <p className="text-[10px] text-[--text-muted]">Transfer funds from **{activeItem?.bankName}** instantly.</p>
              </div>

              {/* Selector for family contacts */}
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block">Select Contact</label>
                <select 
                  value={selectedRecipientId} 
                  onChange={e => setSelectedRecipientId(e.target.value)}
                  className="w-full h-10 px-3 bg-neutral-900 border border-white/10 rounded-xl text-xs text-white"
                >
                  <option value="">Choose Household Member...</option>
                  {finance?.recipients && finance.recipients.length > 0 ? (
                    finance.recipients.map((rec: any) => (
                      <option key={rec.id} value={rec.id}>{rec.name} ({rec.relationship || "Family"})</option>
                    ))
                  ) : (
                    <>
                      <option value="rec-1">Emma Mercer (Sister)</option>
                      <option value="rec-2">David Mercer (Father)</option>
                      <option value="rec-3">Sophia Mercer (Mother)</option>
                    </>
                  )}
                </select>
              </div>

              {/* Simulated numeric input displays */}
              <div className="text-center">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">SENDING</div>
                <div className="text-4xl font-black font-mono text-sky-400 mt-2">${sendAmount || "0.00"}</div>
              </div>

              {/* Dynamic Numpad Keyboard */}
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, ".", 0, "⌫"].map((val) => (
                  <button
                    key={val}
                    onClick={() => {
                      if (val === "⌫") {
                        setSendAmount(prev => prev.slice(0, -1));
                      } else if (val === ".") {
                        if (!sendAmount.includes(".")) setSendAmount(prev => prev + val);
                      } else {
                        setSendAmount(prev => prev + val);
                      }
                    }}
                    className="h-10 rounded-xl bg-white/[0.02] border border-white/5 active:bg-white/10 hover:border-white/15 text-sm font-bold text-white transition-all active:scale-95 flex items-center justify-center"
                  >
                    {val}
                  </button>
                ))}
              </div>

              <button
                onClick={handleSendMoney}
                disabled={!selectedRecipientId || !sendAmount}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                Send with Face ID Verification
              </button>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Card customizer modal form with 3D 물리 flipping */}
      <AnimatePresence>
        {customizerOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card max-w-lg w-full p-6 space-y-6 relative overflow-hidden"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            >
              <button 
                onClick={() => setCustomizerOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                ✕
              </button>

              <div className="text-center space-y-1">
                <h3 className="text-xs font-black uppercase tracking-widest text-[--text-primary] flex items-center justify-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[--accent-primary]" /> Card Creator Sandbox
                </h3>
                <p className="text-[10px] text-[--text-muted]">Type details and focus CVV to flip the card physically!</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                
                {/* 3D Physical Card container */}
                <div className="md:col-span-5 flex justify-center py-4">
                  <div className="perspective-1000 w-full max-w-[220px]">
                    <div 
                      className="w-full aspect-[1.586/1] rounded-2xl relative transition-transform duration-700 select-none shadow-2xl"
                      style={{
                        transformStyle: "preserve-3d",
                        transform: cvvFocused ? "rotateY(180deg)" : "rotateY(0deg)",
                      }}
                    >
                      {/* FRONT OF THE CARD */}
                      <div 
                        className={`absolute inset-0 rounded-2xl p-4 flex flex-col justify-between overflow-hidden ${getCardStyle(newCard.theme || "royal")}`}
                        style={{ backfaceVisibility: "hidden" }}
                      >
                        <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-b from-white/10 to-transparent pointer-events-none transform -skew-x-12" />
                        <div className="flex justify-between items-start">
                          <span className="text-[9px] font-black uppercase tracking-wider opacity-90 truncate max-w-[100px]">{newCard.bankName || "BANK NAME"}</span>
                          <div className="w-6 h-4 bg-amber-200/90 rounded-[3px] border border-amber-300" />
                        </div>
                        <div className="text-[10px] font-mono tracking-wider opacity-85">{formatCardNumber(newCard.cardNumber || "••••••••••••••••")}</div>
                        <div className="flex justify-between items-end">
                          <div>
                            <div className="text-[6px] uppercase tracking-widest opacity-60">Holder</div>
                            <div className="text-[8px] font-black uppercase truncate max-w-[100px]">{newCard.name || "Alex Mercer"}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[6px] uppercase tracking-widest opacity-60">Expiry</div>
                            <div className="text-[8px] font-mono font-black">{newCard.expiry || "12/30"}</div>
                          </div>
                        </div>
                      </div>

                      {/* BACK OF THE CARD */}
                      <div 
                        className="absolute inset-0 rounded-2xl p-4 bg-neutral-900 border border-neutral-700/60 flex flex-col justify-between overflow-hidden text-white"
                        style={{ 
                          backfaceVisibility: "hidden", 
                          transform: "rotateY(180deg)" 
                        }}
                      >
                        {/* Magnetic signature strip */}
                        <div className="w-full h-6 bg-black absolute top-3 left-0" />
                        
                        {/* CVV details box */}
                        <div className="mt-8 flex items-center justify-end bg-white/10 px-3 py-1 rounded">
                          <span className="text-[7px] text-slate-400 mr-2 uppercase tracking-widest">CVV</span>
                          <span className="font-mono text-sm font-black text-amber-400">{newCard.cvv || "•••"}</span>
                        </div>

                        <div className="text-[6px] text-slate-500 font-mono leading-tight">
                          AUTHORIZED SIGNATURE NOT TRANSFERABLE. SECURITY IS GUARANTEED BY THE SECURE PASS SYSTEM.
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

                {/* Card Inputs Form */}
                <form onSubmit={handleAddCard} className="md:col-span-7 space-y-3.5 text-xs font-semibold">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Cardholder Name</label>
                      <input 
                        type="text" 
                        value={newCard.name}
                        onChange={e => setNewCard({ ...newCard, name: e.target.value })}
                        placeholder="Alex Mercer"
                        className="w-full h-8 px-2 bg-neutral-900 border border-white/10 rounded-lg text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Bank Name</label>
                      <input 
                        type="text" 
                        value={newCard.bankName}
                        onChange={e => setNewCard({ ...newCard, bankName: e.target.value })}
                        placeholder="Apex Bank"
                        className="w-full h-8 px-2 bg-neutral-900 border border-white/10 rounded-lg text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Card Number</label>
                    <input 
                      type="text" 
                      maxLength={16}
                      value={newCard.cardNumber?.replace(/\s+/g, "")}
                      onChange={e => setNewCard({ ...newCard, cardNumber: e.target.value })}
                      placeholder="4532981240281192"
                      className="w-full h-8 px-2 bg-neutral-900 border border-white/10 rounded-lg text-xs text-white font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1 col-span-2">
                      <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Expiry Date</label>
                      <input 
                        type="text" 
                        placeholder="12/30"
                        value={newCard.expiry}
                        onChange={e => setNewCard({ ...newCard, expiry: e.target.value })}
                        className="w-full h-8 px-2 bg-neutral-900 border border-white/10 rounded-lg text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">CVV</label>
                      <input 
                        type="text" 
                        maxLength={3}
                        placeholder="382"
                        value={newCard.cvv}
                        onFocus={() => setCvvFocused(true)}
                        onBlur={() => setCvvFocused(false)}
                        onChange={e => setNewCard({ ...newCard, cvv: e.target.value })}
                        className="w-full h-8 px-2 bg-neutral-900 border border-white/10 rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Style Theme</label>
                      <select 
                        value={newCard.theme}
                        onChange={e => setNewCard({ ...newCard, theme: e.target.value as CardTheme })}
                        className="w-full h-8 px-2 bg-neutral-900 border border-white/10 rounded-lg text-xs text-white"
                      >
                        <option value="royal">Royal Purple</option>
                        <option value="chroma">Chroma Glass</option>
                        <option value="sunset">Sunset Gold</option>
                        <option value="stealth">Stealth Carbon</option>
                        <option value="cyber">Cyberpunk Holo</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Card Type</label>
                      <select 
                        value={newCard.type}
                        onChange={e => setNewCard({ ...newCard, type: e.target.value as "credit" | "debit" })}
                        className="w-full h-8 px-2 bg-neutral-900 border border-white/10 rounded-lg text-xs text-white"
                      >
                        <option value="credit">Credit Card</option>
                        <option value="debit">Debit Card</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-black text-[10px] uppercase tracking-widest shadow-md shadow-sky-500/20 hover:bg-sky-600 transition-all active:scale-[0.98] mt-2"
                  >
                    Add Card to Wallet
                  </button>
                </form>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
