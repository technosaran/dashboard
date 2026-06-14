"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useFinanceData } from "@/hooks/use-finance-data";
import { useUser } from "@/context/user-context";

type OnboardingStep = "welcome" | "account" | "income" | "expense" | "complete";

interface OnboardingWizardProps {
  onComplete: () => void;
}

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  
  const { data: financeData } = useFinanceData();
  const { user_id } = useUser();
  const { accounts = [], incomes = [], expenses = [] } = financeData || {};

  const accountCreated = accounts.length > 0;
  const incomeLogged = incomes.length > 0;
  const expenseLogged = expenses.length > 0;

  const getStorageKey = () => user_id ? `onboarding_completed_${user_id}` : "onboarding_completed";

  function handleSkip() {
    localStorage.setItem(getStorageKey(), "true");
    onComplete();
  }

  function handleComplete() {
    localStorage.setItem(getStorageKey(), "true");
    toast.success("Welcome to your Finance Dashboard! 🎉");
    onComplete();
  }

  function goToAccounts() {
    localStorage.setItem("onboarding_step", "account");
    router.push("/dashboard/accounts?action=new");
  }

  function goToIncome() {
    localStorage.setItem("onboarding_step", "income");
    router.push("/dashboard/income?action=new");
  }

  function goToExpenses() {
    localStorage.setItem("onboarding_step", "expense");
    router.push("/dashboard/expenses?action=new");
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[--bg-base]/95 backdrop-blur-2xl animate-fade-in">
      <div className="glass-card-static w-full max-w-2xl p-8 md:p-12 border-[--accent-primary]/20 shadow-[0_0_150px_rgba(108,92,231,0.2)]">
        
        {/* Welcome Step */}
        {step === "welcome" && (
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-[--text-primary] mb-4">
              Welcome to Your Finance Dashboard
            </h2>
            <p className="text-[--text-secondary] text-base md:text-lg mb-8 leading-relaxed max-w-xl mx-auto">
              Let&apos;s get you started with a quick 3-step setup. This will only take a minute!
            </p>
            
            <div className="grid grid-cols-3 gap-4 mb-10 max-w-md mx-auto">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-[--accent-primary]/10 border border-[--accent-primary]/20 flex items-center justify-center">
                  <span className="text-xl font-black text-[--accent-primary]">1</span>
                </div>
                <span className="text-[10px] font-bold text-[--text-muted] uppercase tracking-wider">Account</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center">
                  <span className="text-xl font-black text-success">2</span>
                </div>
                <span className="text-[10px] font-bold text-[--text-muted] uppercase tracking-wider">Income</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center">
                  <span className="text-xl font-black text-danger">3</span>
                </div>
                <span className="text-[10px] font-bold text-[--text-muted] uppercase tracking-wider">Expense</span>
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <button type="button"
                onClick={handleSkip}
                className="px-8 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-[--text-primary] font-bold text-sm border border-white/10 transition-all"
              >
                Skip for Now
              </button>
              <button type="button"
                onClick={() => setStep("account")}
                className="btn-primary px-10 py-3 shadow-2xl shadow-[--accent-primary]/20"
              >
                Let&apos;s Start
              </button>
            </div>
          </div>
        )}

        {/* Account Step */}
        {step === "account" && (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[--accent-primary]/10 border border-[--accent-primary]/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-[--accent-primary]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-[--text-primary] mb-3">
              Step 1: Add Your First Account
            </h2>
            <p className="text-[--text-secondary] text-sm md:text-base mb-8 leading-relaxed max-w-lg mx-auto">
              Start by adding a bank account, wallet, or cash account to track your balance.
            </p>

            {accountCreated ? (
              <div className="mb-8 p-6 rounded-2xl bg-success/10 border border-success/20">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-lg font-black text-success">Account Created!</span>
                </div>
                <p className="text-sm text-[--text-muted]">Great! Let&apos;s move to the next step.</p>
              </div>
            ) : (
              <div className="mb-8 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                <p className="text-sm text-[--text-muted] mb-4">Click below to add your first account</p>
                <button type="button"
                  onClick={goToAccounts}
                  className="btn-primary px-8 py-3"
                >
                  Add Account
                </button>
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <button type="button"
                onClick={handleSkip}
                className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[--text-muted] font-bold text-sm transition-all"
              >
                Skip
              </button>
              <button type="button"
                onClick={() => setStep("income")}
                disabled={!accountCreated}
                className="btn-primary px-8 py-2 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next Step
              </button>
            </div>
          </div>
        )}

        {/* Income Step */}
        {step === "income" && (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-[--text-primary] mb-3">
              Step 2: Log Your Income
            </h2>
            <p className="text-[--text-secondary] text-sm md:text-base mb-8 leading-relaxed max-w-lg mx-auto">
              Track your salary, freelance work, or any other income source.
            </p>

            {incomeLogged ? (
              <div className="mb-8 p-6 rounded-2xl bg-success/10 border border-success/20">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-lg font-black text-success">Income Logged!</span>
                </div>
                <p className="text-sm text-[--text-muted]">Excellent! One more step to go.</p>
              </div>
            ) : (
              <div className="mb-8 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                <p className="text-sm text-[--text-muted] mb-4">Click below to log your first income</p>
                <button type="button"
                  onClick={goToIncome}
                  className="btn-primary px-8 py-3 bg-success hover:bg-success"
                >
                  Log Income
                </button>
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <button type="button"
                onClick={() => setStep("account")}
                className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[--text-muted] font-bold text-sm transition-all"
              >
                Back
              </button>
              <button type="button"
                onClick={handleSkip}
                className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[--text-muted] font-bold text-sm transition-all"
              >
                Skip
              </button>
              <button type="button"
                onClick={() => setStep("expense")}
                disabled={!incomeLogged}
                className="btn-primary px-8 py-2 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next Step
              </button>
            </div>
          </div>
        )}

        {/* Expense Step */}
        {step === "expense" && (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-danger" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M20 12H4" />
              </svg>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-[--text-primary] mb-3">
              Step 3: Record an Expense
            </h2>
            <p className="text-[--text-secondary] text-sm md:text-base mb-8 leading-relaxed max-w-lg mx-auto">
              Track your spending to understand where your money goes.
            </p>

            {expenseLogged ? (
              <div className="mb-8 p-6 rounded-2xl bg-success/10 border border-success/20">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-lg font-black text-success">Expense Recorded!</span>
                </div>
                <p className="text-sm text-[--text-muted]">Perfect! You&apos;re all set up.</p>
              </div>
            ) : (
              <div className="mb-8 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                <p className="text-sm text-[--text-muted] mb-4">Click below to record your first expense</p>
                <button type="button"
                  onClick={goToExpenses}
                  className="btn-primary px-8 py-3 bg-danger hover:bg-danger"
                >
                  Record Expense
                </button>
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <button type="button"
                onClick={() => setStep("income")}
                className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[--text-muted] font-bold text-sm transition-all"
              >
                Back
              </button>
              <button type="button"
                onClick={handleComplete}
                disabled={!expenseLogged}
                className="btn-primary px-10 py-2 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Complete Setup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
