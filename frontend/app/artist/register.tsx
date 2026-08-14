import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { artistApi } from "@/src/services/artistApi";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function ArtistRegister() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", genre: "", bio: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setErr("");
    if (!form.name || !form.email || form.password.length < 6) {
      setErr("Jaza jina, barua pepe na nywila (angalau herufi 6)");
      return;
    }
    setLoading(true);
    try {
      await artistApi.register(form);
      setDone(true);
    } catch (e: any) {
      setErr(e.message || "Usajili umeshindikana");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <View style={styles.doneWrap}>
          <View style={styles.doneIcon}><Ionicons name="checkmark" size={40} color="#fff" /></View>
          <Text style={styles.title}>Ombi Limepokelewa!</Text>
          <Text style={styles.sub}>Akaunti yako inasubiri idhini ya admin. Utaweza kuingia mara baada ya kupitishwa.</Text>
          <Pressable testID="artist-register-done" style={styles.primary} onPress={() => router.replace("/artist/login")}>
            <Text style={styles.primaryText}>Rudi Kuingia</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.back} onPress={() => router.replace("/artist/login")} testID="artist-register-back">
            <Ionicons name="chevron-back" size={26} color={COLORS.text} />
          </Pressable>
          <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.logo}>
            <Ionicons name="mic" size={30} color="#fff" />
          </LinearGradient>
          <Text style={styles.title}>Jisajili kama Msanii</Text>
          <Text style={styles.sub}>Sambaza muziki wako na upate mapato</Text>

          <Field label="Jina la Msanii / Kwaya" tid="reg-name" value={form.name} onChange={(v) => set("name", v)} />
          <Field label="Barua pepe" tid="reg-email" value={form.email} onChange={(v) => set("email", v)} keyboard="email-address" />
          <Field label="Nywila" tid="reg-password" value={form.password} onChange={(v) => set("password", v)} secure />
          <Field label="Simu (hiari)" tid="reg-phone" value={form.phone} onChange={(v) => set("phone", v)} keyboard="phone-pad" />
          <Field label="Aina ya muziki (hiari)" tid="reg-genre" value={form.genre} onChange={(v) => set("genre", v)} />
          <Field label="Maelezo mafupi (hiari)" tid="reg-bio" value={form.bio} onChange={(v) => set("bio", v)} multiline />

          {err ? <Text style={styles.err} testID="artist-register-error">{err}</Text> : null}
          <Pressable testID="artist-register-submit" style={styles.primary} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Jisajili</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, tid, value, onChange, secure, keyboard, multiline }: any) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput testID={tid} style={[styles.input, multiline && { height: 80, textAlignVertical: "top", paddingTop: 10 }]}
        value={value} onChangeText={onChange} placeholder={label} placeholderTextColor={COLORS.textMuted}
        autoCapitalize={secure || keyboard === "email-address" ? "none" : "sentences"}
        secureTextEntry={!!secure} keyboardType={keyboard || "default"} multiline={!!multiline} />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  back: { alignSelf: "flex-start", marginBottom: SPACING.sm },
  logo: { width: 64, height: 64, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: SPACING.sm },
  title: { color: COLORS.text, fontSize: FONT.xxl, fontWeight: "800", textAlign: "center" },
  sub: { color: COLORS.textSecondary, fontSize: FONT.md, textAlign: "center", marginTop: 4, marginBottom: SPACING.md },
  label: { color: COLORS.textSecondary, fontSize: FONT.sm, marginBottom: 6, marginTop: SPACING.sm },
  input: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 50, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  err: { color: COLORS.error, fontSize: FONT.sm, marginTop: SPACING.md },
  primary: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, height: 52, alignItems: "center", justifyContent: "center", marginTop: SPACING.lg },
  primaryText: { color: "#fff", fontSize: FONT.lg, fontWeight: "800" },
  doneWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  doneIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.success, alignItems: "center", justifyContent: "center", marginBottom: SPACING.lg },
});
