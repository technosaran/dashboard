"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
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

  const setUsername = async (name: string) => {
    const { error } = await supabase.auth.updateUser({
      data: { username: name }
    });
    
    if (!error) {
      setUsernameState(name);
    }
  };

  return (
    <UserContext.Provider value={{ username, setUsername }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
