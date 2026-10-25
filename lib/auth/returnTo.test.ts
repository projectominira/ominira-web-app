import { expect, test } from "bun:test";
import { isReturnable } from "./returnTo";

test("any app page is returned to, with its query", () => {
  for (const path of ["/home", "/room/7f0c9a52-1e1b-4c3e-9a40-0d6a2f0a1b2c", "/library/wretched?tab=notes", "/reader/wretched"]) expect(isReturnable(path)).toBe(true);
});

test("never auth, admin, or another site", () => {
  for (const path of ["/auth/login", "/auth", "/auth?x=1", "/admin/library", "//evil.example", "https://evil.example", ""]) expect(isReturnable(path)).toBe(false);
});

test("a page merely starting with auth's letters is still returned to", () => {
  expect(isReturnable("/authors")).toBe(true);
});
