const { contextBridge, ipcRenderer } = require("electron");

// Sandboxed preloads only get Electron's limited require() polyfill. Node core
// modules (for example "os") and local CommonJS files are unavailable here.
// Keep these values in sync with src/shared/ipc/channels.js.
const IPC = Object.freeze({
  DESKTOP_NOTIFY: "xinchat:desktop-notify",
  FETCH_CAPTCHA: "xinchat:fetch-captcha",
  SHOW_ABOUT: "xinchat:show-about",
  RENDERER_READY: "xinchat:renderer-ready",
  OPEN_CONVERSATION: "xinchat:open-conversation",
  SET_UNREAD_STATUS: "xinchat:set-unread-status",
  SECURE_SESSION_AVAILABLE: "xinchat:secure-session-available",
  SECURE_SESSION_GET: "xinchat:secure-session-get",
  SECURE_SESSION_SET: "xinchat:secure-session-set",
  SECURE_SESSION_CLEAR: "xinchat:secure-session-clear",
  GET_NATIVE_THEME: "xinchat:get-native-theme",
  SET_NATIVE_THEME_SOURCE: "xinchat:set-native-theme-source",
  NATIVE_THEME_UPDATED: "xinchat:native-theme-updated",
  GET_NETWORK_ONLINE: "xinchat:get-network-online",
  USER_ACTIVITY_UPDATE: "xinchat:user-activity-update",
  GET_WINDOW_FOCUSED: "xinchat:get-window-focused",
  WINDOW_FOCUS_CHANGED: "xinchat:window-focus-changed",
  WRITE_CLIPBOARD_TEXT: "xinchat:write-clipboard-text",
  OPEN_CALL_WINDOW: "xinchat:open-call-window",
  FOCUS_CALL_WINDOW: "xinchat:focus-call-window",
  CLOSE_CALL_WINDOW: "xinchat:close-call-window",
  FOCUS_MAIN_WINDOW: "xinchat:focus-main-window",
  DOWNLOAD_URL: "xinchat:download-url",
});

function argumentValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) || "";
}

function decodedArgumentValue(name) {
  const value = argumentValue(name);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// The main process has Node access and computes this before creating the
// BrowserWindow. process.platform remains available in a sandboxed preload.
const osLabel =
  decodedArgumentValue("xinchat-platform-label") || process.platform || "Desktop";

contextBridge.exposeInMainWorld("xinchatDesktop", {
  isDesktop: true,
  platform: process.platform,
  platformLabel: osLabel,
  version: argumentValue("xinchat-version"),
  webUrl: argumentValue("xinchat-web-url"),
  deviceName: `XinChat Desktop (${osLabel})`,
  notifyMessage: (payload) => ipcRenderer.invoke(IPC.DESKTOP_NOTIFY, payload),
  showAbout: () => ipcRenderer.invoke(IPC.SHOW_ABOUT),
  fetchCaptcha: () => ipcRenderer.invoke(IPC.FETCH_CAPTCHA),
  setUnreadStatus: (payload) => ipcRenderer.invoke(IPC.SET_UNREAD_STATUS, payload),
  signalReady: () => ipcRenderer.send(IPC.RENDERER_READY),
  onOpenConversation: (handler) => {
    if (typeof handler !== "function") return () => {};
    const listener = (_event, conversationId) => handler(conversationId);
    ipcRenderer.on(IPC.OPEN_CONVERSATION, listener);
    return () => ipcRenderer.removeListener(IPC.OPEN_CONVERSATION, listener);
  },
  /** OS-backed encrypted session tokens (AUTH-03). */
  secureSessionAvailable: () => ipcRenderer.invoke(IPC.SECURE_SESSION_AVAILABLE),
  getSecureSession: () => ipcRenderer.invoke(IPC.SECURE_SESSION_GET),
  setSecureSession: (tokens) => ipcRenderer.invoke(IPC.SECURE_SESSION_SET, tokens),
  clearSecureSession: () => ipcRenderer.invoke(IPC.SECURE_SESSION_CLEAR),
  /** SHELL-31: OS / shell chrome theme. */
  getNativeTheme: () => ipcRenderer.invoke(IPC.GET_NATIVE_THEME),
  setNativeThemeSource: (source) =>
    ipcRenderer.invoke(IPC.SET_NATIVE_THEME_SOURCE, source),
  onNativeThemeUpdated: (handler) => {
    if (typeof handler !== "function") return () => {};
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on(IPC.NATIVE_THEME_UPDATED, listener);
    return () => ipcRenderer.removeListener(IPC.NATIVE_THEME_UPDATED, listener);
  },
  /** SHELL-32: main-process network probe (complements window online/offline). */
  getNetworkOnline: () => ipcRenderer.invoke(IPC.GET_NETWORK_ONLINE),
  /** Mattermost-style OS window focus for desktop notification gating. */
  isWindowFocused: () => ipcRenderer.invoke(IPC.GET_WINDOW_FOCUSED),
  onWindowFocusChanged: (handler) => {
    if (typeof handler !== "function") return () => {};
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on(IPC.WINDOW_FOCUS_CHANGED, listener);
    return () => ipcRenderer.removeListener(IPC.WINDOW_FOCUS_CHANGED, listener);
  },
  /** AUTH-04: system idle / lock → activity bridge. */
  onUserActivity: (handler) => {
    if (typeof handler !== "function") return () => {};
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on(IPC.USER_ACTIVITY_UPDATE, listener);
    return () =>
      ipcRenderer.removeListener(IPC.USER_ACTIVITY_UPDATE, listener);
  },
  /** Native clipboard write — Clipboard API is often denied in the shell. */
  writeClipboardText: (text) =>
    ipcRenderer.invoke(IPC.WRITE_CLIPBOARD_TEXT, text),
  /** CALL-03 — Telegram-style dedicated video chat window. */
  openCallWindow: (path) => ipcRenderer.invoke(IPC.OPEN_CALL_WINDOW, { path }),
  focusCallWindow: () => ipcRenderer.invoke(IPC.FOCUS_CALL_WINDOW),
  closeCallWindow: () => ipcRenderer.invoke(IPC.CLOSE_CALL_WINDOW),
  focusMainWindow: () => ipcRenderer.invoke(IPC.FOCUS_MAIN_WINDOW),
  /** Triggers native Save As via session will-download handler. */
  downloadURL: (url) => ipcRenderer.invoke(IPC.DOWNLOAD_URL, { url }),
});
