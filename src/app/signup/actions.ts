"use server";

import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export async function signup(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const username = formData.get("username") as string;
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username || email.split("@")[0],
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/login?message=Check your email to confirm your account");
}
