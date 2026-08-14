import React, { useState } from "react";
import { Text, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { artistApi } from "@/src/services/artistApi";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function ArtistLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr(""); setLoading(true);
    try {
      const res = await artistApi.login(email.trim(), password);
      await artistApi.setToken(res.access_token);
      router.replace("/artist");
    } catch (e: any) {
      setErr(e.message || "Imeshindikana kuingia");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.back} onPress={() => router.replace("/(tabs)/profile")} testID="artist-login-back">
            <Ionicons name="chevron-back" size={26} color={COLORS.text} />
          </Pressable>
          <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.logo}>
            <Ionicons name="mic" size={34} color="#fff" />
          </LinearGradient>
          <Text style={styles.title}>Artist Portal</Text>
          <Text style={styles.sub}>Ingia kwenye akaunti yako ya msanii</Text>

          <Text style={styles.label}>Barua pepe</Text>
          <TextInput testID="artist-email" style={styles.input} value={email} onChangeText={setEmail}
            placeholder="wewe@mfano.com" placeholderTextColor={COLORS.textMuted} autoCapitalize="none" keyboardType="email-address" />
          <Text style={styles.label}>Nywila</Text>
          <TextInput testID="artist-password" style={styles.input} value={password} onChangeText={setPassword}
            placeholder="••••••••" placeholderTextColor={COLORS.textMuted} secureTextEntry />

          {err ? <Text style={styles.err} testID="artist-login-error">{err}</Text> : null}

          <Pressable testID="artist-login-submit" style={styles.primary} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Ingia</Text>}
          </Pressable>
          <Pressable testID="go-artist-register" style={styles.link} onPress={() => router.replace("/artist/register")}>
            <Text style={styles.linkText}>Huna akaunti? <Text style={{ color: COLORS.primary, fontWeight: "800" }}>Jisajili kama Msanii</Text></Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingTop: SPACING.xl },
  back: { alignSelf: "flex-start", marginBottom: SPACING.md },
  logo: { width: 72, height: 72, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: SPACING.md },
  title: { color: COLORS.text, fontSize: FONT.xxl, fontWeight: "800", textAlign: "center" },
  sub: { color: COLORS.textSecondary, fontSize: FONT.md, textAlign: "center", marginTop: 4, marginBottom: SPACING.xl },
  label: { color: COLORS.textSecondary, fontSize: FONT.sm, marginBottom: 6, marginTop: SPACING.sm },
  input: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 50, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  err: { color: COLORS.error, fontSize: FONT.sm, marginTop: SPACING.md },
  primary: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, height: 52, alignItems: "center", justifyContent: "center", marginTop: SPACING.lg },
  primaryText: { color: "#fff", fontSize: FONT.lg, fontWeight: "800" },
  link: { alignItems: "center", paddingVertical: SPACING.lg },
  linkText: { color: COLORS.textSecondary, fontSize: FONT.md },
});
