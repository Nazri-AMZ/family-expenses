import { useDashboard } from "@/hooks/use-expenses";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
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

const { width } = Dimensions.get("window");

// Improved Progress Bar with "Glow" effect
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

  if (isLoading)
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#4ADE80" size="large" />
      </View>
    );

  if (!data)
    return (
      <View style={styles.centered}>
        <View style={styles.illustrationCircle}>
          <Text style={{ fontSize: 40 }}>🏠</Text>
        </View>
        <Text style={styles.welcomeTitle}>Start Your Journey</Text>
        <Text style={styles.welcomeSub}>
          Manage shared expenses with your family or roommates seamlessly.
        </Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push("/(tabs)/settings")}
        >
          <Text style={styles.primaryBtnText}>Create or Join a Family</Text>
        </TouchableOpacity>
      </View>
    );

  const { familyName, categoryData, memberData, recentExpenses, totalBudget } =
    data;
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
        {/* Header Section */}
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

        {/* Hero Budget Card */}
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

        {/* Quick Actions */}
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
            onPress={() => router.push("/(tabs)/reports")}
          >
            <Text style={styles.actionBtnIcon}>📊</Text>
            <Text style={styles.actionBtnText}>Reports</Text>
          </TouchableOpacity>
        </View>

        {/* Horizontal Members Section */}
        <Text style={styles.sectionTitle}>Family Members</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.memberList}
        >
          {memberData.map((m) => (
            <View key={m.user_id} style={styles.memberCard}>
              <View
                style={[
                  styles.memberIcon,
                  { borderColor: m.avatar_color ?? "#4ADE80" },
                ]}
              >
                <Text
                  style={{
                    color: m.avatar_color ?? "#4ADE80",
                    fontWeight: "bold",
                  }}
                >
                  {(m.display_name ?? "U")[0]}
                </Text>
              </View>
              <Text style={styles.memberName} numberOfLines={1}>
                {m.display_name}
              </Text>
              <Text style={styles.memberSpent}>
                RM{Number(m.total_spent).toFixed(0)}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Recent Expenses List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        {recentExpenses.length === 0 ? (
          <View style={styles.emptyRecent}>
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        ) : (
          recentExpenses.map((exp) => (
            <TouchableOpacity key={exp.id} style={styles.transactionItem}>
              <View style={styles.transIconBox}>
                <Text style={{ fontSize: 20 }}>
                  {(exp as any).categories?.icon ?? "💰"}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.transMerchant}>{exp.merchant}</Text>
                <Text style={styles.transDate}>
                  {new Date(exp.expense_date).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.transAmount}>
                - RM {Number(exp.amount).toFixed(2)}
              </Text>
            </TouchableOpacity>
          ))
        )}
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
    padding: 40,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    marginBottom: 25,
  },
  headerSub: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  headerTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "800" },

  // Avatar Stack
  avatarStack: { flexDirection: "row", alignItems: "center" },
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

  // Hero Card
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
    alignItems: "flex-start",
    marginBottom: 20,
  },
  heroLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  heroAmount: { color: "#FFF", fontSize: 34, fontWeight: "900", marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  heroFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  heroFooterText: { color: "#64748B", fontSize: 12, fontWeight: "600" },

  // Progress Bar
  progressContainer: { height: 10, width: "100%", marginTop: 10 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    width: "100%",
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 4 },

  // Actions
  quickActions: { flexDirection: "row", gap: 12, marginBottom: 30 },
  actionBtn: {
    flex: 1,
    backgroundColor: "#1E293B",
    padding: 16,
    borderRadius: 20,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  actionBtnText: { color: "#E2E8F0", fontWeight: "700", fontSize: 14 },
  actionBtnIcon: { fontSize: 16 },

  // Members
  sectionTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 15,
  },
  seeAll: { color: "#4ADE80", fontSize: 14, fontWeight: "600" },
  memberList: { marginBottom: 30, paddingLeft: 2 },
  memberCard: {
    width: 100,
    backgroundColor: "#1E293B",
    padding: 15,
    borderRadius: 24,
    alignItems: "center",
    marginRight: 12,
  },
  memberIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  memberName: { color: "#94A3B8", fontSize: 12, fontWeight: "600" },
  memberSpent: { color: "#FFF", fontSize: 14, fontWeight: "700", marginTop: 2 },

  // Transactions
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    padding: 16,
    borderRadius: 24,
    marginBottom: 12,
  },
  transIconBox: {
    width: 48,
    height: 48,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  transMerchant: { color: "#F1F5F9", fontSize: 15, fontWeight: "700" },
  transDate: { color: "#64748B", fontSize: 12, marginTop: 2 },
  transAmount: { color: "#FFF", fontSize: 16, fontWeight: "800" },

  emptyRecent: {
    backgroundColor: "#1E293B",
    borderRadius: 24,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  emptyText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "500",
  },

  // Welcome State
  illustrationCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  welcomeTitle: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 10,
    textAlign: "center",
  },
  welcomeSub: {
    color: "#64748B",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: "#4ADE80",
    paddingHorizontal: 30,
    paddingVertical: 16,
    borderRadius: 20,
  },
  primaryBtnText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
});
