"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import { api, clearToken } from "@/lib/api";
import { copyTextToClipboard } from "@/lib/clipboard";
import { useLocale } from "@/lib/locale";
import { useMe } from "@/lib/MeContext";
import { useNavShell } from "@/lib/navShell";
import { useDesktopIdleStatus } from "@/lib/useDesktopIdleStatus";
import { unregisterWebPush } from "@/lib/webPush";

function NavIcon({ d }: { d: string }) {
  return (
    <svg
      width="18"
      height="18"
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
  profile:
    "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M9 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M5.5 16.5c.6-1.6 1.9-2.5 3.5-2.5s2.9.9 3.5 2.5 M15 10h4 M15 14h3",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  users:
    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8",
  settings:
    "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 5 15.4a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  language:
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z",
  status:
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M8 14s1.5 2 4 2 4-2 4-2 M9 9v1.2 M15 9v1.2",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  copy: "M9 9h10v12H9z M5 15V3h10",
  select: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8.5 12l2.5 2.5 4.5-4.5",
  menu: "M3 6h18 M3 12h18 M3 18h18",
  chevronLeft: "M15 18l-6-6 6-6",
  chevronRight: "M9 18l6-6-6-6",
};

const MAIN_LINKS = [
  { href: "/profile", labelKey: "nav.profile" as const, icon: ICONS.profile, match: (p: string) => p.startsWith("/profile") },
  { href: "/friends", labelKey: "menu.contacts" as const, icon: ICONS.user, match: (p: string) => p.startsWith("/friends"), badge: true },
  { href: "/groups", labelKey: "menu.groups" as const, icon: ICONS.users, match: (p: string) => p.startsWith("/groups") },
  { href: "/settings", labelKey: "menu.settings" as const, icon: ICONS.settings, match: (p: string) => p.startsWith("/settings") },
];

export default function NavSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale, labelLocale } = useLocale();
  const { me, refreshMe } = useMe();
  const { pendingFriendCount, navState, navExpanded, toggleNav } = useNavShell();
  const [menuCopiedField, setMenuCopiedField] = useState<"username" | "phone" | null>(null);
  const [myStatus, setMyStatus] = useState<"online" | "away" | "dnd" | "offline">("online");
  const { noteManualStatusChange } = useDesktopIdleStatus(myStatus, setMyStatus);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  function copyMenuField(field: "username" | "phone", value: string) {
    const text = value.trim();
    if (!text) return;
    void copyTextToClipboard(text).then((ok) => {
      if (!ok) return;
      setMenuCopiedField(field);
      window.setTimeout(() => {
        setMenuCopiedField((cur) => (cur === field ? null : cur));
      }, 1500);
    });
  }

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

  const statusLabel =
    myStatus === "online"
      ? t("status.online")
      : myStatus === "away"
        ? t("status.away")
        : myStatus === "dnd"
          ? t("status.dnd")
          : t("status.offline");

  return (
    <aside className="app-nav" data-state={navState} aria-label={t("nav.menu")}>
      <button
        type="button"
        className="app-nav-toggle"
        title={navExpanded ? t("nav.hideMenu") : t("nav.showMenu")}
        aria-label={navExpanded ? t("nav.hideMenu") : t("nav.showMenu")}
        aria-expanded={navExpanded}
        onClick={toggleNav}
      >
        <NavIcon d={navExpanded ? ICONS.chevronLeft : ICONS.chevronRight} />
        {!navExpanded && pendingFriendCount > 0 ? <span className="menu-pending-dot" aria-hidden /> : null}
      </button>
      <div className="app-nav-header">
        <div className="app-nav-brand">
          <img src="/icons/icon-192.png" alt="" width={28} height={28} className="app-nav-logo" />
          <span className="app-nav-brand-text">
            <span className="app-nav-brand-xin">Xin</span>
            <span className="app-nav-brand-chat">Chat</span>
          </span>
        </div>

        <div className="app-nav-profile">
          <Avatar name={me?.nickname || me?.username || "?"} url={me?.avatarUrl} size={72} className="app-nav-avatar-lg" />
          <Avatar name={me?.nickname || me?.username || "?"} url={me?.avatarUrl} size={36} className="app-nav-avatar-sm" />
          <div className="app-nav-profile-name">{me?.nickname || me?.username || t("nav.profile")}</div>
        <div className="app-nav-id-list">
          <button
            type="button"
            className="app-nav-id-row"
            title={t("me.copyUsername")}
            disabled={!me?.username}
            onClick={() => copyMenuField("username", me?.username || "")}
          >
            <span className="app-nav-id-value">{me?.username ? `@${me.username}` : "—"}</span>
            <NavIcon d={menuCopiedField === "username" ? ICONS.select : ICONS.copy} />
          </button>
          <button
            type="button"
            className="app-nav-id-row"
            title={t("me.copyPhone")}
            disabled={!me?.phone}
            onClick={() => copyMenuField("phone", me?.phone || "")}
          >
            <span className="app-nav-id-value">{me?.phone || "—"}</span>
            <NavIcon d={menuCopiedField === "phone" ? ICONS.select : ICONS.copy} />
          </button>
        </div>
        <div className={`app-nav-profile-meta${me?.enterpriseId ? " is-enterprise" : ""}`}>
          {me?.enterpriseId ? (
            <>
              <NavIcon d={ICONS.users} />
              <span>
                {me.enterpriseName
                  ? `${t("account.enterprise")} · ${me.enterpriseName}`
                  : t("account.enterprise")}
              </span>
            </>
          ) : (
            t("account.enterprise")
          )}
        </div>
      </div>
      </div>

      <div className="app-nav-sep" />

      <nav className="app-nav-menu">
        {MAIN_LINKS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link key={item.href} href={item.href} className={`app-nav-link${active ? " active" : ""}`}>
              <span className="app-nav-link-icon">
                <NavIcon d={item.icon} />
              </span>
              <span className="app-nav-link-label">{t(item.labelKey)}</span>
              {item.badge && pendingFriendCount > 0 ? (
                <span className="badge app-nav-link-badge">
                  {pendingFriendCount > 99 ? "99+" : pendingFriendCount}
                </span>
              ) : null}
            </Link>
          );
        })}

        <button
          type="button"
          className="app-nav-link app-nav-link-btn"
          onClick={() => {
            const order = ["en", "zh"] as const;
            const i = order.indexOf(locale);
            setLocale(order[(i + 1) % order.length]);
          }}
        >
          <span className="app-nav-link-icon">
            <NavIcon d={ICONS.language} />
          </span>
          <span className="app-nav-link-label">
            {t("menu.language")}: {labelLocale(locale)}
          </span>
        </button>

        <button
          type="button"
          className="app-nav-link app-nav-link-btn"
          onClick={() => {
            const order = ["online", "away", "dnd", "offline"] as const;
            const i = order.indexOf(myStatus);
            const next = order[(i + 1) % order.length];
            noteManualStatusChange(next);
            setMyStatus(next);
            api("/v1/me/status", {
              method: "PUT",
              body: JSON.stringify({ status: next }),
            }).catch(() => {});
          }}
        >
          <span className="app-nav-link-icon">
            <NavIcon d={ICONS.status} />
          </span>
          <span className="app-nav-link-label">
            {t("status.label")}: {statusLabel}
          </span>
        </button>
      </nav>

      <div className="app-nav-sep" />

      <div className="app-nav-footer">
        <div className="app-nav-rail-avatar">
          <Avatar name={me?.nickname || me?.username || "?"} url={me?.avatarUrl} size={36} />
        </div>
        <button type="button" className="app-nav-link app-nav-link-btn app-nav-logout" onClick={() => void logout()}>
          <span className="app-nav-link-icon">
            <NavIcon d={ICONS.logout} />
          </span>
          <span className="app-nav-link-label">{t("nav.logOut")}</span>
        </button>
      </div>
    </aside>
  );
}
