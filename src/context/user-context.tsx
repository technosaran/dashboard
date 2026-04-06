"use client";

import { createContext, useContext, useState } from "react";

type UserContextType = {
  username: string;
  setUsername: (name: string) => void;
};

const UserContext = createContext<UserContextType>({
  username: "User",
  setUsername: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsernameState] = useState(() => {
    if (typeof window === "undefined") return "User";
    return localStorage.getItem("username") || "User";
  });

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
