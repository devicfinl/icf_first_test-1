import { useMutation, useQueryClient } from "@tanstack/react-query";

const useOptimisticMutation = <T, U>({
  queryKey,
  mutationFn,
}: {
  queryKey: Array<string>;
  mutationFn: (_data: U) => Promise<T>;
}) => {
  const queryClient = useQueryClient();
  const mutation = useMutation<T, Error, U, void>({
    mutationFn,
    onMutate: async (_data: U) => {},
    onSettled: () =>
      Promise.all(
        queryKey.map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      ),
    onError: (err, _newData, _context) => {
      throw err;
    },
  });
  return mutation;
};

export default useOptimisticMutation;
