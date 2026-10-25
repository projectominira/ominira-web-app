import { describe, expect, test } from "bun:test";
import type { Note } from "@/lib/api/types";
import { collapsedStart, threadOrder } from "./threadOrder";

const reply = (id: string, replyingToId: string | null = null) => ({ id, replyingToId }) as Note;

describe("threadOrder", () => {
  test("groups each reply under the branch it answers", () => {
    const order = threadOrder([reply("a"), reply("b"), reply("c", "a"), reply("d", "c"), reply("e", "b")]);
    expect(order.map((e) => [e.reply.id, e.depth, e.to?.id ?? null])).toEqual([
      ["a", 1, null],
      ["c", 2, null],
      ["d", 2, "c"],
      ["b", 1, null],
      ["e", 2, null],
    ]);
  });

  test("a reply to a missing reply starts its own branch", () => {
    expect(threadOrder([reply("a", "gone")]).map((e) => e.depth)).toEqual([1]);
  });

  test("collapsing never starts mid-branch", () => {
    const order = threadOrder([reply("a"), reply("b", "a"), reply("c", "a"), reply("d")]);
    expect(collapsedStart(order, 2)).toBe(0);
    expect(collapsedStart(order, 1)).toBe(3);
    expect(collapsedStart(order, 9)).toBe(0);
  });
});
