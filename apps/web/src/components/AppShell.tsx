"use client";

import { useEffect } from "react";
import NavSidebar from "@/components/NavSidebar";
import { NavShellProvider, useNavShell } from "@/lib/navShell";
import { getToken, restoreDesktopSession } from "@/lib/api";

function AppShellInner({
  children,
  rail = true,
  className,
  mobilePane,
  sidebarCollapsed = false,
}: {
  children: React.ReactNode;
  rail?: boolean;
  className?: string;
  mobilePane?: "list" | "chat";
  sidebarCollapsed?: boolean;
}) {
  const { navOpen } = useNavShell();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = (await restoreDesktopSession()) || Boolean(getToken());
      if (cancelled) return;
      if (!ok) {
        window.location.replace("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className={["shell", className].filter(Boolean).join(" ")}
      data-ui="arena"
      data-mobile-pane={mobilePane}
      data-sidebar-collapsed={sidebarCollapsed ? "true" : undefined}
      data-nav-collapsed={rail && !navOpen ? "true" : undefined}
    >
      {rail && navOpen ? <NavSidebar /> : null}
      {children}
    </div>
  );
}

export default function AppShell(props: {
  children: React.ReactNode;
  rail?: boolean;
  className?: string;
  mobilePane?: "list" | "chat";
  sidebarCollapsed?: boolean;
}) {
  return (
    <NavShellProvider>
      <AppShellInner {...props} />
    </NavShellProvider>
  );
}
