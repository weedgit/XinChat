"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import { api, clearToken } from "@/lib/api";
import { useLocale } from "@/lib/locale";
import { useMe } from "@/lib/MeContext";
import { useNavShell } from "@/lib/navShell";
import { useTheme } from "@/lib/theme";
import { unregisterWebPush } from "@/lib/webPush";

function NavIcon({ d }: { d: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  messages:
    "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z",
  groups:
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
  contacts:
    "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M9 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M5.5 16.5c.6-1.6 1.9-2.5 3.5-2.5s2.9.9 3.5 2.5 M15 10h4 M15 14h3",
  calls:
    "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6.1 6.1l1.5-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6A2 2 0 0 1 22 16.9z",
  settings:
    "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z M9 21v-6h6v6",
  moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  chevronDown: "M6 9l6 6 6-6",
  chevronLeft: "M15 18l-6-6 6-6",
  profile:
    "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
};

const MAIN_LINKS = [
  { href: "/", labelKey: "nav.messages" as const, icon: ICONS.messages, match: (p: string) => p === "/" },
  { href: "/groups", labelKey: "nav.groups" as const, icon: ICONS.groups, match: (p: string) => p.startsWith("/groups") },
  { href: "/friends", labelKey: "nav.contacts" as const, icon: ICONS.contacts, match: (p: string) => p.startsWith("/friends") },
  { href: "/call", labelKey: "nav.calls" as const, icon: ICONS.calls, match: (p: string) => p.startsWith("/call") },
  { href: "/settings", labelKey: "nav.settings" as const, icon: ICONS.settings, match: (p: string) => p.startsWith("/settings") },
];

export default function NavSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();
  const { me } = useMe();
  const { theme, setTheme } = useTheme();
  const { setNavOpen } = useNavShell();
  const [moreOpen, setMoreOpen] = useState(false);
  const [nightOn, setNightOn] = useState(true);

  useEffect(() => {
    if (theme === "dark") setNightOn(true);
    else if (theme === "light") setNightOn(false);
    else setNightOn(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, [theme]);

  async function logout() {
    try {
      await unregisterWebPush();
    } catch {
      /* stale endpoints are pruned after 404/410 */
    }
    await api("/v1/auth/logout", { method: "POST" }).catch(() => {});
    clearToken();
    router.replace("/login");
  }

  return (
    <aside className="app-nav" aria-label={t("nav.menu")}>
      <div className="app-nav-brand">
        <img src="/icons/icon-192.png" alt="" width={28} height={28} className="app-nav-logo" />
        <span className="app-nav-brand-text">
          <span className="app-nav-brand-xin">Xin</span>
          <span className="app-nav-brand-chat">Chat</span>
        </span>
      </div>

      <div className="app-nav-profile">
        <Avatar
          name={me?.nickname || me?.username || "?"}
          url={me?.avatarUrl}
          size={72}
        />
        <div className="app-nav-profile-name">{me?.nickname || me?.username || t("nav.profile")}</div>
      </div>

      <nav className="app-nav-menu">
        {MAIN_LINKS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`app-nav-link${active ? " active" : ""}`}
              onClick={() => setMoreOpen(false)}
            >
              <span className="app-nav-link-icon">
                <NavIcon d={item.icon} />
              </span>
              <span className="app-nav-link-label">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="app-nav-footer">
        <div className="app-nav-night">
          <span className="app-nav-night-left">
            <NavIcon d={ICONS.moon} />
            <span>{t("nav.nightMode")}</span>
          </span>
          <button
            type="button"
            className={`app-nav-toggle${nightOn ? " on" : ""}`}
            role="switch"
            aria-checked={nightOn}
            aria-label={t("nav.nightMode")}
            onClick={() => setTheme(nightOn ? "light" : "dark")}
          >
            <span className="app-nav-toggle-thumb" />
          </button>
        </div>

        <button
          type="button"
          className={`app-nav-more-btn${moreOpen ? " open" : ""}`}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <NavIcon d={ICONS.chevronDown} />
          <span>{t("nav.more")}</span>
        </button>

        {moreOpen ? (
          <div className="app-nav-more-panel">
            <Link href="/profile" className="app-nav-more-item" onClick={() => setMoreOpen(false)}>
              <NavIcon d={ICONS.profile} />
              <span>{t("nav.profile")}</span>
            </Link>
            <button type="button" className="app-nav-more-item" onClick={() => void logout()}>
              <NavIcon d={ICONS.logout} />
              <span>{t("nav.logOut")}</span>
            </button>
          </div>
        ) : null}

        <button
          type="button"
          className="app-nav-collapse"
          title={t("nav.hideMenu")}
          aria-label={t("nav.hideMenu")}
          onClick={() => setNavOpen(false)}
        >
          <NavIcon d={ICONS.chevronLeft} />
        </button>
      </div>
    </aside>
  );
}
