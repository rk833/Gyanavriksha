import { QueryClient } from '@tanstack/react-query';

/**
 * Shared QueryClient for TanStack Query. Import this for manual cache
 * invalidation (e.g. after mutations): queryClient.invalidateQueries({...}).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});
