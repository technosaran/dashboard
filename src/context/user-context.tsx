"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase-browser";

type UserContextType = {
  username: string;
  loading: boolean;
  setUsername: (name: string) => void;
};

const UserContext = createContext<UserContextType>({
  username: "",
  loading: true,
  setUsername: () => {},
});

const supabase = createClient();

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsernameState] = useState("");
  const [loading, setLoading] = useState(true);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  const fetchUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      if (user.user_metadata?.username) {
        setUsernameState(user.user_metadata.username);
      } else if (user.email) {
        setUsernameState(user.email.split("@")[0]);
      }
      
      // Subscribe to user-specific real-time channel for cross-device sync
      const channelId = `user-sync:${user.id}`;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      
      channelRef.current = supabase.channel(channelId)
        .on("broadcast", { event: "username-update" }, ({ payload }) => {
          if (payload.username) {
            setUsernameState(payload.username);
          }
        })
        .subscribe();
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUser();
    
    // Listen for auth state changes (e.g. sign in/out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUser();
    });

    return () => {
      subscription.unsubscribe();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [fetchUser]);

  const setUsername = useCallback((name: string) => {
    // 1. Update local state IMMEDIATELY for 0-latency UI feedback
    setUsernameState(name);
    
    // 2. Broadcast to other devices/tabs
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "username-update",
        payload: { username: name },
      });
    }
    
    // 3. Debounce the Database update to avoid spamming
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(async () => {
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
    <UserContext.Provider value={{ username, loading, setUsername }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);

