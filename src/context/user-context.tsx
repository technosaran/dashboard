"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react";
import { createClient } from "@/lib/supabase-browser";
import type { RealtimeChannel, User } from "@supabase/supabase-js";

type UserContextType = {
  username: string;
  user_id: string | null;
  loading: boolean;
  isSyncing: boolean;
  setUsername: (name: string) => void;
};

const UserContext = createContext<UserContextType>({
  username: "",
  user_id: null,
  loading: true,
  isSyncing: false,
  setUsername: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());

  const [username, setUsernameState] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const applyUser = useCallback((user: User | null) => {
    if (!user) {
      setUsernameState("");
      setCurrentUserId(null);
      return;
    }

    setCurrentUserId(user.id);

    if (user.user_metadata && "username" in user.user_metadata) {
      setUsernameState(typeof user.user_metadata.username === "string" ? user.user_metadata.username : "");
      return;
    }

    setUsernameState(user.email ? user.email.split("@")[0] : "");
  }, []);

  const fetchUser = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    applyUser(user);
    setLoading(false);
  }, [applyUser, supabase]);

  useEffect(() => {
    startTransition(() => {
      void fetchUser();
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        startTransition(() => {
          void fetchUser();
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      startTransition(() => {
        void fetchUser();
      });
    });

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [fetchUser, supabase]);

  useEffect(() => {
    if (!currentUserId) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const channel = supabase
      .channel(`user-sync:${currentUserId}`)
      .on("broadcast", { event: "username-update" }, ({ payload }) => {
        if (typeof payload.username === "string") {
          setUsernameState(payload.username);
        }
      })
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${currentUserId}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new.username === "string") {
            setUsernameState(payload.new.username);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
    };
  }, [currentUserId, supabase]);

  const setUsername = useCallback((name: string) => {
    // Immediate local update for responsiveness
    setUsernameState(name);

    if (channelRef.current) {
      void channelRef.current.send({
        type: "broadcast",
        event: "username-update",
        payload: { username: name },
      });
    }

    setIsSyncing(true);

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(async () => {
      try {
        const trimmedName = name.trim();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setIsSyncing(false);
          updateTimeoutRef.current = null;
          return;
        }

        const { error } = await supabase.auth.updateUser({
          data: { username: trimmedName },
        });

        if (error) {
          console.error("Failed to update username:", error.message);
        }
      } catch (err) {
        console.error("Context error during username sync:", err);
      } finally {
        setIsSyncing(false);
        updateTimeoutRef.current = null;
      }
    }, 400); // Reduced to 400ms for better responsiveness
  }, [supabase]);

  return (
    <UserContext.Provider value={{ username, user_id: currentUserId, loading, isSyncing, setUsername }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
