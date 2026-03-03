import { useExpenses } from "@/hooks/use-expenses";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Expense } from "../../src/types/database";

export default function ExpensesScreen() {
  const router = useRouter();
  const {
    data: expenses = [],
    isLoading,
    isRefetching,
    refetch,
  } = useExpenses();

  // Format data for SectionList
  const grouped = expenses.reduce<Record<string, Expense[]>>((acc, exp) => {
    const key = exp.expense_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(exp);
    return acc;
  }, {});

  const sections = Object.entries(grouped).map(([date, items]) => ({
    title: date,
    data: items,
  }));

  if (isLoading)
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#4ADE80" size="large" />
      </View>
    );

  const renderItem = ({ item: exp }: { item: Expense }) => {
    const cat = (exp as any).categories;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.expenseRow}
        onPress={() => {
          /* Handle Edit/Detail view if you have one */
        }}
      >
        <View
          style={[
            styles.expenseIcon,
            { backgroundColor: (cat?.color ?? "#94A3B8") + "15" },
          ]}
        >
          <Text style={{ fontSize: 20 }}>{cat?.icon ?? "📦"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.merchant}>{exp.merchant}</Text>
          <View style={styles.categoryBadge}>
            <Text
              style={[styles.categoryText, { color: cat?.color ?? "#94A3B8" }]}
            >
              {cat?.name ?? "Uncategorized"}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.amount}>RM {Number(exp.amount).toFixed(2)}</Text>
          <Text style={styles.timeText}>
            {new Date(exp.created_at ?? "").toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({
    section: { title },
  }: {
    section: { title: string };
  }) => {
    const date = new Date(title);
    const isToday = new Date().toDateString() === date.toDateString();

    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.dateLabel}>
          {isToday
            ? "Today"
            : date.toLocaleDateString("en-MY", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
        </Text>
        <View style={styles.headerLine} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>
            {expenses.length} transactions this month
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push("/(tabs)/add")}
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {expenses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Text style={{ fontSize: 40 }}>🧾</Text>
          </View>
          <Text style={styles.emptyTitle}>No transactions</Text>
          <Text style={styles.emptySub}>
            Start tracking your spending by adding your first expense.
          </Text>
          <TouchableOpacity
            style={styles.addFirstBtn}
            onPress={() => router.push("/(tabs)/add")}
          >
            <Text style={styles.addBtnText}>Add First Expense</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={true}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#4ADE80"
            />
          }
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: {
    flex: 1,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: { color: "#F1F5F9", fontSize: 32, fontWeight: "800" },
  subtitle: { color: "#475569", fontSize: 13, marginTop: 2 },
  addBtn: {
    backgroundColor: "#4ADE80",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  addBtnText: { color: "#0F172A", fontWeight: "800", fontSize: 14 },

  // Section Header
  sectionHeader: {
    backgroundColor: "#0F172A", // Matches container to blend when sticky
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dateLabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  // Rows
  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1E293B",
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
  },
  expenseIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  merchant: { color: "#F1F5F9", fontSize: 16, fontWeight: "700" },
  categoryBadge: {
    marginTop: 4,
    alignSelf: "flex-start",
  },
  categoryText: { fontSize: 12, fontWeight: "600" },
  amount: { color: "#F1F5F9", fontSize: 16, fontWeight: "800" },
  timeText: { color: "#475569", fontSize: 11, marginTop: 4 },

  // Empty State
  emptyContainer: {
    flex: 0.8,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    color: "#F1F5F9",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptySub: {
    color: "#475569",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  addFirstBtn: {
    backgroundColor: "#4ADE80",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
});
