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
                supabase.from("expenses").select(
                    "*, categories(name, icon, color)",
                ).eq("family_id", familyId!).order("created_at", {
                    ascending: false,
                }).limit(5),
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
        mutationFn: async (expense: {
            merchant: string;
            amount: number;
            category_id: string | null;
            notes: string;
            source: "manual" | "receipt_camera" | "receipt_upload";
        }) => {
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
            if (!familyId) return;
            queryClient.invalidateQueries({
                queryKey: queryKeys.expenses(familyId),
            });
            queryClient.invalidateQueries({
                queryKey: [familyId, "dashboard"],
            });
            queryClient.invalidateQueries({ queryKey: [familyId, "reports"] });
        },
    });
}
