import { QueryClient } from "@tanstack/react-query";
import axios from "axios";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (
          failureCount < 3 &&
          axios.isAxiosError(error) &&
          error.response?.status === 500
        ) {
          return true; // Retry if status code is 500 and failure count is less than 3
        }
        return false; // Don't retry for other errors or after 3 retries
      },
      retryDelay: (attempt) => {
        // Exponential backoff: 1s, 2s, 4s, 8s...
        const delay = Math.pow(2, attempt) * 1000; // 2^attempt * 1000ms
        return delay;
      },
      staleTime: 1000 * 30,
      gcTime: 1000 * 30,
    },
  },
});

export default queryClient;
