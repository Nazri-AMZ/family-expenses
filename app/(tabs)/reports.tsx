import { useActiveFamily } from "@/hooks/use-active-family";
import { useReports } from "@/hooks/use-expenses";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../src/lib/supabase";
import type { MonthlyCategorySummary } from "../../src/types/database";

const { width } = Dimensions.get("window");

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
    <View style={styles.progressContainer}>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${pct}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

const months = Array.from({ length: 6 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - i);
  return {
    label: d.toLocaleString("default", { month: "short" }),
    month: d.getMonth() + 1,
    year: d.getFullYear(),
  };
}).reverse();

export default function ReportsScreen() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { data: familyId } = useActiveFamily();

  const { data, isLoading, isRefetching, refetch } = useReports(
    selectedMonth,
    selectedYear,
  );
  const categoryData: MonthlyCategorySummary[] = data?.categoryData ?? [];

  const { data: monthlyTotals = [] } = useQuery({
    queryKey: [familyId, "monthlyTotals"],
    enabled: !!familyId,
    queryFn: async () => {
      const results = await Promise.all(
        months.map(async (m) => {
          const { data } = await supabase
            .from("monthly_category_summary")
            .select("total_spent")
            .eq("family_id", familyId!)
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
      return results;
    },
  });

  const maxMonthly = Math.max(...monthlyTotals.map((m) => m.total), 1);
  const totalSpent = categoryData.reduce(
    (sum, c) => sum + Number(c.total_spent),
    0,
  );

  if (isLoading)
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#4ADE80" size="large" />
      </View>
    );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor="#4ADE80"
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.subtitle}>Track your family spending patterns</Text>
      </View>

      {/* Chart Card */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.cardLabel}>Spending Trend</Text>
          <Text style={styles.chartLegend}>Last 6 Months</Text>
        </View>

        <View style={styles.barChartContainer}>
          {monthlyTotals.map((m) => {
            const isCurrent =
              m.month === selectedMonth && m.year === selectedYear;
            const barHeight = (m.total / maxMonthly) * 100;

            return (
              <TouchableOpacity
                key={`${m.month}-${m.year}`}
                style={styles.barWrapper}
                onPress={() => {
                  setSelectedMonth(m.month);
                  setSelectedYear(m.year);
                }}
              >
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${Math.max(barHeight, 5)}%`,
                        backgroundColor: isCurrent ? "#4ADE80" : "#334155",
                      },
                    ]}
                  >
                    {isCurrent && (
                      <LinearGradient
                        colors={["#4ADE80", "#2DD4BF"]}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                  </View>
                </View>
                <Text
                  style={[
                    styles.barLabel,
                    {
                      color: isCurrent ? "#F1F5F9" : "#64748B",
                      fontWeight: isCurrent ? "700" : "400",
                    },
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Stats Overview */}
      <View style={styles.statsRow}>
        <LinearGradient
          colors={["#1E293B", "#1E293B"]}
          style={styles.smallStatCard}
        >
          <Text style={styles.statLabel}>TOTAL SPENT</Text>
          <Text style={styles.statValue}>
            RM{" "}
            {totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </Text>
        </LinearGradient>
        <LinearGradient
          colors={["#1E293B", "#1E293B"]}
          style={styles.smallStatCard}
        >
          <Text style={styles.statLabel}>AVG / ITEM</Text>
          <Text style={styles.statValue}>
            RM{" "}
            {categoryData.length > 0
              ? (
                  totalSpent /
                  categoryData.reduce((s, c) => s + c.expense_count, 0)
                ).toFixed(0)
              : 0}
          </Text>
        </LinearGradient>
      </View>

      {/* Category List */}
      <Text style={styles.sectionTitle}>Category Breakdown</Text>
      {categoryData.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No data available for this period
          </Text>
        </View>
      ) : (
        categoryData
          .sort((a, b) => Number(b.total_spent) - Number(a.total_spent))
          .map((cat) => {
            const percentage = Math.round(
              (Number(cat.total_spent) / totalSpent) * 100,
            );
            return (
              <View key={cat.category_id} style={styles.catItem}>
                <View style={styles.catHeader}>
                  <View style={styles.catInfo}>
                    <View
                      style={[
                        styles.iconBg,
                        { backgroundColor: `${cat.category_color}15` },
                      ]}
                    >
                      <Text style={{ fontSize: 18 }}>{cat.category_icon}</Text>
                    </View>
                    <View>
                      <Text style={styles.catName}>{cat.category_name}</Text>
                      <Text style={styles.catMeta}>
                        {cat.expense_count} transactions
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={[styles.catAmount, { color: cat.category_color }]}
                    >
                      RM {Number(cat.total_spent).toFixed(2)}
                    </Text>
                    <Text style={styles.catPercentage}>{percentage}%</Text>
                  </View>
                </View>
                <ProgressBar
                  value={Number(cat.total_spent)}
                  max={totalSpent}
                  color={cat.category_color}
                />
              </View>
            );
          })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", paddingHorizontal: 20 },
  centered: {
    flex: 1,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },

  header: { paddingTop: 60, paddingBottom: 25 },
  title: { color: "#FFF", fontSize: 28, fontWeight: "800" },
  subtitle: { color: "#64748B", fontSize: 14, marginTop: 4 },

  // Chart Card
  chartCard: {
    backgroundColor: "#1E293B",
    borderRadius: 32,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  cardLabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  chartLegend: { color: "#475569", fontSize: 12 },
  barChartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    height: 160,
    alignItems: "flex-end",
  },
  barWrapper: { alignItems: "center", flex: 1 },
  barTrack: {
    width: 12,
    height: 120,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    justifyContent: "flex-end",
    overflow: "hidden",
    marginBottom: 12,
  },
  barFill: { width: "100%", borderRadius: 10 },
  barLabel: { fontSize: 11, textTransform: "uppercase" },

  // Stats Row
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 30 },
  smallStatCard: {
    flex: 1,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  statLabel: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  statValue: { color: "#FFF", fontSize: 18, fontWeight: "800", marginTop: 4 },

  // Category List
  sectionTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  catItem: {
    backgroundColor: "#1E293B",
    padding: 16,
    borderRadius: 24,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  catHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  catInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  catName: { color: "#F1F5F9", fontSize: 15, fontWeight: "700" },
  catMeta: { color: "#475569", fontSize: 12, marginTop: 2 },
  catAmount: { fontSize: 16, fontWeight: "800" },
  catPercentage: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },

  // Progress Bar
  progressContainer: { height: 6, width: "100%" },
  progressTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },

  emptyState: {
    padding: 40,
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderRadius: 24,
  },
  emptyText: { color: "#475569", fontSize: 14 },
});
