import { useInvalidateFamily } from "@/hooks/use-active-family";
import { useAuthStore } from "@/src/store/useAuthStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import React, { useEffect, useState } from "react";
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
import Toast from "react-native-toast-message";
import { supabase } from "../../src/lib/supabase";
import type { Family, FamilyMember } from "../../src/types/database";

const ACTIVE_FAMILY_KEY = "active_family_id";
type FamilyWithMembers = Family & { members: FamilyMember[] };

export default function SettingsScreen() {
  const { user, signOut } = useAuthStore();
  const invalidateFamily = useInvalidateFamily();

  const [loading, setLoading] = useState(true);
  const [families, setFamilies] = useState<FamilyWithMembers[]>([]);
  const [activeFamilyId, setActiveFamilyId] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

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
    if (!savedActiveId && activeId)
      await AsyncStorage.setItem(ACTIVE_FAMILY_KEY, activeId);
    setLoading(false);
  };

  const switchFamily = async (familyId: string) => {
    const family = families.find((f) => f.id === familyId);
    setActiveFamilyId(familyId);
    await AsyncStorage.setItem(ACTIVE_FAMILY_KEY, familyId);
    await invalidateFamily(familyId);
    Toast.show({
      type: "success",
      text1: "Family Switched",
      text2: `Now viewing ${family?.name}`,
    });
  };

  const createFamily = async () => {
    if (!familyName.trim())
      return Toast.show({ type: "error", text1: "Enter a family name" });
    setCreating(true);
    const { data: newFamily, error } = await supabase
      .from("families")
      .insert({ name: familyName.trim(), created_by: user!.id })
      .select()
      .single();

    if (error || !newFamily) {
      setCreating(false);
      return Toast.show({
        type: "error",
        text1: "Error",
        text2: error?.message,
      });
    }

    await supabase.from("family_members").insert({
      family_id: newFamily.id,
      user_id: user!.id,
      role: "owner",
      display_name: user!.user_metadata?.display_name ?? user!.email,
    });

    await AsyncStorage.setItem(ACTIVE_FAMILY_KEY, newFamily.id);
    setActiveFamilyId(newFamily.id);
    await invalidateFamily(newFamily.id);
    setFamilyName("");
    setShowCreate(false);
    setCreating(false);
    loadFamilies();
  };

  const joinFamily = async () => {
    const cleanCode = inviteCode.trim().toUpperCase();
    if (!cleanCode) {
      Toast.show({ type: "error", text1: "Invite code required" });
      return;
    }

    setJoining(true);

    try {
      // 1. Find the family by code
      const { data: targetFamily, error: findError } = await supabase
        .from("families")
        .select("id, name")
        .eq("invite_code", cleanCode)
        .single();

      if (findError || !targetFamily) {
        throw new Error("Invalid invite code. Please check and try again.");
      }

      // 2. Pre-check: Is the user already in this family?
      const { data: existingMember } = await supabase
        .from("family_members")
        .select("id")
        .eq("family_id", targetFamily.id)
        .eq("user_id", user!.id)
        .single();

      if (existingMember) {
        // Friendly intercept instead of a crash/error
        Toast.show({
          type: "info",
          text1: "Already a member",
          text2: `You are already part of ${targetFamily.name}`,
        });
        setShowJoin(false);
        setInviteCode("");
        return;
      }

      // 3. Attempt to join
      const { error: joinError } = await supabase
        .from("family_members")
        .insert({
          family_id: targetFamily.id,
          user_id: user!.id,
          role: "member",
          display_name: user!.user_metadata?.display_name ?? user!.email,
        });

      if (joinError) {
        // Catch the specific Postgres "Unique Violation" error code (23505)
        if (joinError.code === "23505") {
          throw new Error(`You're already a member of ${targetFamily.name}`);
        }
        throw joinError;
      }

      // Success flow
      await AsyncStorage.setItem(ACTIVE_FAMILY_KEY, targetFamily.id);
      setActiveFamilyId(targetFamily.id);
      await invalidateFamily(targetFamily.id);

      setInviteCode("");
      setShowJoin(false);
      loadFamilies();

      Toast.show({
        type: "success",
        text1: "Welcome to the family! 🎉",
        text2: `You've joined ${targetFamily.name}`,
      });
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: "Join Failed",
        text2: err.message || "An unexpected error occurred",
      });
    } finally {
      setJoining(false);
    }
  };

  const leaveFamily = async (family: FamilyWithMembers) => {
    const isOwner =
      family.members.find((m) => m.user_id === user?.id)?.role === "owner";
    if (isOwner && family.members.length > 1)
      return Toast.show({
        type: "error",
        text1: "Owner cannot leave",
        text2: "Transfer ownership first",
      });

    Alert.alert(
      "Leave Family",
      `Are you sure you want to leave ${family.name}?`,
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
              newActive
                ? await AsyncStorage.setItem(ACTIVE_FAMILY_KEY, newActive)
                : await AsyncStorage.removeItem(ACTIVE_FAMILY_KEY);
            }
            loadFamilies();
          },
        },
      ],
    );
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
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileHeader}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>
            {user?.email?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.userName}>
            {user?.user_metadata?.display_name || "Family Member"}
          </Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => {
            setShowJoin(!showJoin);
            setShowCreate(false);
          }}
        >
          <Text style={styles.actionBtnText}>Join Family</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={() => {
            setShowCreate(!showCreate);
            setShowJoin(false);
          }}
        >
          <Text style={styles.actionBtnTextPrimary}>+ Create</Text>
        </TouchableOpacity>
      </View>

      {showCreate && (
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Family Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. The Robinsons"
            placeholderTextColor="#475569"
            value={familyName}
            onChangeText={setFamilyName}
          />
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={createFamily}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color="#0F172A" />
            ) : (
              <Text style={styles.submitBtnText}>Create Family</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {showJoin && (
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Invite Code</Text>
          <TextInput
            style={styles.input}
            placeholder="ENTER CODE"
            placeholderTextColor="#475569"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={joinFamily}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator color="#0F172A" />
            ) : (
              <Text style={styles.submitBtnText}>Join Now</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionTitle}>Your Families</Text>

      {families.map((family) => {
        const isActive = family.id === activeFamilyId;
        const userRole = family.members.find(
          (m) => m.user_id === user?.id,
        )?.role;

        const copyToClipboard = async (code: string) => {
          await Clipboard.setStringAsync(code);
          Toast.show({
            type: "success",
            text1: "Code Copied!",
            text2: "Share it with your family members",
            position: "bottom", // Keeps it near the finger
          });
        };

        return (
          <View
            key={family.id}
            style={[styles.familyCard, isActive && styles.activeCard]}
          >
            <View style={styles.familyTop}>
              <View>
                <Text style={styles.familyName}>{family.name}</Text>
                <Text style={styles.familyMeta}>
                  {userRole} • {family.members.length} members
                </Text>
              </View>
              {isActive ? (
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>ACTIVE</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.switchLink}
                  onPress={() => switchFamily(family.id)}
                >
                  <Text style={styles.switchLinkText}>Switch</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.inviteContainer}>
              <Text style={styles.inviteBoxLabel}>TAP TO COPY INVITE CODE</Text>
              <TouchableOpacity
                style={styles.inviteBox}
                onPress={() => copyToClipboard(family.invite_code)}
                activeOpacity={0.6}
              >
                <Text style={styles.inviteBoxCode}>{family.invite_code}</Text>
                {/* Simple SVG or Icon representation for "Copy" */}
                <View style={styles.copyIconCircle}>
                  <Text style={{ fontSize: 10 }}>📋</Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.leaveLink}
              onPress={() => leaveFamily(family)}
            >
              <Text style={styles.leaveLinkText}>Leave this family</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
        <Text style={styles.logoutBtnText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", paddingHorizontal: 20 },
  centered: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
  },

  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingTop: 60,
    marginBottom: 30,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  avatarText: { color: "#4ADE80", fontSize: 24, fontWeight: "800" },
  userName: { color: "#FFF", fontSize: 20, fontWeight: "700" },
  userEmail: { color: "#64748B", fontSize: 14 },

  actionRow: { flexDirection: "row", gap: 12, marginBottom: 25 },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  actionBtnPrimary: { backgroundColor: "#4ADE80", borderColor: "#4ADE80" },
  actionBtnText: { color: "#94A3B8", fontWeight: "700" },
  actionBtnTextPrimary: { color: "#0F172A", fontWeight: "800" },

  inputCard: {
    backgroundColor: "#1E293B",
    padding: 20,
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.2)",
  },
  inputLabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: "#0F172A",
    borderRadius: 12,
    padding: 15,
    color: "#FFF",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#334155",
  },
  submitBtn: {
    backgroundColor: "#4ADE80",
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: { color: "#0F172A", fontWeight: "800" },

  sectionTitle: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 15,
  },

  familyCard: {
    backgroundColor: "#1E293B",
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  activeCard: {
    borderColor: "rgba(74, 222, 128, 0.4)",
    backgroundColor: "#1E293B",
  },
  familyTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  familyName: { color: "#FFF", fontSize: 20, fontWeight: "800" },
  familyMeta: {
    color: "#64748B",
    fontSize: 13,
    marginTop: 4,
    textTransform: "capitalize",
  },
  activePill: {
    backgroundColor: "rgba(74, 222, 128, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activePillText: { color: "#4ADE80", fontSize: 10, fontWeight: "800" },
  switchLink: { paddingVertical: 4 },
  switchLinkText: { color: "#4ADE80", fontWeight: "700" },

  inviteContainer: {
    marginBottom: 20,
  },
  inviteBoxLabel: {
    color: "#475569",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    textAlign: "center",
    marginBottom: 8,
  },
  inviteBox: {
    backgroundColor: "#0F172A",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.1)",
    borderStyle: "dashed", // Gives it that "coupon/ticket" feel
    position: "relative",
  },
  inviteBoxCode: {
    color: "#4ADE80",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 6,
  },
  copyIconCircle: {
    position: "absolute",
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(74, 222, 128, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  membersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  memberAvatar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  memberDot: { width: 8, height: 8, borderRadius: 4 },
  memberName: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "600",
    maxWidth: 80,
  },

  leaveLink: { alignItems: "center", paddingTop: 10 },
  leaveLinkText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "600",
    opacity: 0.8,
  },

  logoutBtn: {
    marginTop: 20,
    height: 56,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  logoutBtnText: { color: "#EF4444", fontWeight: "700", fontSize: 16 },
});
