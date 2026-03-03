import { processReceiptImage } from "@/src/services/receipt.service";
import { useAuthStore } from "@/src/store/useAuthStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../src/lib/supabase";
import type { Category } from "../../src/types/database";

export default function AddExpenseScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [mode, setMode] = useState<"manual" | "receipt">("manual");
  const [categories, setCategories] = useState<Category[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);

  // Form state
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Receipt state
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    const activeFamilyId = await AsyncStorage.getItem("active_family_id");
    if (!activeFamilyId) return;

    setFamilyId(activeFamilyId);

    if (!user) return;

    const { data: memberRow } = await supabase
      .from("family_members")
      .select("family_id")
      .eq("user_id", activeFamilyId)
      .single();

    if (memberRow) setFamilyId(memberRow.family_id);

    // Load global + family categories
    const { data: cats } = await supabase
      .from("categories")
      .select("*")
      .or(`family_id.is.null,family_id.eq.${memberRow?.family_id}`)
      .order("name");

    setCategories(cats ?? []);
  };

  const pickImage = async (fromCamera: boolean) => {
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });

    if (!result.canceled && result.assets[0]) {
      setReceiptImage(result.assets[0].uri);
      processReceipt(result.assets[0].uri);
    }
  };

  const processReceipt = async (imageUri: string) => {
    setScanning(true);
    try {
      const parsed = await processReceiptImage(imageUri, familyId!, user!.id);
      if (parsed.merchant) setMerchant(parsed.merchant);
      if (parsed.total_amount) setAmount(String(parsed.total_amount));
      if (parsed.category_id) setSelectedCategory(parsed.category_id);
      setScanned(true);
    } catch (err) {
      console.log(err);

      Alert.alert("Error", "Could not read receipt. Please fill in manually.");
      setMode("manual");
    } finally {
      setScanning(false);
    }
  };

  const handleSave = async () => {
    if (!merchant || !amount || !familyId) {
      Alert.alert("Missing fields", "Please enter a merchant and amount.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("expenses").insert({
      family_id: familyId,
      added_by: user!.id,
      merchant,
      amount: parseFloat(amount),
      category_id: selectedCategory,
      notes,
      source: mode === "manual" ? "manual" : "receipt_upload",
    });

    setSaving(false);

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      router.replace("/(tabs)");
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add Expense</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Mode Toggle */}
      <View style={styles.toggle}>
        {(["manual", "receipt"] as const).map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => setMode(m)}
            style={[styles.toggleBtn, mode === m && styles.toggleBtnActive]}
          >
            <Text
              style={[styles.toggleText, mode === m && styles.toggleTextActive]}
            >
              {m === "manual" ? "✏️  Manual" : "📷  Scan Receipt"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        {/* Receipt Mode */}
        {mode === "receipt" && !scanned && (
          <View style={{ marginBottom: 20 }}>
            {receiptImage ? (
              <Image
                source={{ uri: receiptImage }}
                style={styles.receiptPreview}
              />
            ) : (
              <View style={styles.receiptPlaceholder}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>📷</Text>
                <Text style={styles.receiptPlaceholderText}>
                  Take or upload a photo of your receipt
                </Text>
                <Text style={styles.receiptPlaceholderSub}>
                  AI will auto-fill the details
                </Text>
              </View>
            )}

            {scanning ? (
              <View style={styles.scanningBox}>
                <ActivityIndicator color="#4ADE80" />
                <Text style={styles.scanningText}>
                  AI is reading your receipt...
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10, marginTop: 12 }}>
                <TouchableOpacity
                  style={styles.greenBtn}
                  onPress={() => pickImage(true)}
                >
                  <Text style={styles.greenBtnText}>📷 Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.outlineBtn}
                  onPress={() => pickImage(false)}
                >
                  <Text style={styles.outlineBtnText}>
                    📁 Upload from Gallery
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {scanned && (
          <View style={styles.aiSuccessBox}>
            <Text style={{ fontSize: 16 }}>✅</Text>
            <Text style={styles.aiSuccessText}>
              Receipt parsed by AI — please review below
            </Text>
          </View>
        )}

        {/* Amount */}
        <Text style={styles.label}>Amount (RM)</Text>
        <View style={styles.amountRow}>
          <Text style={styles.currencyPrefix}>RM</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0.00"
            placeholderTextColor="#475569"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Merchant */}
        <Text style={styles.label}>Merchant</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Jaya Grocer"
          placeholderTextColor="#475569"
          value={merchant}
          onChangeText={setMerchant}
        />

        {/* Notes */}
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, { height: 72, textAlignVertical: "top" }]}
          placeholder="Any additional notes..."
          placeholderTextColor="#475569"
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        {/* Category */}
        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setSelectedCategory(cat.id)}
              style={[
                styles.categoryBtn,
                selectedCategory === cat.id && {
                  borderColor: cat.color,
                  backgroundColor: cat.color + "18",
                },
              ]}
            >
              <Text style={{ fontSize: 22, marginBottom: 4 }}>{cat.icon}</Text>
              <Text
                style={[
                  styles.categoryLabel,
                  selectedCategory === cat.id && { color: cat.color },
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Save */}
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#0F172A" />
          ) : (
            <Text style={styles.saveBtnText}>Save Expense</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    paddingTop: 54,
  },
  title: { color: "#F1F5F9", fontSize: 20, fontWeight: "800" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 99,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { color: "#64748B", fontSize: 14 },
  toggle: {
    flexDirection: "row",
    backgroundColor: "#1E293B",
    borderRadius: 14,
    padding: 4,
    marginHorizontal: 20,
  },
  toggleBtn: { flex: 1, padding: 10, borderRadius: 10, alignItems: "center" },
  toggleBtnActive: { backgroundColor: "#4ADE80" },
  toggleText: { color: "#475569", fontSize: 13, fontWeight: "600" },
  toggleTextActive: { color: "#0F172A" },
  label: {
    color: "#64748B",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: "#1E293B",
    borderRadius: 14,
    padding: 16,
    color: "#F1F5F9",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#334155",
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 16,
  },
  currencyPrefix: {
    color: "#4ADE80",
    fontSize: 20,
    fontWeight: "800",
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    color: "#F1F5F9",
    fontSize: 28,
    fontWeight: "800",
    paddingVertical: 16,
  },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryBtn: {
    width: "30%",
    backgroundColor: "#1E293B",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#334155",
  },
  categoryLabel: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  saveBtn: {
    backgroundColor: "#4ADE80",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    marginTop: 24,
    shadowColor: "#4ADE80",
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  saveBtnText: { color: "#0F172A", fontSize: 16, fontWeight: "800" },
  receiptPreview: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    marginBottom: 8,
  },
  receiptPlaceholder: {
    backgroundColor: "#1E293B",
    borderRadius: 20,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#334155",
    borderStyle: "dashed",
  },
  receiptPlaceholderText: { color: "#94A3B8", fontSize: 14, marginBottom: 4 },
  receiptPlaceholderSub: { color: "#475569", fontSize: 12 },
  scanningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#4ADE8011",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  scanningText: { color: "#4ADE80", fontSize: 14 },
  aiSuccessBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#4ADE8011",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#4ADE8033",
  },
  aiSuccessText: { color: "#4ADE80", fontSize: 13, flex: 1 },
  greenBtn: {
    backgroundColor: "#4ADE80",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  greenBtnText: { color: "#0F172A", fontWeight: "700", fontSize: 14 },
  outlineBtn: {
    backgroundColor: "#1E293B",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  outlineBtnText: { color: "#94A3B8", fontSize: 14 },
});
