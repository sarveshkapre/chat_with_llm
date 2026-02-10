export type DeletedAnchor<T extends { id: string }> = {
  item: T;
  beforeId: string | null;
  afterId: string | null;
};

export function captureDeletedAnchors<T extends { id: string }>(
  items: readonly T[],
  deletedIds: readonly string[]
): DeletedAnchor<T>[] {
  if (!items.length || !deletedIds.length) return [];
  const deletedSet = new Set(deletedIds);
  const anchors: DeletedAnchor<T>[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!deletedSet.has(item.id)) continue;
    anchors.push({
      item,
      beforeId: i > 0 ? items[i - 1].id : null,
      afterId: i < items.length - 1 ? items[i + 1].id : null,
    });
  }

  return anchors;
}

export function restoreDeletedAnchors<T extends { id: string }>(
  items: readonly T[],
  deleted: readonly DeletedAnchor<T>[]
): T[] {
  if (!items.length && !deleted.length) return [];
  if (!deleted.length) return [...items];

  const next: T[] = [...items];
  const existingIds = new Set(next.map((item) => item.id));
  const toRestore = deleted.filter((entry) => !existingIds.has(entry.item.id));
  if (!toRestore.length) return next;

  // Restore in original order so `beforeId` anchors that refer to other deleted
  // items work as those items get inserted earlier in this pass.
  for (const entry of toRestore) {
    const idToIndex = new Map(next.map((item, index) => [item.id, index]));

    let insertAt = next.length;
    if (entry.beforeId && idToIndex.has(entry.beforeId)) {
      insertAt = (idToIndex.get(entry.beforeId) ?? -1) + 1;
    } else if (entry.afterId && idToIndex.has(entry.afterId)) {
      insertAt = idToIndex.get(entry.afterId) ?? next.length;
    }

    next.splice(insertAt, 0, entry.item);
    existingIds.add(entry.item.id);
  }

  return next;
}

