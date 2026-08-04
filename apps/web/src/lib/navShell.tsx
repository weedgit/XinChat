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

const NAV_STATE_KEY = "xinchat.navState";

export type NavSidebarState = "expanded" | "collapsed";

type NavShellContextValue = {
  navState: NavSidebarState;
  navExpanded: boolean;
  setNavState: (state: NavSidebarState) => void;
  toggleNav: () => void;
  pendingFriendCount: number;
  setPendingFriendCount: (count: number) => void;
};

const NavShellContext = createContext<NavShellContextValue | null>(null);

function readNavState(): NavSidebarState {
  if (typeof window === "undefined") return "expanded";
  const v = localStorage.getItem(NAV_STATE_KEY);
  if (v === "collapsed") return "collapsed";
  // migrate old boolean key
  const legacy = localStorage.getItem("xinchat.navOpen");
  if (legacy === "0" || legacy === "false") return "collapsed";
  return "expanded";
}

export function NavShellProvider({ children }: { children: ReactNode }) {
  const [navState, setNavStateInternal] = useState<NavSidebarState>("expanded");
  const [pendingFriendCount, setPendingFriendCount] = useState(0);

  useEffect(() => {
    setNavStateInternal(readNavState());
  }, []);

  const setNavState = useCallback((state: NavSidebarState) => {
    localStorage.setItem(NAV_STATE_KEY, state);
    setNavStateInternal(state);
  }, []);

  const toggleNav = useCallback(() => {
    setNavStateInternal((prev) => {
      const next: NavSidebarState = prev === "expanded" ? "collapsed" : "expanded";
      localStorage.setItem(NAV_STATE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      navState,
      navExpanded: navState === "expanded",
      setNavState,
      toggleNav,
      pendingFriendCount,
      setPendingFriendCount,
    }),
    [navState, setNavState, toggleNav, pendingFriendCount]
  );

  return <NavShellContext.Provider value={value}>{children}</NavShellContext.Provider>;
}

export function useNavShell(): NavShellContextValue {
  const ctx = useContext(NavShellContext);
  if (!ctx) {
    return {
      navState: "expanded",
      navExpanded: true,
      setNavState: () => {},
      toggleNav: () => {},
      pendingFriendCount: 0,
      setPendingFriendCount: () => {},
    };
  }
  return ctx;
}
