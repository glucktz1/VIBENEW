import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform } from "react-native";
import { useAuth } from "@/src/context/AuthContext";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e.message || "Kuingia kumeshindikana");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.primaryDark, COLORS.background]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Pressable style={styles.back} onPress={() => router.back()} testID="login-back">
              <Ionicons name="chevron-back" size={26} color={COLORS.text} />
            </Pressable>

            <View style={styles.logoWrap}>
              <View style={styles.logo}>
                <Ionicons name="musical-notes" size={40} color="#fff" />
              </View>
              <Text style={styles.brand}>Vibe</Text>
              <Text style={styles.tagline}>Muziki wa Kikristo, popote ulipo</Text>
            </View>

            <Text style={styles.title}>Karibu tena</Text>

            <View style={styles.field}>
              <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} />
              <TextInput
                testID="login-email"
                style={styles.input}
                placeholder="Barua pepe"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
            <View style={styles.field}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />
              <TextInput
                testID="login-password"
                style={styles.input}
                placeholder="Nenosiri"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {err ? <Text style={styles.err} testID="login-error">{err}</Text> : null}

            <Pressable testID="login-submit" style={styles.primary} onPress={submit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Ingia</Text>}
            </Pressable>

            <Pressable testID="go-register" style={styles.link} onPress={() => router.replace("/(auth)/register")}>
              <Text style={styles.linkText}>Huna akaunti? <Text style={{ color: COLORS.primary, fontWeight: "800" }}>Jisajili</Text></Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, flexGrow: 1 },
  back: { width: 40, height: 40, justifyContent: "center" },
  logoWrap: { alignItems: "center", marginTop: SPACING.lg, marginBottom: SPACING.xl },
  logo: {
    width: 84, height: 84, borderRadius: RADIUS.full, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center", marginBottom: SPACING.md,
  },
  brand: { color: COLORS.text, fontSize: FONT.xxxl, fontWeight: "800" },
  tagline: { color: COLORS.textSecondary, fontSize: FONT.md, marginTop: SPACING.xs },
  title: { color: COLORS.text, fontSize: FONT.xxl, fontWeight: "800", marginBottom: SPACING.lg },
  field: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 54, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  input: { flex: 1, color: COLORS.text, marginLeft: SPACING.sm, fontSize: FONT.md },
  err: { color: COLORS.error, marginBottom: SPACING.md },
  primary: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, height: 54, alignItems: "center", justifyContent: "center", marginTop: SPACING.sm },
  primaryText: { color: "#fff", fontSize: FONT.lg, fontWeight: "800" },
  link: { alignItems: "center", marginTop: SPACING.lg },
  linkText: { color: COLORS.textSecondary, fontSize: FONT.md },
});
