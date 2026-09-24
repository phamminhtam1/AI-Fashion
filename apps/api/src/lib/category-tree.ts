export type CatNode = { id: string; parentId: string | null };

export function collectDescendantIds(nodes: CatNode[], rootId: string): string[] {
  const byParent = new Map<string | null, string[]>();
  for (const n of nodes) {
    const list = byParent.get(n.parentId) ?? [];
    list.push(n.id);
    byParent.set(n.parentId, list);
  }
  const out: string[] = [];
  const stack = [...(byParent.get(rootId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    for (const child of byParent.get(id) ?? []) stack.push(child);
  }
  return out;
}

export function wouldCreateCycle(nodes: CatNode[], nodeId: string, newParentId: string | null): boolean {
  if (newParentId === null) return false;
  if (newParentId === nodeId) return true;
  const descendants = new Set(collectDescendantIds(nodes, nodeId));
  return descendants.has(newParentId);
}

export function enrichTree<T extends CatNode>(
  nodes: T[],
): Array<T & { depth: number; child_count: number; is_leaf: boolean }> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childCount = new Map<string, number>();
  for (const n of nodes) {
    if (n.parentId) childCount.set(n.parentId, (childCount.get(n.parentId) ?? 0) + 1);
  }
  function depthOf(id: string, seen = new Set<string>()): number {
    const n = byId.get(id);
    if (!n?.parentId) return 0;
    if (seen.has(id)) return 0; // ponytail: broken cycle → treat as root
    seen.add(id);
    return 1 + depthOf(n.parentId, seen);
  }
  return nodes.map((n) => {
    const cc = childCount.get(n.id) ?? 0;
    return { ...n, depth: depthOf(n.id), child_count: cc, is_leaf: cc === 0 };
  });
}

export function sortTreeOrder<T extends CatNode & { sortOrder?: number; name?: string }>(nodes: T[]): T[] {
  const byParent = new Map<string | null, T[]>();
  for (const n of nodes) {
    const list = byParent.get(n.parentId) ?? [];
    list.push(n);
    byParent.set(n.parentId, list);
  }
  for (const list of byParent.values()) {
    list.sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        (a.name ?? "").localeCompare(b.name ?? "", "vi"),
    );
  }
  const out: T[] = [];
  function walk(parentId: string | null) {
    for (const n of byParent.get(parentId) ?? []) {
      out.push(n);
      walk(n.id);
    }
  }
  walk(null);
  return out;
}
