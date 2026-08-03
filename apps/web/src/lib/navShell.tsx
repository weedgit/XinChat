"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const NAV_OPEN_KEY = "xinchat.navOpen";

type NavShellContextValue = {
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  toggleNav: () => void;
  pendingFriendCount: number;
  setPendingFriendCount: (count: number) => void;
};

const NavShellContext = createContext<NavShellContextValue | null>(null);

function readNavOpen(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(NAV_OPEN_KEY);
  if (v === "0" || v === "false") return false;
  return true;
}

export function NavShellProvider({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpenState] = useState(true);
  const [pendingFriendCount, setPendingFriendCount] = useState(0);

  useEffect(() => {
    setNavOpenState(readNavOpen());
  }, []);

  const setNavOpen = useCallback((open: boolean) => {
    localStorage.setItem(NAV_OPEN_KEY, open ? "1" : "0");
    setNavOpenState(open);
  }, []);

  const toggleNav = useCallback(() => {
    setNavOpenState((prev) => {
      const next = !prev;
      localStorage.setItem(NAV_OPEN_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ navOpen, setNavOpen, toggleNav, pendingFriendCount, setPendingFriendCount }),
    [navOpen, setNavOpen, toggleNav, pendingFriendCount]
  );

  return <NavShellContext.Provider value={value}>{children}</NavShellContext.Provider>;
}

export function useNavShell(): NavShellContextValue {
  const ctx = useContext(NavShellContext);
  if (!ctx) {
    return {
      navOpen: true,
      setNavOpen: () => {},
      toggleNav: () => {},
      pendingFriendCount: 0,
      setPendingFriendCount: () => {},
    };
  }
  return ctx;
}
