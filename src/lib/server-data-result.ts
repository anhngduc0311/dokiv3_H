// Keep an unavailable upstream distinct from a confirmed missing resource.
// Call notFound/redirect outside this boundary so Next.js control flow survives.
export async function serverDataResult<T>(load: () => Promise<T>) {
  try {
    return { failed: false as const, data: await load() };
  } catch (error) {
    console.error('[Catalog SSR] Browser recovery required:', error instanceof Error ? error.message : 'Unknown data error');
    return { failed: true as const, data: null };
  }
}
