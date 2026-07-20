"use server";

import { createClient } from "@/lib/supabase-server";

export async function enrollMFA() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
  });
  
  if (error) {
    return { error: error.message };
  }
  
  return { 
    factorId: data.id, 
    qrCode: data.totp.qr_code, 
    secret: data.totp.secret 
  };
}

export async function verifyMFAEnrollment(factorId: string, code: string) {
  const supabase = await createClient();
  
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) {
    return { error: challenge.error.message };
  }
  
  const verify = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code: code.trim(),
  });
  
  if (verify.error) {
    return { error: verify.error.message };
  }
  
  return { success: true };
}

export async function unenrollMFA(factorId: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

export async function getMFAStatus() {
  const supabase = await createClient();
  const { data: factors, error } = await supabase.auth.mfa.listFactors();
  
  if (error || !factors) return { isEnabled: false };
  
  const totpFactor = factors.all.find(f => f.factor_type === "totp" && f.status === "verified");
  return { 
    isEnabled: !!totpFactor, 
    factorId: totpFactor?.id || null 
  };
}
