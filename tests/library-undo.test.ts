import { describe, expect, it } from "vitest";
import {
  captureDeletedAnchors,
  restoreDeletedAnchors,
  type DeletedAnchor,
} from "@/lib/library-undo";

type Item = { id: string; value: string };

function ids(items: Item[]) {
  return items.map((item) => item.id);
}

describe("library undo helpers", () => {
  it("captures immediate neighbor anchors in original order", () => {
    const items: Item[] = [
      { id: "a", value: "A" },
      { id: "b", value: "B" },
      { id: "c", value: "C" },
      { id: "d", value: "D" },
    ];

    const anchors = captureDeletedAnchors(items, ["b", "c"]);
    expect(anchors).toEqual<DeletedAnchor<Item>[]>([
      { item: items[1], beforeId: "a", afterId: "c" },
      { item: items[2], beforeId: "b", afterId: "d" },
    ]);
  });

  it("restores deleted items back into their relative positions", () => {
    const items: Item[] = [
      { id: "a", value: "A" },
      { id: "b", value: "B" },
      { id: "c", value: "C" },
      { id: "d", value: "D" },
      { id: "e", value: "E" },
    ];

    const deleted = captureDeletedAnchors(items, ["b", "d"]);
    const afterDelete = items.filter((item) => !["b", "d"].includes(item.id));
    expect(ids(afterDelete)).toEqual(["a", "c", "e"]);

    const restored = restoreDeletedAnchors(afterDelete, deleted);
    expect(ids(restored)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("restores consecutive deletions in correct order", () => {
    const items: Item[] = [
      { id: "a", value: "A" },
      { id: "b", value: "B" },
      { id: "c", value: "C" },
      { id: "d", value: "D" },
    ];

    const deleted = captureDeletedAnchors(items, ["b", "c"]);
    const afterDelete = items.filter((item) => !["b", "c"].includes(item.id));
    expect(ids(afterDelete)).toEqual(["a", "d"]);

    const restored = restoreDeletedAnchors(afterDelete, deleted);
    expect(ids(restored)).toEqual(["a", "b", "c", "d"]);
  });

  it("does not drop newly inserted items when undoing", () => {
    const items: Item[] = [
      { id: "a", value: "A" },
      { id: "b", value: "B" },
      { id: "c", value: "C" },
    ];

    const deleted = captureDeletedAnchors(items, ["b"]);
    const afterDelete = items.filter((item) => item.id !== "b");
    const afterNewItem = [{ id: "x", value: "X" }, ...afterDelete];

    const restored = restoreDeletedAnchors(afterNewItem, deleted);
    expect(ids(restored)).toEqual(["x", "a", "b", "c"]);
  });

  it("is a no-op when all deleted items are already present", () => {
    const items: Item[] = [
      { id: "a", value: "A" },
      { id: "b", value: "B" },
    ];
    const deleted = captureDeletedAnchors(items, ["b"]);
    const restored = restoreDeletedAnchors(items, deleted);
    expect(restored).toEqual(items);
  });
});

