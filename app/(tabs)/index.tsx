import { useDashboard } from "@/hooks/use-expenses";
import { Expense } from "@/src/types/database";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
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

// Define a strict type for the grouped data to resolve the "Property does not exist" errors
type GroupedExpense =
  | {
      type: "receipt";
      id: string;
      merchant: string;
      total: number;
      items: Expense[];
      created_at: string;
      category: { name: string; icon: string; color: string } | null;
    }
  | (Expense & { type: "single" });

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
  const isOver = value > max;
  const activeColor = isOver ? "#F87171" : color;

  return (
    <View style={styles.progressContainer}>
      <View
        style={[styles.progressTrack, { backgroundColor: `${activeColor}20` }]}
      >
        <View
          style={[
            styles.progressFill,
            { width: `${pct}%`, backgroundColor: activeColor },
          ]}
        >
          <LinearGradient
            colors={["transparent", "rgba(255,255,255,0.2)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useDashboard();

  const now = new Date();
  const year = now.getFullYear();
  const monthName = now.toLocaleString("default", { month: "long" });

  const latestGroups = useMemo(() => {
    if (!data?.recentExpenses) return [];

    const receiptMap: Record<string, Expense[]> = {};
    const standalone: (Expense & { type: "single" })[] = [];

    data.recentExpenses.forEach((exp: Expense) => {
      if (exp.receipt_id) {
        if (!receiptMap[exp.receipt_id]) receiptMap[exp.receipt_id] = [];
        receiptMap[exp.receipt_id].push(exp);
      } else {
        standalone.push({ ...exp, type: "single" });
      }
    });

    const combined: GroupedExpense[] = [
      ...Object.entries(receiptMap).map(
        ([id, group]): GroupedExpense => ({
          type: "receipt",
          id,
          merchant: group[0].merchant,
          total: group.reduce((sum, i) => sum + Number(i.amount), 0),
          items: group,
          created_at: group[0].created_at ?? new Date().toISOString(),
          category: (group[0] as any).categories,
        }),
      ),
      ...standalone,
    ];

    return combined
      .sort(
        (a, b) =>
          new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime(),
      )
      .slice(0, 5);
  }, [data?.recentExpenses]);

  if (isLoading)
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#4ADE80" size="large" />
      </View>
    );

  if (!data) return null;

  const { familyName, memberData, totalBudget, categoryData } = data;
  const totalSpent = categoryData.reduce(
    (sum, c) => sum + Number(c.total_spent),
    0,
  );
  const remaining = totalBudget - totalSpent;

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#4ADE80"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>
              {monthName} {year}
            </Text>
            <Text style={styles.headerTitle}>{familyName}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/settings")}
            style={styles.avatarStack}
          >
            {memberData.slice(0, 3).map((m, i) => (
              <View
                key={m.user_id}
                style={[
                  styles.miniAvatar,
                  {
                    backgroundColor: m.avatar_color ?? "#4ADE80",
                    marginLeft: i === 0 ? 0 : -12,
                    zIndex: 10 - i,
                  },
                ]}
              >
                <Text style={styles.miniAvatarText}>
                  {(m.display_name ?? "U")[0]}
                </Text>
              </View>
            ))}
          </TouchableOpacity>
        </View>

        {/* Hero Card */}
        <LinearGradient colors={["#1E293B", "#0F172A"]} style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroLabel}>MONTHLY SPENDING</Text>
              <Text style={styles.heroAmount}>
                RM{" "}
                {totalSpent.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: remaining < 0 ? "#FEF2F2" : "#ECFDF5" },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: remaining < 0 ? "#EF4444" : "#10B981" },
                ]}
              >
                {remaining < 0 ? "Over" : "On Track"}
              </Text>
            </View>
          </View>
          <ProgressBar value={totalSpent} max={totalBudget} color="#4ADE80" />
          <View style={styles.heroFooter}>
            <Text style={styles.heroFooterText}>Budget: RM {totalBudget}</Text>
            <Text
              style={[
                styles.heroFooterText,
                { color: remaining < 0 ? "#F87171" : "#94A3B8" },
              ]}
            >
              {remaining < 0 ? "Deficit" : "Remaining"}: RM{" "}
              {Math.abs(remaining).toFixed(0)}
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push("/(tabs)/add")}
          >
            <Text style={styles.actionBtnIcon}>➕</Text>
            <Text style={styles.actionBtnText}>Add Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push("/(tabs)/expenses")}
          >
            <Text style={styles.actionBtnIcon}>📜</Text>
            <Text style={styles.actionBtnText}>History</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/expenses")}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        {latestGroups.map((item) => {
          if (item.type === "receipt") {
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.receiptGroupCard}
                onPress={() => router.push("/(tabs)/expenses")}
              >
                <View style={styles.receiptHeader}>
                  <View
                    style={[
                      styles.receiptIcon,
                      {
                        backgroundColor:
                          (item.category?.color ?? "#4ADE80") + "15",
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 20 }}>
                      {item.category?.icon ?? "🧾"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.merchant}>{item.merchant}</Text>
                    <Text style={styles.itemCount}>
                      {item.items.length} items
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.groupAmount}>
                      RM {item.total.toFixed(2)}
                    </Text>
                    <Text style={styles.timeText}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }

          // item.type is "single" - TypeScript now knows 'notes' and 'amount' exist
          const cat = (item as any).categories;
          return (
            <TouchableOpacity key={item.id} style={styles.expenseRow}>
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
                <Text style={styles.noteText} numberOfLines={1}>
                  {item.notes || "No description"}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.amount}>
                  RM {Number(item.amount).toFixed(2)}
                </Text>
                <Text style={styles.timeText}>
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  centered: {
    flex: 1,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    marginBottom: 25,
  },
  headerSub: { color: "#94A3B8", fontSize: 13, fontWeight: "600" },
  headerTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "800" },
  avatarStack: { flexDirection: "row" },
  miniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  miniAvatarText: { color: "#FFF", fontSize: 12, fontWeight: "bold" },
  heroCard: {
    padding: 24,
    borderRadius: 32,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  heroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  heroLabel: { color: "#94A3B8", fontSize: 11, fontWeight: "700" },
  heroAmount: { color: "#FFF", fontSize: 34, fontWeight: "900" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: "800" },
  heroFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  heroFooterText: { color: "#64748B", fontSize: 12 },
  progressContainer: { height: 10, width: "100%", marginTop: 10 },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  quickActions: { flexDirection: "row", gap: 12, marginBottom: 30 },
  actionBtn: {
    flex: 1,
    backgroundColor: "#1E293B",
    padding: 16,
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  actionBtnText: { color: "#E2E8F0", fontWeight: "700" },
  actionBtnIcon: { fontSize: 16 },
  sectionTitle: { color: "#FFF", fontSize: 18, fontWeight: "700" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  seeAll: { color: "#4ADE80", fontSize: 14, fontWeight: "600" },
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
  noteText: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
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
});
