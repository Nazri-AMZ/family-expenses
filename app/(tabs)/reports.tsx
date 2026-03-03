import { useAuthStore } from "@/src/store/useAuthStore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { supabase } from "../../src/lib/supabase";
import type { MonthlyCategorySummary } from "../../src/types/database";

function ProgressBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <View
      style={{
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 99,
        height: 5,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 99,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

type MonthOption = { label: string; month: number; year: number };

export default function ReportsScreen() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [categoryData, setCategoryData] = useState<MonthlyCategorySummary[]>(
    [],
  );
  const [monthlyTotals, setMonthlyTotals] = useState<
    { month: number; year: number; total: number; label: string }[]
  >([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Generate last 6 months
  const months: MonthOption[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return {
      label: d.toLocaleString("default", { month: "short" }),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    };
  }).reverse();

  const fetchData = async () => {
    if (!user) return;

    const { data: memberRow } = await supabase
      .from("family_members")
      .select("family_id")
      .eq("user_id", user.id)
      .single();

    if (!memberRow) {
      setLoading(false);
      return;
    }
    setFamilyId(memberRow.family_id);

    // Category breakdown for selected month
    const { data: catData } = await supabase
      .from("monthly_category_summary")
      .select("*")
      .eq("family_id", memberRow.family_id)
      .eq("month", selectedMonth)
      .eq("year", selectedYear)
      .order("total_spent", { ascending: false });

    setCategoryData(catData ?? []);

    // Monthly totals for bar chart
    const totals = await Promise.all(
      months.map(async (m) => {
        const { data } = await supabase
          .from("monthly_category_summary")
          .select("total_spent")
          .eq("family_id", memberRow.family_id)
          .eq("month", m.month)
          .eq("year", m.year);

        return {
          ...m,
          total: (data ?? []).reduce(
            (sum, r) => sum + Number(r.total_spent),
            0,
          ),
        };
      }),
    );

    setMonthlyTotals(totals);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, [user, selectedMonth, selectedYear]);

  const maxMonthly = Math.max(...monthlyTotals.map((m) => m.total), 1);
  const totalSpent = categoryData.reduce(
    (sum, c) => sum + Number(c.total_spent),
    0,
  );

  if (loading)
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#4ADE80" size="large" />
      </View>
    );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchData();
          }}
          tintColor="#4ADE80"
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
        <Text style={styles.subtitle}>6-month spending overview</Text>
      </View>

      {/* Bar Chart */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Monthly Spending (RM)</Text>
        <View style={styles.barChart}>
          {monthlyTotals.map((m) => {
            const isCurrent =
              m.month === selectedMonth && m.year === selectedYear;
            const barH = Math.max(Math.round((m.total / maxMonthly) * 100), 4);
            return (
              <View
                key={`${m.month}-${m.year}`}
                style={styles.barCol}
                onStartShouldSetResponder={() => true}
                onResponderGrant={() => {
                  setSelectedMonth(m.month);
                  setSelectedYear(m.year);
                }}
              >
                <Text
                  style={[
                    styles.barValue,
                    { color: isCurrent ? "#4ADE80" : "#334155" },
                  ]}
                >
                  {m.total > 0 ? `${(m.total / 1000).toFixed(1)}k` : ""}
                </Text>
                <View
                  style={[
                    styles.bar,
                    {
                      height: barH,
                      backgroundColor: isCurrent ? "#4ADE80" : "#1E3A5F",
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.barLabel,
                    {
                      color: isCurrent ? "#4ADE80" : "#475569",
                      fontWeight: isCurrent ? "700" : "400",
                    },
                  ]}
                >
                  {m.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Summary */}
      <View
        style={[
          styles.card,
          { flexDirection: "row", justifyContent: "space-between" },
        ]}
      >
        <View>
          <Text style={styles.cardLabel}>Total Spent</Text>
          <Text style={styles.summaryAmount}>RM {totalSpent.toFixed(2)}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.cardLabel}>Categories</Text>
          <Text style={styles.summaryAmount}>{categoryData.length}</Text>
        </View>
      </View>

      {/* Category Breakdown */}
      <Text style={styles.sectionLabel}>By Category</Text>
      {categoryData.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No expenses for this month</Text>
        </View>
      ) : (
        categoryData.map((cat) => (
          <View key={cat.category_id} style={styles.categoryRow}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <Text style={{ fontSize: 18 }}>{cat.category_icon}</Text>
                <Text style={styles.categoryName}>{cat.category_name}</Text>
                <Text style={styles.expenseCount}>
                  {cat.expense_count} items
                </Text>
              </View>
              <Text
                style={[styles.categoryAmount, { color: cat.category_color }]}
              >
                RM {Number(cat.total_spent).toFixed(2)}
              </Text>
            </View>
            <ProgressBar
              value={Number(cat.total_spent)}
              max={totalSpent}
              color={cat.category_color}
            />
            <Text style={styles.percentage}>
              {Math.round((Number(cat.total_spent) / totalSpent) * 100)}% of
              total
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", padding: 20 },
  centered: {
    flex: 1,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  header: { paddingTop: 54, paddingBottom: 24 },
  title: { color: "#F1F5F9", fontSize: 26, fontWeight: "800" },
  subtitle: { color: "#475569", fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  cardLabel: {
    color: "#64748B",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 140,
    gap: 6,
  },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  barValue: { fontSize: 9 },
  bar: { width: "100%", borderRadius: 6, minHeight: 4 },
  barLabel: { fontSize: 11 },
  summaryAmount: {
    color: "#F1F5F9",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 4,
  },
  sectionLabel: {
    color: "#64748B",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  categoryRow: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  categoryName: { color: "#CBD5E1", fontSize: 14 },
  expenseCount: { color: "#334155", fontSize: 11 },
  categoryAmount: { fontSize: 15, fontWeight: "800" },
  percentage: { color: "#334155", fontSize: 10, marginTop: 5 },
  emptyCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  emptyText: { color: "#475569", fontSize: 14 },
});
