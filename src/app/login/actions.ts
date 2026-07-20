"use server";

import { createClient } from "@/lib/supabase-server";
import { redisGet, redisIncr, redisExpire, redisSet } from "@/lib/redis";
import zxcvbn from "zxcvbn";

const MAX_LOGIN_ATTEMPTS = 10;
const LOCKOUT_DURATION = 60 * 15; // 15 minutes

async function checkBruteForce(email: string): Promise<{ locked: boolean; remaining?: number; message?: string }> {
  const key = `bruteforce:login:${email.toLowerCase()}`;
  const attemptsStr = await redisGet(key);
  const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;

  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    return { locked: true, message: `Account temporarily locked due to too many failed attempts. Please try again in 15 minutes.` };
  }
  return { locked: false, remaining: MAX_LOGIN_ATTEMPTS - attempts - 1 };
}

async function recordFailedAttempt(email: string) {
  const key = `bruteforce:login:${email.toLowerCase()}`;
  const attempts = await redisIncr(key);
  if (attempts === 1) {
    await redisExpire(key, LOCKOUT_DURATION);
  }
}

async function clearFailedAttempts(email: string) {
  const key = `bruteforce:login:${email.toLowerCase()}`;
  await redisSet(key, "0", 1);
}

function validatePasswordPolicy(password: string): string | null {
  if (password.length < 12) return "Password must be at least 12 characters long.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least one special character.";
  
  const strength = zxcvbn(password);
  if (strength.score < 3) {
    return `Password is too weak. ${strength.feedback.warning || "Please use a stronger password."}`;
  }
  return null;
}

export async function login(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (!email || typeof email !== "string" || !email.trim()) {
    return { error: "Email is required." };
  }

  if (!password || typeof password !== "string" || !password.trim()) {
    return { error: "Password is required." };
  }

  const emailStr = email.trim();
  const bruteCheck = await checkBruteForce(emailStr);
  if (bruteCheck.locked) {
    return { error: bruteCheck.message };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailStr,
    password,
  });

  if (error) {
    await recordFailedAttempt(emailStr);
    console.error("Login error:", error);
    return { error: error.message || "Invalid email or password." };
  }

  // Check if MFA is enrolled
  if (data?.session) {
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (!factorsError && factors && factors.all.length > 0) {
      const totpFactor = factors.all.find(f => f.factor_type === 'totp' && f.status === 'verified');
      if (totpFactor) {
        return { requiresMFA: true, factorId: totpFactor.id };
      }
    }
  }

  await clearFailedAttempts(emailStr);

  return { success: true };
}

export async function signup(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (!email || typeof email !== "string" || !email.trim()) {
    return { error: "Email is required." };
  }

  if (!password || typeof password !== "string" || !password.trim()) {
    return { error: "Password is required." };
  }
  
  const policyError = validatePasswordPolicy(password);
  if (policyError) {
    return { error: policyError };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });

  if (error) {
    console.error("Signup error:", error);
    return { error: error.message || "Failed to create account." };
  }

  return { success: true };
}

export async function verifyMFA(formData: FormData) {
  const factorId = formData.get("factorId");
  const code = formData.get("code");
  
  if (!factorId || typeof factorId !== "string") return { error: "Missing factor ID." };
  if (!code || typeof code !== "string") return { error: "Missing verification code." };
  
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
    return { error: verify.error.message || "Invalid authentication code." };
  }
  
  return { success: true };
}
