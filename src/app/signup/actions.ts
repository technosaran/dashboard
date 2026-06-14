"use server";

import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export async function signup(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");
  const username = formData.get("username");

  if (!email || typeof email !== "string" || !email.trim()) {
    return { error: "Email is required." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  if (!password || typeof password !== "string" || !password.trim()) {
    return { error: "Password is required." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters long." };
  }

  if (username !== null && typeof username !== "string") {
    return { error: "Invalid username." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        username: (typeof username === "string" && username.trim()) || email.trim().split("@")[0],
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/login?message=Check your email to confirm your account");
}
