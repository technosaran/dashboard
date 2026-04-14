"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, startTransition } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { RealtimeChannel } from "@supabase/supabase-js";

type UserContextType = {
  username: string;
  loading: boolean;
  isSyncing: boolean;
  setUsername: (name: string) => void;
};

const UserContext = createContext<UserContextType>({
  username: "",
  loading: true,
  isSyncing: false,
  setUsername: () => {},
});

const supabase = createClient();

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsernameState] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Check if username exists in metadata (even if it's an empty string)
      if (user.user_metadata && 'username' in user.user_metadata) {
        setUsernameState(user.user_metadata.username || "");
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
          if (typeof payload.username === 'string') {
            console.log("Real-time (Broadcast) update:", payload.username);
            setUsernameState(payload.username);
          }
        })
        .on("postgres_changes", { 
          event: "UPDATE", 
          schema: "public", 
          table: "profiles", 
          filter: `id=eq.${user.id}` 
        }, (payload) => {
          if (payload.new && typeof payload.new.username === 'string') {
            console.log("Real-time (DB) update:", payload.new.username);
            setUsernameState(payload.new.username);
          }
        })
        .subscribe();

    }
    setLoading(false);
  }, []);

  useEffect(() => {
    startTransition(fetchUser);

    // Handle background/foreground transitions for mobile PWA
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("App resumed, forcing real-time re-sync...");
        startTransition(fetchUser);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    // Listen for auth state changes (e.g. sign in/out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      startTransition(fetchUser);
    });

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
    setIsSyncing(true);
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(async () => {
      const trimmedName = name.trim();
      // Allow empty string to be saved to clear the name
      // removed: if (!trimmedName) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsSyncing(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        data: { username: trimmedName }
      });
      
      if (error) {
        console.error("Failed to update username in database:", error);
      }
      setIsSyncing(false);
      updateTimeoutRef.current = null;
    }, 600); 
  }, []);

  return (
    <UserContext.Provider value={{ username, loading, isSyncing, setUsername }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);

