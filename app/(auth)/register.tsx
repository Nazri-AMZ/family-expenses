import { useAuthStore } from "@/src/store/useAuthStore";
import { Link } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function RegisterScreen() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { signUpWithEmail, loading } = useAuthStore();

  const handleRegister = async () => {
    setError(null);
    if (!displayName || !email || !password)
      return setError("Please fill in all fields");
    if (password !== confirmPassword) return setError("Passwords do not match");
    if (password.length < 6)
      return setError("Password must be at least 6 characters");

    const { error } = await signUpWithEmail(email, password, displayName);
    if (error) return setError(error);
    setSuccess(true);
  };

  if (success) {
    return (
      <View
        style={[styles.container, { justifyContent: "center", padding: 24 }]}
      >
        <Text style={{ fontSize: 48, textAlign: "center", marginBottom: 16 }}>
          ✉️
        </Text>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a confirmation link to {email}. Click it to activate your
          account.
        </Text>
        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Back to Login</Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Set up your family expense tracker</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor="#475569"
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#475569"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#475569"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor="#475569"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#0F172A" />
          ) : (
            <Text style={styles.primaryBtnText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.registerLink}>
            <Text style={styles.registerText}>
              Already have an account?{" "}
              <Text style={styles.registerTextBold}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  inner: { flex: 1, justifyContent: "center", padding: 24 },
  title: { fontSize: 32, color: "#F1F5F9", fontWeight: "800", marginBottom: 8 },
  subtitle: { fontSize: 15, color: "#475569", marginBottom: 40 },
  errorBox: {
    backgroundColor: "#F8717122",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: "#F87171", fontSize: 13 },
  input: {
    backgroundColor: "#1E293B",
    borderRadius: 14,
    padding: 16,
    color: "#F1F5F9",
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  primaryBtn: {
    backgroundColor: "#4ADE80",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#4ADE80",
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  primaryBtnText: { color: "#0F172A", fontSize: 16, fontWeight: "700" },
  registerLink: { marginTop: 24, alignItems: "center" },
  registerText: { color: "#475569", fontSize: 14 },
  registerTextBold: { color: "#4ADE80", fontWeight: "700" },
});
