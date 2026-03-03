import { useAuthStore } from "@/src/store/useAuthStore";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../src/lib/supabase";
import type { Expense } from "../../src/types/database";

export default function ExpensesScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);

  const fetchExpenses = async () => {
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

    const { data } = await supabase
      .from("expenses")
      .select("*, categories(name, icon, color)")
      .eq("family_id", memberRow.family_id)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    setExpenses(data ?? []);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchExpenses();
  }, [user]);

  // Group by date
  const grouped = expenses.reduce<Record<string, Expense[]>>((acc, exp) => {
    const key = exp.expense_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(exp);
    return acc;
  }, {});

  const sections = Object.entries(grouped).map(([date, items]) => ({
    date,
    items,
  }));

  if (loading)
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#4ADE80" size="large" />
      </View>
    );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>All Expenses</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push("/(tabs)/add")}
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {expenses.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🧾</Text>
          <Text style={styles.emptyText}>No expenses yet</Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item) => item.date}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchExpenses();
              }}
              tintColor="#4ADE80"
            />
          }
          contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 20 }}
          renderItem={({ item: section }) => (
            <View style={{ marginBottom: 20 }}>
              <Text style={styles.dateLabel}>
                {new Date(section.date).toLocaleDateString("en-MY", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </Text>
              {section.items.map((exp) => {
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
                      <Text style={styles.merchant}>{exp.merchant}</Text>
                      <Text style={styles.category}>
                        {cat?.name ?? "Uncategorized"}
                      </Text>
                    </View>
                    <Text style={styles.amount}>
                      RM {Number(exp.amount).toFixed(2)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
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
    alignItems: "center",
    padding: 20,
    paddingTop: 54,
  },
  title: { color: "#F1F5F9", fontSize: 26, fontWeight: "800" },
  addBtn: {
    backgroundColor: "#4ADE80",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  addBtnText: { color: "#0F172A", fontWeight: "700", fontSize: 14 },
  dateLabel: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
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
  merchant: { color: "#E2E8F0", fontSize: 14, fontWeight: "600" },
  category: { color: "#475569", fontSize: 11, marginTop: 2 },
  amount: { color: "#F1F5F9", fontSize: 15, fontWeight: "800" },
  emptyText: { color: "#475569", fontSize: 16 },
});
