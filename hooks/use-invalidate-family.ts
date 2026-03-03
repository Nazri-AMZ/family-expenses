import { queryKeys } from "@/src/lib/queryKeys";
import { useQueryClient } from "@tanstack/react-query";

export function useInvalidateFamily() {
    const queryClient = useQueryClient();

    return (familyId: string) => {
        // This single call wipes ALL queries that start with [familyId]
        queryClient.invalidateQueries({ queryKey: queryKeys.all(familyId) });
        // Also reset active family so it refetches from AsyncStorage
        queryClient.invalidateQueries({ queryKey: ["activeFamily"] });
    };
}
