"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { enrollMFA, verifyMFAEnrollment, unenrollMFA, getMFAStatus } from "../mfa-actions";
import { toast } from "react-hot-toast";

export default function SecurityTab() {
  const [isMfaEnabled, setIsMfaEnabled] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  
  const [qrCodeData, setQrCodeData] = useState("");
  const [secret, setSecret] = useState("");
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMfaStatus() {
      const status = await getMFAStatus();
      setIsMfaEnabled(status.isEnabled);
      setFactorId(status.factorId);
      setLoading(false);
    }
    loadMfaStatus();
  }, []);

  const handleStartSetup = async () => {
    setIsSettingUp(true);
    setLoading(true);
    const result = await enrollMFA();
    
    if (result.error) {
      toast.error(result.error);
      setIsSettingUp(false);
    } else {
      setQrCodeData(result.qrCode || "");
      setSecret(result.secret || "");
      setFactorId(result.factorId || "");
    }
    setLoading(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    
    setLoading(true);
    const result = await verifyMFAEnrollment(factorId, mfaCode);
    
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Two-Factor Authentication successfully enabled!");
      setIsMfaEnabled(true);
      setIsSettingUp(false);
    }
    setLoading(false);
  };

  const handleDisable = async () => {
    if (!factorId) return;
    if (!confirm("Are you sure you want to disable Two-Factor Authentication? Your account will be less secure.")) return;
    
    setLoading(true);
    const result = await unenrollMFA(factorId);
    
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Two-Factor Authentication disabled.");
      setIsMfaEnabled(false);
      setFactorId(null);
    }
    setLoading(false);
  };

  return (
    <div className="glass-card animate-fade-in-up delay-1 flex flex-col h-full">
      <div className="mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span className="text-xl">🔒</span> Account Security
        </h2>
        <p className="text-sm text-[--text-secondary] mt-1">
          Manage your Two-Factor Authentication and security preferences to protect your wealth data.
        </p>
      </div>

      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Two-Factor Authentication (2FA)
              {isMfaEnabled && (
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
                  Active
                </span>
              )}
            </h3>
            <p className="text-xs text-[--text-muted] mt-1.5 max-w-lg leading-relaxed">
              Enhance your account security by requiring a 6-digit code from your authenticator app (like Google Authenticator or Authy) when signing in.
            </p>
          </div>
          
          <div>
            {loading ? (
              <div className="w-24 h-10 bg-white/5 rounded-lg skeleton" />
            ) : isMfaEnabled ? (
              <button 
                type="button" 
                onClick={handleDisable}
                disabled={loading}
                className="btn-danger whitespace-nowrap"
              >
                Disable 2FA
              </button>
            ) : !isSettingUp && (
              <button 
                type="button" 
                onClick={handleStartSetup}
                disabled={loading}
                className="btn-primary whitespace-nowrap"
              >
                Enable 2FA
              </button>
            )}
          </div>
        </div>

        {isSettingUp && qrCodeData && (
          <div className="mt-8 border-t border-white/10 pt-8 animate-fade-in">
            <h4 className="font-bold text-white mb-4">Set up Authenticator App</h4>
            
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="bg-white p-4 rounded-xl shrink-0">
                <QRCodeSVG value={qrCodeData} size={160} />
              </div>
              
              <div className="flex-1 w-full">
                <ol className="list-decimal pl-4 text-sm text-[--text-secondary] space-y-3 mb-6">
                  <li>Download an authenticator app (e.g. Google Authenticator, Authy, or Microsoft Authenticator).</li>
                  <li>Scan the QR code with your app.</li>
                  <li>If you can't scan the QR code, manually enter this secret key:
                    <div className="font-mono text-xs text-[--accent-primary-light] bg-[--accent-primary]/10 p-2 rounded mt-1 break-all">
                      {secret}
                    </div>
                  </li>
                  <li>Enter the 6-digit verification code generated by the app.</li>
                </ol>
                
                <form onSubmit={handleVerify} className="flex gap-3 max-w-sm">
                  <input 
                    type="text" 
                    placeholder="000000" 
                    maxLength={6}
                    required
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))}
                    className="input-premium font-mono tracking-[0.2em] text-center w-full"
                    disabled={loading}
                  />
                  <button type="submit" disabled={loading || mfaCode.length !== 6} className="btn-success">
                    Verify
                  </button>
                </form>
                
                <button 
                  type="button" 
                  onClick={() => setIsSettingUp(false)} 
                  className="text-xs text-[--text-muted] hover:text-white mt-4 underline decoration-white/20 underline-offset-4"
                >
                  Cancel setup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
