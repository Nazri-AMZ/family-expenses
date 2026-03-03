import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";

export function useActiveFamily() {
    return useQuery({
        queryKey: ["activeFamily"],
        queryFn: () => AsyncStorage.getItem("active_family_id"),
        staleTime: Infinity,
    });
}
