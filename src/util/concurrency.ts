/**
 * Concurrency-capped async map. Mirrors `Promise.all(items.map(fn))` semantics
 * (input-order results, rejects on first rejection) but bounds the number of
 * in-flight tasks to `limit`. Used to overlap stat-report poll waits without
 * flooding the Naver API.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed: unknown;
  let hasFailed = false;

  const worker = async (): Promise<void> => {
    while (next < items.length && !hasFailed) {
      const i = next++;
      try {
        results[i] = await fn(items[i] as T, i);
      } catch (err) {
        if (!hasFailed) {
          hasFailed = true;
          failed = err;
        }
      }
    }
  };

  const poolSize = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: poolSize }, () => worker()));

  if (hasFailed) throw failed;
  return results;
}

/** Max concurrent stat-report jobs (POST + poll + download) against the Naver API. */
export const CONCURRENT_STAT_JOBS = 8;
