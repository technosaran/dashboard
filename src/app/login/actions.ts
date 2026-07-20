"use server";

import { createClient } from "@/lib/supabase-server";

export async function login(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (!email || typeof email !== "string" || !email.trim()) {
    return { error: "Email is required." };
  }

  if (!password || typeof password !== "string" || !password.trim()) {
    return { error: "Password is required." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    console.error("Login error:", error);
    return { error: error.message || "Invalid email or password." };
  }

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
  
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long." };
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
