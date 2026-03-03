// src/hooks/useActiveFamily.ts
import { queryKeys } from "@/src/lib/queryKeys";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function useActiveFamily() {
    return useQuery({
        queryKey: queryKeys.activeFamily,
        queryFn: () => AsyncStorage.getItem("active_family_id"),
        staleTime: Infinity,
    });
}

// Call this whenever active family changes
export function useInvalidateFamily() {
    const queryClient = useQueryClient();

    return async (newFamilyId?: string) => {
        // Force refetch of active family from AsyncStorage
        await queryClient.invalidateQueries({
            queryKey: queryKeys.activeFamily,
        });
        await queryClient.refetchQueries({ queryKey: queryKeys.activeFamily });

        // Invalidate all data queries for old + new family
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
        queryClient.invalidateQueries({ queryKey: ["reports"] });
        queryClient.invalidateQueries({ queryKey: ["categories"] });

        // If new family id provided, also clear its specific cache
        if (newFamilyId) {
            queryClient.removeQueries({ queryKey: queryKeys.all(newFamilyId) });
        }
    };
}
