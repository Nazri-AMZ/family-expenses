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

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { signInWithEmail, signInWithGoogle, loading } = useAuthStore();

  const handleEmailLogin = async () => {
    setError(null);
    if (!email || !password) return setError("Please fill in all fields");
    const { error } = await signInWithEmail(email, password);
    if (error) setError(error);
  };

  const handleGoogleLogin = async () => {
    setError(null);
    const { error } = await signInWithGoogle();
    if (error) setError(error);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Family{"\n"}Expenses</Text>
        <Text style={styles.subtitle}>Track together, spend smarter</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

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

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleEmailLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#0F172A" />
          ) : (
            <Text style={styles.primaryBtnText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.googleBtn}
          onPress={handleGoogleLogin}
          disabled={loading}
        >
          <Text style={styles.googleBtnText}>🔵 Continue with Google</Text>
        </TouchableOpacity>

        <Link href="/(auth)/register" asChild>
          <TouchableOpacity style={styles.registerLink}>
            <Text style={styles.registerText}>
              Don't have an account?{" "}
              <Text style={styles.registerTextBold}>Sign up</Text>
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
  title: {
    fontSize: 42,
    color: "#F1F5F9",
    fontWeight: "800",
    marginBottom: 8,
    lineHeight: 48,
  },
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
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#1E293B" },
  dividerText: { color: "#475569", fontSize: 13 },
  googleBtn: {
    backgroundColor: "#1E293B",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  googleBtnText: { color: "#CBD5E1", fontSize: 15, fontWeight: "600" },
  registerLink: { marginTop: 24, alignItems: "center" },
  registerText: { color: "#475569", fontSize: 14 },
  registerTextBold: { color: "#4ADE80", fontWeight: "700" },
});
