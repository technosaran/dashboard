"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase-browser";

type UserContextType = {
  username: string;
  setUsername: (name: string) => void;
};

const UserContext = createContext<UserContextType>({
  username: "User",
  setUsername: () => {},
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
      setUsernameState(user.email.split("@")[0]);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const setUsername = useCallback((name: string) => {
    // 1. Update local state IMMEDIATELY for 0-latency UI feedback
    setUsernameState(name);
    
    // 2. Debounce the Database update to avoid spamming
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(async () => {
      // Trim only for the database to maintain data integrity
      const trimmedName = name.trim();
      if (!trimmedName) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.auth.updateUser({
        data: { username: trimmedName }
      });
      
      if (error) {
        console.error("Failed to update username in database:", error);
      }
      updateTimeoutRef.current = null;
    }, 1000); 
  }, []);

  return (
    <UserContext.Provider value={{ username, setUsername }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
