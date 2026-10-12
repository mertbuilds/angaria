import {
  hashKey,
  type FetchQueryOptions,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';

// Queries whose GİB call still waits in the queue, by query hash.
const waiting = new Set<string>();

/**
 * Queues a query's GİB call through `enqueue`, which calls `started` as its
 * task begins: until then `fetchForeground` may cancel it and queue its own.
 */
export function untilStarted<T>(
  queryKey: QueryKey,
  enqueue: (started: () => void) => Promise<T>,
): Promise<T> {
  const hash = hashKey(queryKey);
  waiting.add(hash);
  const started = () => void waiting.delete(hash);
  return enqueue(started).finally(started);
}

/**
 * fetchQuery for something the user asked for. A fetch of the same key that
 * has no data yet may be a background prefetch (a list total), queued behind
 * every other GİB call: while it waits (`untilStarted`) it is cancelled, so
 * this one runs in the foreground. One already at GİB is joined instead.
 */
export async function fetchForeground<TData, TKey extends QueryKey>(
  queryClient: QueryClient,
  options: FetchQueryOptions<TData, Error, TData, TKey>,
): Promise<TData> {
  const state = queryClient.getQueryState(options.queryKey);
  if (
    state?.fetchStatus === 'fetching' &&
    state.data === undefined &&
    waiting.has(hashKey(options.queryKey))
  ) {
    await queryClient.cancelQueries({ exact: true, queryKey: options.queryKey });
  }
  return queryClient.fetchQuery(options);
}
