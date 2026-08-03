const assert = require("assert");
const { parseDeepLink, getDeepLinkFromArgv } = require("../src/main/app/deepLinkParse");

function ok(url, id) {
  const p = parseDeepLink(url);
  assert.ok(p, `expected parse: ${url}`);
  assert.strictEqual(p.conversationId, id);
}

function bad(url) {
  assert.strictEqual(parseDeepLink(url), null, `expected reject: ${url}`);
}

ok("xinchat://conversation/abc-123", "abc-123");
ok("xinchat://chat/deadbeef", "deadbeef");
ok("xinchat://c/x1", "x1");
ok("xinchat:///conversation/uuid-here", "uuid-here");
ok("xinchat://open?conversation=conv1", "conv1");
ok("xinchat://open?id=conv2", "conv2");
ok("qchat://conversation/legacy-1", "legacy-1");

bad("");
bad("https://example.com/conversation/x");
bad("xinchat://conversation/");
bad("xinchat://conversation/../etc/passwd");
bad("xinchat://evil.com/conversation/x");
bad("xinchat://conversation/has spaces");

assert.strictEqual(
  getDeepLinkFromArgv(["electron", ".", "xinchat://chat/z9"]),
  "xinchat://chat/z9"
);
assert.strictEqual(
  getDeepLinkFromArgv(["electron", ".", "qchat://chat/legacy"]),
  "qchat://chat/legacy"
);
assert.strictEqual(getDeepLinkFromArgv(["electron", "."]), null);

console.log("protocol deep-link parse: ok");
