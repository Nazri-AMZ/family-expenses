// src/hooks/useExpenses.ts
import { queryKeys } from "@/src/lib/queryKeys";
import { supabase } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/store/useAuthStore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveFamily } from "./use-active-family";

// ─── Dashboard ────────────────────────────────────────────────────────────────
export function useDashboard() {
    const { user } = useAuthStore();
    const { data: familyId } = useActiveFamily();
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    return useQuery({
        queryKey: queryKeys.dashboard(familyId ?? "", month, year),
        enabled: !!user && !!familyId,
        queryFn: async () => {
            console.log(
                "useDashboard queryFn running with familyId:",
                familyId,
            );

            const [
                familyData,
                catSummary,
                memSummary,
                recentExpenses,
                budgets,
            ] = await Promise.all([
                supabase.from("families").select("name").eq("id", familyId!)
                    .single(),
                supabase.from("monthly_category_summary").select("*").eq(
                    "family_id",
                    familyId!,
                ).eq("month", month).eq("year", year),
                supabase.from("monthly_member_summary").select("*").eq(
                    "family_id",
                    familyId!,
                ).eq("month", month).eq("year", year),

                supabase.rpc("get_latest_grouped_expenses", {
                    p_family_id: familyId,
                }).select("*, categories(name, icon, color)").then((result) => {
                    console.log("RPC result:", JSON.stringify(result.data));
                    console.log("RPC error:", JSON.stringify(result.error));

                    return result;
                }),

                supabase.from("budgets").select("amount").eq(
                    "family_id",
                    familyId!,
                ).eq("month", month).eq("year", year),
            ]);

            return {
                familyId,
                familyName: familyData.data?.name ?? "My Family",
                categoryData: catSummary.data ?? [],
                memberData: memSummary.data ?? [],
                recentExpenses: recentExpenses.data ?? [],

                totalBudget: budgets.data?.reduce((sum, b) =>
                    sum + b.amount, 0) ?? 0,
            };
        },
    });
}

// ─── Expenses list ────────────────────────────────────────────────────────────
export function useExpenses() {
    const { user } = useAuthStore();
    const { data: familyId } = useActiveFamily();

    return useQuery({
        queryKey: queryKeys.expenses(familyId ?? ""),
        enabled: !!user && !!familyId,
        queryFn: async () => {
            const { data } = await supabase
                .from("expenses")
                .select("*, categories(name, icon, color)")
                .eq("family_id", familyId!)
                .order("expense_date", { ascending: false })
                .order("created_at", { ascending: false });

            return data ?? [];
        },
    });
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export function useReports(month: number, year: number) {
    const { user } = useAuthStore();
    const { data: familyId } = useActiveFamily();

    return useQuery({
        queryKey: queryKeys.reports(familyId ?? "", month, year),
        enabled: !!user && !!familyId,
        queryFn: async () => {
            const { data: catData } = await supabase
                .from("monthly_category_summary")
                .select("*")
                .eq("family_id", familyId!)
                .eq("month", month)
                .eq("year", year)
                .order("total_spent", { ascending: false });

            return { familyId, categoryData: catData ?? [] };
        },
    });
}

// ─── Categories ───────────────────────────────────────────────────────────────
export function useCategories() {
    const { user } = useAuthStore();
    const { data: familyId } = useActiveFamily();

    return useQuery({
        queryKey: queryKeys.categories(familyId ?? ""),
        enabled: !!user && !!familyId,
        queryFn: async () => {
            const { data } = await supabase
                .from("categories")
                .select("*")
                .or(`family_id.is.null,family_id.eq.${familyId}`)
                .order("name");

            return data ?? [];
        },
    });
}

// ─── Add expense ──────────────────────────────────────────────────────────────
export function useAddExpense() {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const { data: familyId } = useActiveFamily();

    return useMutation({
        mutationFn: async (payload: any) => {
            if (!familyId) throw new Error("No active family");

            // 1. Normalize items and handle the Total vs Line Items logic
            const rawItems = Array.isArray(payload) ? payload : [payload];

            // Look for total_amount on the first item if it's an array
            const totalFromPayload = Array.isArray(payload)
                ? payload[0]?.total_amount
                : payload.total_amount;

            const lineItemSum = rawItems.reduce(
                (sum, item) => sum + parseFloat(item.amount || 0),
                0,
            );
            const actualTotal = totalFromPayload ?? lineItemSum;

            const adjustmentRatio = lineItemSum > 0
                ? actualTotal / lineItemSum
                : 1;

            // 2. Map items with the adjusted amount
            const finalItems = rawItems.map((item) => {
                const rawAmount = parseFloat(item.amount || 0);

                return {
                    ...item,
                    family_id: familyId,
                    added_by: user!.id,
                    // Multiply by ratio and round to 2 decimal places
                    // Example: RM 75.00 * 0.876 = RM 65.70
                    amount: Math.round((rawAmount * adjustmentRatio) * 100) /
                        100,
                };
            });

            // 3. Remove metadata fields that don't belong in the 'expenses' table
            const cleanedItems = finalItems.map(({ total_amount, ...rest }) =>
                rest
            );

            const { error } = await supabase.from("expenses").insert(
                cleanedItems,
            );

            if (error) throw error;
        },
        onSuccess: () => {
            if (!familyId) return;

            // 1. Invalidate the specific expenses list
            queryClient.invalidateQueries({
                queryKey: queryKeys.expenses(familyId),
            });

            // 2. Invalidate the dashboard data (Make sure this key matches your dashboard useQuery)
            queryClient.invalidateQueries({
                queryKey: [familyId, "dashboard"],
            });

            // 3. Optional: Invalidate everything related to this family to be safe
            queryClient.invalidateQueries({
                queryKey: [familyId],
            });
        },
    });
}
