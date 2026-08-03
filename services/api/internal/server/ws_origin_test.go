package server

import "testing"

func TestWSOriginAllowed(t *testing.T) {
	cases := []struct {
		name    string
		cors    string
		origin  string
		allowed bool
	}{
		{"wildcard allows any browser origin", "*", "https://evil.example", true},
		{"wildcard allows empty origin", "*", "", true},
		{"empty config is permissive", "", "https://anything", true},
		{"empty origin allowed under an allowlist", "https://app.xinchat.io", "", true},
		{"matching origin allowed", "https://app.xinchat.io", "https://app.xinchat.io", true},
		{"foreign origin rejected under allowlist", "https://app.xinchat.io", "https://evil.example", false},
		{"localhost allowed under allowlist", "https://app.xinchat.io", "http://localhost:3000", true},
		{"list membership allowed", "https://a.xinchat.io,https://b.xinchat.io", "https://b.xinchat.io", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := wsOriginAllowed(tc.cors, tc.origin); got != tc.allowed {
				t.Fatalf("wsOriginAllowed(%q, %q) = %v, want %v", tc.cors, tc.origin, got, tc.allowed)
			}
		})
	}
}
