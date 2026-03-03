import { useDashboard } from "@/hooks/use-expenses";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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
  return (
    <View
      style={{
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 99,
        height: 6,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 99,
          backgroundColor: isOver ? "#F87171" : color,
        }}
      />
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
        <Text style={styles.emptyText}>You're not part of a family yet.</Text>
        <TouchableOpacity
          style={styles.greenBtn}
          onPress={() => router.push("/(tabs)/settings")}
        >
          <Text style={styles.greenBtnText}>Create or Join a Family</Text>
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
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
        <View style={{ flexDirection: "row", gap: 8 }}>
          {memberData.slice(0, 3).map((m) => (
            <View
              key={m.user_id}
              style={[
                styles.avatar,
                {
                  backgroundColor: (m.avatar_color ?? "#4ADE80") + "33",
                  borderColor: m.avatar_color ?? "#4ADE80",
                },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  { color: m.avatar_color ?? "#4ADE80" },
                ]}
              >
                {(m.display_name ?? "U")[0].toUpperCase()}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Budget Card */}
      <View style={styles.budgetCard}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <View>
            <Text style={styles.cardLabel}>Total Spent</Text>
            <Text style={styles.bigAmount}>
              RM{" "}
              <Text style={{ color: "#4ADE80" }}>{totalSpent.toFixed(2)}</Text>
            </Text>
            <Text style={styles.cardSub}>
              of RM {totalBudget.toFixed(2)} budget
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.cardLabel}>Remaining</Text>
            <Text
              style={[
                styles.bigAmount,
                { fontSize: 24, color: remaining >= 0 ? "#4ADE80" : "#F87171" },
              ]}
            >
              RM {Math.abs(remaining).toFixed(2)}
            </Text>
            <Text style={styles.cardSub}>
              {remaining < 0
                ? "⚠️ Over budget"
                : `${totalBudget > 0 ? Math.round((remaining / totalBudget) * 100) : 0}% left`}
            </Text>
          </View>
        </View>
        {totalBudget > 0 && (
          <ProgressBar value={totalSpent} max={totalBudget} color="#4ADE80" />
        )}
      </View>

      {/* Members */}
      {memberData.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.sectionLabel}>By Member</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {memberData.map((m) => (
              <View
                key={m.user_id}
                style={[
                  styles.memberCard,
                  { borderColor: (m.avatar_color ?? "#4ADE80") + "33" },
                ]}
              >
                <View
                  style={[
                    styles.avatar,
                    {
                      marginBottom: 8,
                      backgroundColor: (m.avatar_color ?? "#4ADE80") + "22",
                      borderColor: m.avatar_color ?? "#4ADE80",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarText,
                      { color: m.avatar_color ?? "#4ADE80" },
                    ]}
                  >
                    {(m.display_name ?? "U")[0].toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.memberName}>
                  {m.display_name ?? "Member"}
                </Text>
                <Text
                  style={[
                    styles.memberAmount,
                    { color: m.avatar_color ?? "#4ADE80" },
                  ]}
                >
                  RM {Number(m.total_spent).toFixed(0)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Categories */}
      {categoryData.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.sectionLabel}>Categories</Text>
          <View style={styles.categoryGrid}>
            {categoryData.map((cat) => (
              <View key={cat.category_id} style={styles.categoryCard}>
                <Text style={{ fontSize: 28, marginBottom: 8 }}>
                  {cat.category_icon}
                </Text>
                <Text style={styles.categoryName}>{cat.category_name}</Text>
                <Text
                  style={[styles.categoryAmount, { color: cat.category_color }]}
                >
                  RM {Number(cat.total_spent).toFixed(0)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Recent Expenses */}
      <Text style={styles.sectionLabel}>Recent Expenses</Text>
      {recentExpenses.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No expenses yet this month</Text>
          <TouchableOpacity
            style={[styles.greenBtn, { marginTop: 12 }]}
            onPress={() => router.push("/(tabs)/add")}
          >
            <Text style={styles.greenBtnText}>Add First Expense</Text>
          </TouchableOpacity>
        </View>
      ) : (
        recentExpenses.map((exp) => {
          const cat = (exp as any).categories;
          return (
            <View key={exp.id} style={styles.expenseRow}>
              <View
                style={[
                  styles.expenseIcon,
                  { backgroundColor: (cat?.color ?? "#94A3B8") + "18" },
                ]}
              >
                <Text style={{ fontSize: 20 }}>{cat?.icon ?? "📦"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.expenseMerchant}>{exp.merchant}</Text>
                <Text style={styles.expenseDate}>
                  {new Date(exp.expense_date).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.expenseAmount}>
                RM {Number(exp.amount).toFixed(2)}
              </Text>
            </View>
          );
        })
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
    padding: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: 54,
    paddingBottom: 24,
  },
  headerSub: {
    color: "#64748B",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headerTitle: {
    color: "#F1F5F9",
    fontSize: 26,
    fontWeight: "800",
    marginTop: 4,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 13, fontWeight: "700" },
  budgetCard: {
    backgroundColor: "#1E293B",
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  cardLabel: {
    color: "#64748B",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  bigAmount: { color: "#F1F5F9", fontSize: 32, fontWeight: "800" },
  cardSub: { color: "#475569", fontSize: 12, marginTop: 4 },
  sectionLabel: {
    color: "#64748B",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  memberCard: {
    flex: 1,
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  memberName: { color: "#94A3B8", fontSize: 11, marginBottom: 4 },
  memberAmount: { fontSize: 15, fontWeight: "700" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  categoryCard: {
    width: "47%",
    backgroundColor: "#1E293B",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  categoryName: { color: "#94A3B8", fontSize: 11, marginBottom: 4 },
  categoryAmount: { fontSize: 17, fontWeight: "800" },
  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  expenseIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  expenseMerchant: { color: "#E2E8F0", fontSize: 14, fontWeight: "600" },
  expenseDate: { color: "#475569", fontSize: 11, marginTop: 2 },
  expenseAmount: { color: "#F1F5F9", fontSize: 15, fontWeight: "800" },
  emptyCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  emptyText: { color: "#475569", fontSize: 14 },
  greenBtn: {
    backgroundColor: "#4ADE80",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  greenBtnText: { color: "#0F172A", fontWeight: "700", fontSize: 14 },
});
