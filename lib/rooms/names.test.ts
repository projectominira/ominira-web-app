import { describe, expect, test } from "bun:test";
import { memberLine } from "./names";

describe("memberLine", () => {
  const m = (readerId: string, pseudonym: string) => ({ readerId, pseudonym });
  test("first names, the viewer last as You", () => {
    expect(memberLine([m("a", "Yeast"), m("b", "Comrade Muiz Reads"), m("me", "Kemi")], "me")).toBe("Yeast, Muiz, You");
    expect(memberLine([m("a", "Yeast"), m("me", "Kemi")], "me")).toBe("Yeast, You");
    expect(memberLine([m("me", "Kemi")], "me")).toBe("You");
    expect(memberLine([m("a", "Yeast"), m("b", "Muiz")], null)).toBe("Yeast, Muiz");
  });
});
