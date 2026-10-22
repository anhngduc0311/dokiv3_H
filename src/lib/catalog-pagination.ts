// Stable round-robin pagination across two independently paginated catalogs.
export function sourceWindow(counts: [number, number], offset: number, size: number) {
  const total = counts[0] + counts[1];
  const consumed = (index: number): [number, number] => {
    const bounded = Math.min(total, Math.max(0, index));
    const paired = Math.min(bounded, 2 * Math.min(...counts));
    const result: [number, number] = [Math.ceil(paired / 2), Math.floor(paired / 2)];
    result[counts[0] > counts[1] ? 0 : 1] += bounded - paired;
    return result;
  };
  const start = consumed(offset); const end = consumed(offset + size);
  const order: (0 | 1)[] = [];
  for (let i = offset; i < Math.min(offset + size, total); i++) {
    const before = consumed(i); const after = consumed(i + 1);
    order.push(after[0] > before[0] ? 0 : 1);
  }
  return { offsets: start, limits: [end[0] - start[0], end[1] - start[1]], order, total };
}
export function interleaveSourceItems<T>(items: [T[], T[]], order: (0 | 1)[]): T[] {
  const cursors = [0, 0];
  return order.flatMap(source => { const item = items[source][cursors[source]++]; return item === undefined ? [] : [item]; });
}
