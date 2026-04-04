import { QueryClient } from '@tanstack/react-query';

/**
 * Shared QueryClient for TanStack Query. Import this for manual cache
 * invalidation (e.g. after mutations): queryClient.invalidateQueries({...}).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
