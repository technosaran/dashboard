"use client";

import { createContext, useContext, useEffect, useState } from "react";

type UserContextType = {
  username: string;
  setUsername: (name: string) => void;
};

const UserContext = createContext<UserContextType>({
  username: "User",
  setUsername: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsernameState] = useState("User");

  useEffect(() => {
    const stored = localStorage.getItem("username");
    if (stored) {
      // Use setTimeout to avoid synchronous state updates in useEffect
      // which can trigger cascading renders warning.
      const timeout = setTimeout(() => setUsernameState(stored), 0);
      return () => clearTimeout(timeout);
    }
  }, []);

  const setUsername = (name: string) => {
    setUsernameState(name);
    localStorage.setItem("username", name);
  };

  return (
    <UserContext.Provider value={{ username, setUsername }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
