import type { FetchQueryOptions, QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * fetchQuery for something the user asked for. A fetch of the same key that
 * has no data yet may be a background prefetch (a list total), queued behind
 * every other GİB call: it is cancelled, so this one runs in the foreground.
 */
export async function fetchForeground<TData, TKey extends QueryKey>(
  queryClient: QueryClient,
  options: FetchQueryOptions<TData, Error, TData, TKey>,
): Promise<TData> {
  const state = queryClient.getQueryState(options.queryKey);
  if (state?.fetchStatus === 'fetching' && state.data === undefined) {
    await queryClient.cancelQueries({ exact: true, queryKey: options.queryKey });
  }
  return queryClient.fetchQuery(options);
}
