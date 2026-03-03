import { queryKeys } from "@/src/lib/queryKeys";
import { supabase } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/store/useAuthStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveFamily } from "./use-active-family";

// ─── Helper to get active family ─────────────────────────────────────────────
async function getActiveFamilyId() {
    return await AsyncStorage.getItem("active_family_id");
}

// ─── Fetch dashboard data ─────────────────────────────────────────────────────
export function useDashboard() {
    const { user } = useAuthStore();
    const { data: familyId } = useActiveFamily();
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    return useQuery({
        queryKey: queryKeys.dashboard("active", month, year),
        enabled: !!user && !!familyId,
        queryFn: async () => {
            const familyId = await getActiveFamilyId();
            if (!familyId) return null;

            const { data: familyData } = await supabase
                .from("families")
                .select("name")
                .eq("id", familyId)
                .single();

            const [catSummary, memSummary, recentExpenses, budgets] =
                await Promise.all([
                    supabase.from("monthly_category_summary").select("*").eq(
                        "family_id",
                        familyId,
                    ).eq("month", month).eq("year", year),
                    supabase.from("monthly_member_summary").select("*").eq(
                        "family_id",
                        familyId,
                    ).eq("month", month).eq("year", year),
                    supabase.from("expenses").select(
                        "*, categories(name, icon, color)",
                    ).eq("family_id", familyId).order("created_at", {
                        ascending: false,
                    }).limit(5),
                    supabase.from("budgets").select("amount").eq(
                        "family_id",
                        familyId,
                    ).eq("month", month).eq("year", year),
                ]);

            return {
                familyId,
                familyName: familyData?.name ?? "My Family",
                categoryData: catSummary.data ?? [],
                memberData: memSummary.data ?? [],
                recentExpenses: recentExpenses.data ?? [],
                totalBudget: budgets.data?.reduce((sum, b) =>
                    sum + b.amount, 0) ?? 0,
            };
        },
    });
}

// ─── Fetch expenses list ──────────────────────────────────────────────────────
export function useExpenses() {
    const { user } = useAuthStore();

    return useQuery({
        queryKey: ["expenses", user?.id],
        enabled: !!user,
        queryFn: async () => {
            const familyId = await getActiveFamilyId();
            if (!familyId) return [];

            const { data } = await supabase
                .from("expenses")
                .select("*, categories(name, icon, color)")
                .eq("family_id", familyId)
                .order("expense_date", { ascending: false })
                .order("created_at", { ascending: false });

            return data ?? [];
        },
    });
}

// ─── Fetch reports ────────────────────────────────────────────────────────────
export function useReports(month: number, year: number) {
    const { user } = useAuthStore();

    return useQuery({
        queryKey: ["reports", user?.id, month, year],
        enabled: !!user,
        queryFn: async () => {
            const familyId = await getActiveFamilyId();
            if (!familyId) return null;

            const { data: catData } = await supabase
                .from("monthly_category_summary")
                .select("*")
                .eq("family_id", familyId)
                .eq("month", month)
                .eq("year", year)
                .order("total_spent", { ascending: false });

            return { familyId, categoryData: catData ?? [] };
        },
    });
}

// ─── Fetch categories ─────────────────────────────────────────────────────────
export function useCategories() {
    const { user } = useAuthStore();

    return useQuery({
        queryKey: ["categories", user?.id],
        enabled: !!user,
        queryFn: async () => {
            const familyId = await getActiveFamilyId();

            const { data } = await supabase
                .from("categories")
                .select("*")
                .or(`family_id.is.null,family_id.eq.${familyId}`)
                .order("name");

            return data ?? [];
        },
    });
}

// ─── Add expense mutation ─────────────────────────────────────────────────────
export function useAddExpense() {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();

    return useMutation({
        mutationFn: async (expense: {
            merchant: string;
            amount: number;
            category_id: string | null;
            notes: string;
            source: "manual" | "receipt_camera" | "receipt_upload";
        }) => {
            const familyId = await getActiveFamilyId();
            if (!familyId) throw new Error("No active family");

            const { error } = await supabase.from("expenses").insert({
                family_id: familyId,
                added_by: user!.id,
                ...expense,
                amount: Number(expense.amount),
            });

            if (error) throw error;
        },
        onSuccess: () => {
            // Invalidate all related queries — triggers automatic refetch
            queryClient.invalidateQueries({ queryKey: ["expenses"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["reports"] });
        },
    });
}
