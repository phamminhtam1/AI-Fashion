export type MediaRow = {
  colorway_id: string | null;
  colorway_sort: number;
  url: string;
  sort_order: number;
  is_cover: boolean;
};

export type PublicColorway = {
  id: string;
  sort_order: number;
  thumbnail: string;
  images: string[];
};

/** Group media by colorway; omit null / empty; sort by colorway then cover/sort. */
export function buildPublicColorways(rows: MediaRow[]): PublicColorway[] {
  const by = new Map<string, MediaRow[]>();
  for (const r of rows) {
    if (!r.colorway_id) continue;
    const list = by.get(r.colorway_id) ?? [];
    list.push(r);
    by.set(r.colorway_id, list);
  }
  const result: PublicColorway[] = [];
  for (const [id, list] of by) {
    list.sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order);
    const images = list.map((x) => x.url);
    if (!images.length) continue;
    result.push({
      id,
      sort_order: list[0]!.colorway_sort,
      thumbnail: images[0]!,
      images,
    });
  }
  result.sort((a, b) => a.sort_order - b.sort_order);
  return result;
}
