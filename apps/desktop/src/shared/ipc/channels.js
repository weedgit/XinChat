/** Shared IPC channel names (main + preload). Keep in sync with apps/web bridge usage. */
const IPC = {
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
  /** Mattermost-style browser focus for notification gating. */
  GET_WINDOW_FOCUSED: "xinchat:get-window-focused",
  WINDOW_FOCUS_CHANGED: "xinchat:window-focus-changed",
  /** Plain-text clipboard write (menu ID copy, message copy, etc.). */
  WRITE_CLIPBOARD_TEXT: "xinchat:write-clipboard-text",
  OPEN_CALL_WINDOW: "xinchat:open-call-window",
  FOCUS_CALL_WINDOW: "xinchat:focus-call-window",
  CLOSE_CALL_WINDOW: "xinchat:close-call-window",
  FOCUS_MAIN_WINDOW: "xinchat:focus-main-window",
  /** Download URL → will-download Save As dialog. */
  DOWNLOAD_URL: "xinchat:download-url",
};

module.exports = { IPC };
