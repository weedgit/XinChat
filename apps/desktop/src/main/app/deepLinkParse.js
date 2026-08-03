const { APP_PROTOCOL } = require("../../shared/constants");

/** Former scheme kept for printed QR / bookmarks during rebrand. */
const LEGACY_PROTOCOLS = ["qchat"];

function protocolNames() {
  return [APP_PROTOCOL, ...LEGACY_PROTOCOLS];
}

function matchesAppProtocol(raw) {
  if (!raw || typeof raw !== "string") return false;
  const lower = raw.trim().toLowerCase();
  return protocolNames().some((p) => lower.startsWith(`${p}:`));
}

/**
 * Parse xinchat:// (and legacy qchat://) deep links into an action for the main window.
 *
 * Supported (SHELL-28 / SHELL-29):
 *   xinchat://conversation/<id>
 *   xinchat://chat/<id>
 *   xinchat://c/<id>
 *   xinchat://open?conversation=<id>
 *   xinchat://open?id=<id>
 *
 * @param {string} raw
 * @returns {{ conversationId: string } | null}
 */
function parseDeepLink(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!matchesAppProtocol(trimmed)) return null;
  // Reject path traversal before URL normalization can rewrite segments.
  if (trimmed.includes("..")) return null;

  let u;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }
  const proto = String(u.protocol || "")
    .replace(/:$/, "")
    .toLowerCase();
  if (!protocolNames().includes(proto)) return null;

  const host = String(u.hostname || "").toLowerCase();
  const parts = String(u.pathname || "")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });

  if (parts.some((p) => p === "." || p === ".." || p.includes(".."))) return null;

  let id = "";
  if (host === "conversation" || host === "chat" || host === "c") {
    if (parts.length !== 1) return null;
    id = parts[0] || "";
  } else if (!host && parts.length === 2 && ["conversation", "chat", "c"].includes(parts[0])) {
    id = parts[1] || "";
  } else if (host === "open" || (parts[0] === "open" && parts.length === 1)) {
    id = u.searchParams.get("conversation") || u.searchParams.get("id") || "";
  } else {
    return null;
  }

  id = String(id || "").trim();
  // Conversation ids are UUIDs (or similarly safe opaque tokens).
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)) return null;
  return { conversationId: id };
}

/**
 * Find a xinchat:// (or legacy qchat://) URL in Electron / OS argv.
 * @param {string[]} argv
 * @returns {string | null}
 */
function getDeepLinkFromArgv(argv) {
  if (!Array.isArray(argv)) return null;
  for (let i = argv.length - 1; i >= 0; i--) {
    const a = String(argv[i] || "");
    if (matchesAppProtocol(a)) {
      return a;
    }
  }
  return null;
}

module.exports = {
  APP_PROTOCOL,
  LEGACY_PROTOCOLS,
  parseDeepLink,
  getDeepLinkFromArgv,
};
