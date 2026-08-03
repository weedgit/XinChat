const { shell } = require("electron");

/**
 * Same XinChat server if hostnames match (HTTP↔HTTPS redirects, default ports).
 * @param {URL} a
 * @param {URL} b
 */
function isSameWebHost(a, b) {
  return a.hostname.toLowerCase() === b.hostname.toLowerCase();
}

/**
 * Restrict navigation to the configured web host; open other http(s) in the OS browser.
 * @param {Electron.BrowserWindow} win
 * @param {string} webUrl
 * @param {{ onDeepLink?: (url: string) => boolean }} [opts]
 */
function attachNavigationGuards(win, webUrl, opts = {}) {
  let allowed;
  try {
    allowed = new URL(webUrl);
  } catch {
    allowed = null;
  }

  const handleXinChat = (url) => {
    if (typeof opts.onDeepLink === "function" && opts.onDeepLink(url)) return true;
    shell.openExternal(url).catch(() => {});
    return true;
  };

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "xinchat:" || parsed.protocol === "qchat:") {
        handleXinChat(url);
        return { action: "deny" };
      }
      if (allowed && isSameWebHost(parsed, allowed)) {
        return { action: "allow" };
      }
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        shell.openExternal(url);
      }
    } catch {
      /* ignore invalid urls */
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    try {
      const target = new URL(url);
      if (target.protocol === "xinchat:" || target.protocol === "qchat:") {
        event.preventDefault();
        handleXinChat(url);
        return;
      }
      if (allowed && isSameWebHost(target, allowed)) {
        return;
      }
      event.preventDefault();
      if (target.protocol === "http:" || target.protocol === "https:") {
        shell.openExternal(url);
      }
    } catch {
      event.preventDefault();
    }
  });
}

module.exports = { attachNavigationGuards };
