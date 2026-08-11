import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (password.length < 6) {
      setErr("Nenosiri liwe na herufi 6 au zaidi");
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim());
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e.message || "Usajili umeshindikana");
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
            <Pressable style={styles.back} onPress={() => router.back()} testID="register-back">
              <Ionicons name="chevron-back" size={26} color={COLORS.text} />
            </Pressable>

            <Text style={styles.title}>Fungua akaunti</Text>
            <Text style={styles.sub}>Jiunge na Vibe bila malipo</Text>

            <View style={styles.field}>
              <Ionicons name="person-outline" size={20} color={COLORS.textMuted} />
              <TextInput testID="register-name" style={styles.input} placeholder="Jina lako" placeholderTextColor={COLORS.textMuted} value={name} onChangeText={setName} />
            </View>
            <View style={styles.field}>
              <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} />
              <TextInput testID="register-email" style={styles.input} placeholder="Barua pepe" placeholderTextColor={COLORS.textMuted} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
            </View>
            <View style={styles.field}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />
              <TextInput testID="register-password" style={styles.input} placeholder="Nenosiri" placeholderTextColor={COLORS.textMuted} secureTextEntry value={password} onChangeText={setPassword} />
            </View>

            {err ? <Text style={styles.err} testID="register-error">{err}</Text> : null}

            <Pressable testID="register-submit" style={styles.primary} onPress={submit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Jisajili</Text>}
            </Pressable>

            <Pressable testID="go-login" style={styles.link} onPress={() => router.replace("/(auth)/login")}>
              <Text style={styles.linkText}>Una akaunti tayari? <Text style={{ color: COLORS.primary, fontWeight: "800" }}>Ingia</Text></Text>
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
  title: { color: COLORS.text, fontSize: FONT.xxxl, fontWeight: "800", marginTop: SPACING.lg },
  sub: { color: COLORS.textSecondary, fontSize: FONT.md, marginBottom: SPACING.xl },
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
