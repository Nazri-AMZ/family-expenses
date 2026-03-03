// app/(tabs)/add.tsx
import { useAddExpense, useCategories } from "@/hooks/use-expenses";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

export default function AddExpenseScreen() {
  const router = useRouter();
  const { data: categories = [] } = useCategories();
  const addExpense = useAddExpense();

  const [mode, setMode] = useState<"manual" | "receipt">("manual");
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

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
      Toast.show({
        type: "info",
        text1: "Processing receipt...",
        text2: "AI is reading your receipt",
      });
      // processReceipt(result.assets[0].uri) — hook up when AI is ready
    }
  };

  const handleSave = async () => {
    if (!merchant || !amount) {
      Toast.show({
        type: "error",
        text1: "Missing fields",
        text2: "Please enter a merchant and amount",
      });
      return;
    }

    try {
      await addExpense.mutateAsync({
        merchant,
        amount: parseFloat(amount),
        category_id: selectedCategory,
        notes,
        source: mode === "manual" ? "manual" : "receipt_upload",
      });
      Toast.show({ type: "success", text1: "Expense saved!" });
      router.replace("/(tabs)");
    } catch {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Could not save expense",
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add Expense</Text>
        <View style={{ width: 32 }} />
      </View>

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

        <Text style={styles.label}>Merchant</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Jaya Grocer"
          placeholderTextColor="#475569"
          value={merchant}
          onChangeText={setMerchant}
        />

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, { height: 72, textAlignVertical: "top" }]}
          placeholder="Any additional notes..."
          placeholderTextColor="#475569"
          value={notes}
          onChangeText={setNotes}
          multiline
        />

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

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={addExpense.isPending}
        >
          {addExpense.isPending ? (
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
