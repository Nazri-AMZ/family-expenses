import { useInvalidateFamily } from "@/hooks/use-invalidate-family";
import { useAuthStore } from "@/src/store/useAuthStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../src/lib/supabase";
import type { Family, FamilyMember } from "../../src/types/database";

const ACTIVE_FAMILY_KEY = "active_family_id";

type FamilyWithMembers = Family & { members: FamilyMember[] };

export default function SettingsScreen() {
  const { user, signOut } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [families, setFamilies] = useState<FamilyWithMembers[]>([]);
  const [activeFamilyId, setActiveFamilyId] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const invalidateFamily = useInvalidateFamily();

  useEffect(() => {
    loadFamilies();
  }, [user]);

  const loadFamilies = async () => {
    if (!user) return;

    const savedActiveId = await AsyncStorage.getItem(ACTIVE_FAMILY_KEY);

    const { data: memberRows } = await supabase
      .from("family_members")
      .select("family_id, families(*)")
      .eq("user_id", user.id);

    if (!memberRows || memberRows.length === 0) {
      setLoading(false);
      return;
    }

    const familiesWithMembers: FamilyWithMembers[] = await Promise.all(
      memberRows.map(async (row) => {
        const fam = row.families as any as Family;
        const { data: members } = await supabase
          .from("family_members")
          .select("*")
          .eq("family_id", fam.id);

        return { ...fam, members: members ?? [] };
      }),
    );

    setFamilies(familiesWithMembers);

    const activeId = savedActiveId ?? familiesWithMembers[0]?.id ?? null;
    setActiveFamilyId(activeId);
    if (!savedActiveId && activeId) {
      await AsyncStorage.setItem(ACTIVE_FAMILY_KEY, activeId);
    }

    setLoading(false);
  };

  const switchFamily = async (familyId: string) => {
    setActiveFamilyId(familyId);
    await AsyncStorage.setItem(ACTIVE_FAMILY_KEY, familyId);
    invalidateFamily(familyId);
    Alert.alert(
      "Switched!",
      `Now viewing ${families.find((f) => f.id === familyId)?.name}`,
    );
  };

  const createFamily = async () => {
    if (!familyName.trim()) return Alert.alert("Enter a family name");
    setCreating(true);

    const { data: newFamily, error } = await supabase
      .from("families")
      .insert({ name: familyName.trim(), created_by: user!.id })
      .select()
      .single();

    invalidateFamily(newFamily.id);

    if (error || !newFamily) {
      Alert.alert("Error", error?.message ?? "Could not create family");
      setCreating(false);
      return;
    }

    await supabase.from("family_members").insert({
      family_id: newFamily.id,
      user_id: user!.id,
      role: "owner",
      display_name: user!.user_metadata?.display_name ?? user!.email,
    });

    await AsyncStorage.setItem(ACTIVE_FAMILY_KEY, newFamily.id);
    setActiveFamilyId(newFamily.id);
    setFamilyName("");
    setShowCreate(false);
    setCreating(false);
    loadFamilies();
  };

  const joinFamily = async () => {
    if (!inviteCode.trim()) return Alert.alert("Enter an invite code");
    setJoining(true);

    const { data: targetFamily } = await supabase
      .from("families")
      .select("id, name")
      .eq("invite_code", inviteCode.trim().toUpperCase())
      .single();

    if (!targetFamily) {
      Alert.alert("Invalid Code", "No family found with that invite code.");
      setJoining(false);
      return;
    }

    const { data: existing } = await supabase
      .from("family_members")
      .select("id")
      .eq("family_id", targetFamily.id)
      .eq("user_id", user!.id)
      .single();

    if (existing) {
      Alert.alert("Already a member", `You're already in ${targetFamily.name}`);
      setJoining(false);
      return;
    }

    invalidateFamily(targetFamily.id);

    const { error } = await supabase.from("family_members").insert({
      family_id: targetFamily.id,
      user_id: user!.id,
      role: "member",
      display_name: user!.user_metadata?.display_name ?? user!.email,
    });

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      await AsyncStorage.setItem(ACTIVE_FAMILY_KEY, targetFamily.id);
      setActiveFamilyId(targetFamily.id);
      setInviteCode("");
      setShowJoin(false);
      loadFamilies();
      Alert.alert("Joined!", `Welcome to ${targetFamily.name} 🎉`);
    }
    setJoining(false);
  };

  const leaveFamily = async (family: FamilyWithMembers) => {
    const isOwner =
      family.members.find((m) => m.user_id === user?.id)?.role === "owner";
    const isOnlyMember = family.members.length === 1;

    if (isOwner && !isOnlyMember) {
      Alert.alert(
        "Cannot Leave",
        "Transfer ownership to another member before leaving.",
      );
      return;
    }

    Alert.alert(
      "Leave Family",
      `Are you sure you want to leave "${family.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            await supabase
              .from("family_members")
              .delete()
              .eq("family_id", family.id)
              .eq("user_id", user!.id);

            if (activeFamilyId === family.id) {
              const remaining = families.filter((f) => f.id !== family.id);
              const newActive = remaining[0]?.id ?? null;
              setActiveFamilyId(newActive);
              if (newActive)
                await AsyncStorage.setItem(ACTIVE_FAMILY_KEY, newActive);
              else await AsyncStorage.removeItem(ACTIVE_FAMILY_KEY);
            }

            loadFamilies();
          },
        },
      ],
    );
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  };

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
    >
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Section header + action buttons */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>My Families ({families.length})</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={styles.smallBtn}
            onPress={() => {
              setShowJoin(!showJoin);
              setShowCreate(false);
            }}
          >
            <Text style={styles.smallBtnText}>Join</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.smallBtn,
              { backgroundColor: "#4ADE80", borderColor: "#4ADE80" },
            ]}
            onPress={() => {
              setShowCreate(!showCreate);
              setShowJoin(false);
            }}
          >
            <Text style={[styles.smallBtnText, { color: "#0F172A" }]}>
              + New
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Create Family Form */}
      {showCreate && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create a New Family</Text>
          <TextInput
            style={styles.input}
            placeholder="Family name (e.g. The Ahmads)"
            placeholderTextColor="#475569"
            value={familyName}
            onChangeText={setFamilyName}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              style={[styles.outlineBtn, { flex: 1 }]}
              onPress={() => setShowCreate(false)}
            >
              <Text style={styles.outlineBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.greenBtn, { flex: 1 }]}
              onPress={createFamily}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.greenBtnText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Join Family Form */}
      {showJoin && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Join a Family</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter invite code"
            placeholderTextColor="#475569"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              style={[styles.outlineBtn, { flex: 1 }]}
              onPress={() => setShowJoin(false)}
            >
              <Text style={styles.outlineBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.greenBtn, { flex: 1 }]}
              onPress={joinFamily}
              disabled={joining}
            >
              {joining ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.greenBtnText}>Join</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Empty state */}
      {families.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>👨‍👩‍👧‍👦</Text>
          <Text style={styles.emptyText}>
            You're not part of any family yet
          </Text>
          <Text style={styles.emptySubText}>
            Create one or join with an invite code
          </Text>
        </View>
      )}

      {/* Family Cards */}
      {families.map((family) => {
        const isActive = family.id === activeFamilyId;
        const userRole = family.members.find(
          (m) => m.user_id === user?.id,
        )?.role;

        return (
          <View
            key={family.id}
            style={[styles.familyCard, isActive && styles.familyCardActive]}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <Text style={styles.familyName}>{family.name}</Text>
                  {isActive && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>ACTIVE</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.familyRole}>
                  {userRole} · {family.members.length} member
                  {family.members.length !== 1 ? "s" : ""}
                </Text>
              </View>
              {!isActive && (
                <TouchableOpacity
                  style={styles.switchBtn}
                  onPress={() => switchFamily(family.id)}
                >
                  <Text style={styles.switchBtnText}>Switch</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Invite Code */}
            <View style={styles.inviteRow}>
              <Text style={styles.inviteLabel}>Invite Code</Text>
              <Text style={styles.inviteCode}>{family.invite_code}</Text>
            </View>

            {/* Members */}
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 12,
              }}
            >
              {family.members.map((m) => (
                <View key={m.id} style={styles.memberChip}>
                  <View
                    style={[
                      styles.memberDot,
                      { backgroundColor: m.avatar_color ?? "#4ADE80" },
                    ]}
                  />
                  <Text style={styles.memberChipText}>
                    {m.display_name ?? "Member"}
                  </Text>
                  {m.role === "owner" && (
                    <Text style={styles.ownerStar}>★</Text>
                  )}
                </View>
              ))}
            </View>

            {/* Leave */}
            <TouchableOpacity
              style={styles.leaveBtn}
              onPress={() => leaveFamily(family)}
            >
              <Text style={styles.leaveBtnText}>Leave Family</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
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
  email: { color: "#475569", fontSize: 13, marginTop: 4 },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionLabel: {
    color: "#64748B",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  smallBtn: {
    backgroundColor: "#1E293B",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  smallBtnText: { color: "#94A3B8", fontSize: 12, fontWeight: "700" },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  cardTitle: {
    color: "#F1F5F9",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#0F172A",
    borderRadius: 12,
    padding: 14,
    color: "#F1F5F9",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#334155",
  },
  greenBtn: {
    backgroundColor: "#4ADE80",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  greenBtnText: { color: "#0F172A", fontWeight: "700", fontSize: 14 },
  outlineBtn: {
    backgroundColor: "transparent",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  outlineBtnText: { color: "#64748B", fontWeight: "600", fontSize: 14 },
  familyCard: {
    backgroundColor: "#1E293B",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  familyCardActive: { borderColor: "#4ADE8044" },
  familyName: { color: "#F1F5F9", fontSize: 18, fontWeight: "800" },
  familyRole: {
    color: "#475569",
    fontSize: 12,
    marginTop: 2,
    textTransform: "capitalize",
  },
  activeBadge: {
    backgroundColor: "#4ADE8022",
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#4ADE8044",
  },
  activeBadgeText: {
    color: "#4ADE80",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  switchBtn: {
    backgroundColor: "#334155",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  switchBtnText: { color: "#94A3B8", fontSize: 12, fontWeight: "700" },
  inviteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0F172A",
    borderRadius: 10,
    padding: 12,
  },
  inviteLabel: { color: "#475569", fontSize: 12 },
  inviteCode: {
    color: "#4ADE80",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 2,
  },
  memberChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#0F172A",
    borderRadius: 99,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  memberDot: { width: 7, height: 7, borderRadius: 99 },
  memberChipText: { color: "#94A3B8", fontSize: 12 },
  ownerStar: { color: "#FBBF24", fontSize: 10 },
  leaveBtn: {
    marginTop: 12,
    padding: 10,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F8717122",
  },
  leaveBtnText: { color: "#F87171", fontSize: 12, fontWeight: "600" },
  emptyCard: {
    backgroundColor: "#1E293B",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    marginBottom: 16,
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  emptySubText: { color: "#475569", fontSize: 13, textAlign: "center" },
  signOutBtn: {
    backgroundColor: "#F8717122",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#F8717133",
  },
  signOutText: { color: "#F87171", fontWeight: "700", fontSize: 15 },
});
