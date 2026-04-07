"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase-browser";

type UserContextType = {
  username: string;
  setUsername: (name: string) => Promise<void>;
};

const UserContext = createContext<UserContextType>({
  username: "User",
  setUsername: async () => {},
});

const supabase = createClient();

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsernameState] = useState("User");
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.user_metadata?.username) {
      setUsernameState(user.user_metadata.username);
    } else if (user?.email) {
      // Fallback to email if no username set
      setUsernameState(user.email.split("@")[0]);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const setUsername = useCallback(async (name: string) => {
    // Update local state immediately for real-time UI feedback
    setUsernameState(name);
    
    // Debounce the Supabase update to avoid spamming the database
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(async () => {
      const { error } = await supabase.auth.updateUser({
        data: { username: name }
      });
      if (error) {
        console.error("Failed to update username in database:", error);
      }
      updateTimeoutRef.current = null;
    }, 800); // 800ms debounce
  }, []);

  return (
    <UserContext.Provider value={{ username, setUsername }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
