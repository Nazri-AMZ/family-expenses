import { useExpenses } from "@/hooks/use-expenses";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import type { Expense } from "../../src/types/database";

// Enable LayoutAnimation for Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ExpensesScreen() {
  const router = useRouter();
  const {
    data: expenses = [],
    isLoading,
    isRefetching,
    refetch,
  } = useExpenses();

  // Track expanded receipt IDs
  const [expandedReceipts, setExpandedReceipts] = useState<
    Record<string, boolean>
  >({});

  const toggleReceipt = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedReceipts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const sections = useMemo(() => {
    const dateGroups = expenses.reduce<Record<string, Expense[]>>(
      (acc, exp) => {
        const key = exp.expense_date;
        if (!acc[key]) acc[key] = [];
        acc[key].push(exp);
        return acc;
      },
      {},
    );

    return Object.entries(dateGroups).map(([date, items]) => {
      const receiptMap: Record<string, Expense[]> = {};
      const standalone: any[] = [];

      items.forEach((item) => {
        if (item.receipt_id) {
          if (!receiptMap[item.receipt_id]) receiptMap[item.receipt_id] = [];
          receiptMap[item.receipt_id].push(item);
        } else {
          standalone.push({ ...item, type: "single" });
        }
      });

      const groupedData = [
        ...Object.entries(receiptMap).map(([id, group]) => ({
          type: "receipt",
          id,
          merchant: group[0].merchant,
          total: group.reduce((sum, i) => sum + Number(i.amount), 0),
          items: group,
          created_at: group[0].created_at,
          category: (group[0] as any).categories,
        })),
        ...standalone,
      ];

      groupedData.sort(
        (a, b) =>
          new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime(),
      );

      return { title: date, data: groupedData };
    });
  }, [expenses]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#4ADE80" size="large" />
      </View>
    );
  }

  const renderItem = ({ item }: { item: any }) => {
    if (item.type === "receipt") {
      const isExpanded = !!expandedReceipts[item.id];

      return (
        <View style={styles.receiptGroupCard}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => toggleReceipt(item.id)}
            style={styles.receiptHeader}
          >
            <View
              style={[
                styles.receiptIcon,
                { backgroundColor: (item.category?.color ?? "#4ADE80") + "15" },
              ]}
            >
              <Text style={{ fontSize: 20 }}>
                {item.category?.icon ?? "🧾"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.merchant}>{item.merchant}</Text>
              <Text style={styles.itemCount}>
                {item.items.length} items {isExpanded ? "▴" : "▾"}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.groupAmount}>RM {item.total.toFixed(2)}</Text>
              <Text style={styles.timeText}>
                {new Date(item.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </TouchableOpacity>

          {isExpanded && (
            <View>
              <View style={styles.receiptDivider} />
              {item.items.map((subItem: Expense) => (
                <View key={subItem.id} style={styles.subItemRow}>
                  <Text style={styles.subItemName} numberOfLines={1}>
                    • {subItem.notes || "Item"}
                  </Text>
                  <Text style={styles.subItemAmount}>
                    RM {Number(subItem.amount).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      );
    }

    const cat = item.categories;
    return (
      <TouchableOpacity activeOpacity={0.7} style={styles.expenseRow}>
        <View
          style={[
            styles.expenseIcon,
            { backgroundColor: (cat?.color ?? "#94A3B8") + "15" },
          ]}
        >
          <Text style={{ fontSize: 20 }}>{cat?.icon ?? "📦"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.merchant}>{item.merchant}</Text>
          {/* Item Note / Description */}
          <Text style={styles.noteText} numberOfLines={1}>
            {item.notes || "No description"}
          </Text>
          <Text
            style={[styles.categoryText, { color: cat?.color ?? "#94A3B8" }]}
          >
            {cat?.name ?? "Uncategorized"}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.amount}>RM {Number(item.amount).toFixed(2)}</Text>
          <Text style={styles.timeText}>
            {new Date(item.created_at ?? "").toLocaleTimeString([], {
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
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => item.id || `index-${index}`}
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
  sectionHeader: {
    backgroundColor: "#0F172A",
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
  headerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.05)" },

  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1E293B",
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
  },
  expenseIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  merchant: { color: "#F1F5F9", fontSize: 16, fontWeight: "700" },
  categoryText: {
    fontSize: 11, // Slightly smaller since we now have 3 lines
    fontWeight: "600",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  amount: { color: "#F1F5F9", fontSize: 16, fontWeight: "800" },
  timeText: { color: "#475569", fontSize: 11, marginTop: 4 },

  receiptGroupCard: {
    backgroundColor: "#1E293B",
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.15)",
  },
  receiptHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  receiptIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  itemCount: { color: "#64748B", fontSize: 12, marginTop: 2 },
  groupAmount: { color: "#4ADE80", fontSize: 18, fontWeight: "800" },
  receiptDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginVertical: 12,
  },
  subItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  subItemName: { color: "#94A3B8", fontSize: 13, flex: 1 },
  subItemAmount: { color: "#CBD5E1", fontSize: 13, fontWeight: "500" },

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
  },
  noteText: {
    color: "#94A3B8", // Subtle gray
    fontSize: 13,
    marginTop: 2,
  },
});
