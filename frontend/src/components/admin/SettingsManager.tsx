import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Switch, TextInput, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { adminApi } from "@/src/services/api";
import TranslationsManager from "./TranslationsManager";
import { C, SP } from "./adminTheme";

type Field =
  | { kind: "toggle"; key: string; label: string; desc: string }
  | { kind: "num"; key: string; label: string; step: number; min: number; max?: number }
  | { kind: "text"; key: string; label: string; placeholder?: string; keyboardType?: "default" | "email-address" | "url" };

const SECTIONS: { key: string; label: string; icon: string; desc: string; fields: Field[] }[] = [
  {
    key: "system", label: "System Settings", icon: "globe", desc: "Core playback engine behaviour",
    fields: [
      { kind: "toggle", key: "background_playback", label: "Background playback", desc: "Allow audio to continue in background" },
      { kind: "num", key: "min_play_duration", label: "Minimum Play Duration (sec)", step: 5, min: 0 },
      { kind: "num", key: "replay_limit_per_song", label: "Replay Limit Per Song", step: 1, min: 0 },
    ],
  },
  {
    key: "app", label: "App Settings", icon: "settings-outline", desc: "Free & guest listening limits",
    fields: [
      { kind: "toggle", key: "free_unlimited_songs", label: "Unlimited song access (Free)", desc: "Remove daily song cap for free users" },
      { kind: "toggle", key: "free_unlimited_downloads", label: "Unlimited downloads (Free)", desc: "Let free users download without limit" },
      { kind: "num", key: "free_user_skip_limit", label: "Free User Skip Limit", step: 1, min: 0 },
      { kind: "num", key: "free_user_daily_songs", label: "Free User Daily Songs", step: 5, min: 0 },
      { kind: "num", key: "guest_play_limit", label: "Guest Play Limit", step: 1, min: 0 },
    ],
  },
  {
    key: "branding", label: "Branding", icon: "color-palette", desc: "App identity shown to listeners",
    fields: [
      { kind: "text", key: "app_name", label: "App Name", placeholder: "Vibe" },
      { kind: "text", key: "brand_primary_color", label: "Primary Color (hex)", placeholder: "#00A8E8" },
      { kind: "text", key: "support_email", label: "Support Email", placeholder: "support@vibe.app", keyboardType: "email-address" },
    ],
  },
  {
    key: "legal", label: "Legal & Compliance", icon: "document-text", desc: "Company & policy references",
    fields: [
      { kind: "text", key: "company_name", label: "Company Name", placeholder: "Vibe Music" },
      { kind: "text", key: "terms_url", label: "Terms of Service URL", placeholder: "https://...", keyboardType: "url" },
      { kind: "text", key: "privacy_url", label: "Privacy Policy URL", placeholder: "https://...", keyboardType: "url" },
    ],
  },
  {
    key: "monetization", label: "Monetization", icon: "card", desc: "Billing, premium & ad behaviour",
    fields: [
      { kind: "toggle", key: "billing_enabled", label: "Billing Enabled", desc: "Allow paid subscriptions" },
      { kind: "toggle", key: "premium_for_all", label: "Premium for All Mode", desc: "Give every user premium access (promo)" },
      { kind: "toggle", key: "no_ads_for_premium", label: "No ads for Premium", desc: "Hide ads for premium subscribers" },
      { kind: "num", key: "free_prompt_ringtone_pct", label: "Free Ringtone Prompt %  (rest show Contribute)", step: 10, min: 0, max: 100 },
    ],
  },
  {
    key: "auth", label: "Auth Settings", icon: "lock-closed", desc: "Sign-in & verification rules",
    fields: [
      { kind: "toggle", key: "phone_otp_enabled", label: "Phone OTP", desc: "Enable phone number OTP verification" },
      { kind: "toggle", key: "email_verification_required", label: "Email Verification", desc: "Require email verification on signup" },
    ],
  },
  {
    key: "security", label: "Security", icon: "shield-checkmark", desc: "Admin protection & sessions",
    fields: [
      { kind: "toggle", key: "two_factor_admin", label: "Admin 2FA", desc: "Require two-factor auth for admin logins" },
      { kind: "num", key: "session_timeout_min", label: "Session Timeout (min)", step: 15, min: 15 },
    ],
  },
];

export default function SettingsManager({ onToast, initial = "system" }: { onToast: (m: string) => void; initial?: string }) {
  const [data, setData] = useState<any>(null);
  const [orig, setOrig] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState(initial);

  useEffect(() => { setView(initial); }, [initial]);

  const load = useCallback(async () => {
    const s = await adminApi.settings().catch(() => null);
    setData(s); setOrig(JSON.stringify(s));
  }, []);
  useEffect(() => { load(); }, [load]);

  const dirty = data && JSON.stringify(data) !== orig;
  const save = async () => {
    setSaving(true);
    try { const u = await adminApi.updateSettings(data); setData(u); setOrig(JSON.stringify(u)); onToast("Settings saved"); }
    catch (e: any) { onToast(e.message); } finally { setSaving(false); }
  };

  if (!data) return <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} />;

  const section = SECTIONS.find((s) => s.key === view) || SECTIONS[0];

  return (
    <View>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.sub}>Configure app behaviour, playback limits & billing</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabs}>
        {SECTIONS.map((s) => (
          <Pressable key={s.key} testID={`set-tab-${s.key}`} style={[styles.subTab, view === s.key && styles.subTabOn]} onPress={() => setView(s.key)}>
            <Ionicons name={s.icon as any} size={14} color={view === s.key ? "#fff" : C.sub} />
            <Text style={[styles.subTabText, view === s.key && { color: "#fff" }]}>{s.label}</Text>
          </Pressable>
        ))}
        <Pressable testID="set-tab-language" style={[styles.subTab, view === "language" && styles.subTabOn]} onPress={() => setView("language")}>
          <Ionicons name="language" size={14} color={view === "language" ? "#fff" : C.sub} />
          <Text style={[styles.subTabText, view === "language" && { color: "#fff" }]}>Language</Text>
        </Pressable>
      </ScrollView>

      {view === "language" ? (
        <TranslationsManager onToast={onToast} />
      ) : (
      <>
      <Text style={styles.section}>{section.label}</Text>
      <Text style={styles.sectionDesc}>{section.desc}</Text>

      {section.fields.map((f) => {
        if (f.kind === "toggle") {
          return (
            <View key={f.key} style={styles.row}>
              <View style={{ flex: 1, paddingRight: SP.sm }}>
                <Text style={styles.rowLabel}>{f.label}</Text>
                <Text style={styles.rowDesc}>{f.desc}</Text>
              </View>
              <Switch testID={`set-${f.key}`} value={!!data[f.key]} onValueChange={(v) => setData({ ...data, [f.key]: v })}
                trackColor={{ true: C.violet, false: C.border }} thumbColor="#fff" />
            </View>
          );
        }
        if (f.kind === "num") {
          return (
            <View key={f.key} style={styles.row}>
              <Text style={[styles.rowLabel, { flex: 1 }]}>{f.label}</Text>
              <View style={styles.stepper}>
                <Pressable testID={`dec-${f.key}`} style={styles.stepBtn} onPress={() => setData({ ...data, [f.key]: Math.max(f.min, (data[f.key] || 0) - f.step) })}>
                  <Ionicons name="remove" size={16} color={C.text} />
                </Pressable>
                <Text style={styles.stepVal}>{data[f.key]}</Text>
                <Pressable testID={`inc-${f.key}`} style={styles.stepBtn} onPress={() => setData({ ...data, [f.key]: Math.min(f.max ?? Infinity, (data[f.key] || 0) + f.step) })}>
                  <Ionicons name="add" size={16} color={C.text} />
                </Pressable>
              </View>
            </View>
          );
        }
        return (
          <View key={f.key} style={styles.fieldRow}>
            <Text style={styles.rowLabel}>{f.label}</Text>
            <TextInput
              testID={`set-${f.key}`}
              style={styles.input}
              value={String(data[f.key] ?? "")}
              placeholder={f.placeholder}
              placeholderTextColor={C.muted}
              keyboardType={f.keyboardType || "default"}
              autoCapitalize="none"
              onChangeText={(t) => setData({ ...data, [f.key]: t })}
            />
          </View>
        );
      })}

      {dirty ? (
        <View style={styles.saveBar}>
          <Text style={styles.unsaved}>You have unsaved changes</Text>
          <Pressable testID="settings-save" style={styles.saveBtn} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Changes</Text>}
          </Pressable>
        </View>
      ) : null}
      <View style={{ height: 40 }} />
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: C.text, fontSize: 22, fontWeight: "800" },
  sub: { color: C.muted, fontSize: 12, marginTop: 2, marginBottom: SP.md },
  subTabs: { flexDirection: "row", gap: SP.sm, paddingBottom: SP.sm },
  subTab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: SP.md, height: 34, borderRadius: 9999, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  subTabOn: { backgroundColor: C.violet, borderColor: C.violet },
  subTabText: { color: C.sub, fontWeight: "700", fontSize: 12 },
  section: { color: C.violet, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginTop: SP.md },
  sectionDesc: { color: C.muted, fontSize: 11, marginTop: 2, marginBottom: SP.sm },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: C.cardAlt, borderRadius: 10, padding: SP.md, marginBottom: SP.sm, borderWidth: 1, borderColor: C.border },
  fieldRow: { backgroundColor: C.cardAlt, borderRadius: 10, padding: SP.md, marginBottom: SP.sm, borderWidth: 1, borderColor: C.border },
  rowLabel: { color: C.text, fontSize: 14, fontWeight: "600" },
  rowDesc: { color: C.muted, fontSize: 11, marginTop: 2 },
  input: { marginTop: SP.sm, backgroundColor: C.bg, borderRadius: 8, borderWidth: 1, borderColor: C.border, color: C.text, paddingHorizontal: SP.sm, height: 42, fontSize: 14 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  stepVal: { color: C.text, fontSize: 15, fontWeight: "800", minWidth: 34, textAlign: "center" },
  saveBar: { backgroundColor: C.card, borderRadius: 12, padding: SP.md, borderWidth: 1, borderColor: C.violet, marginTop: SP.md },
  unsaved: { color: C.amber, fontSize: 12, fontWeight: "700", marginBottom: SP.sm },
  saveBtn: { backgroundColor: C.violet, borderRadius: 9999, height: 48, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#fff", fontWeight: "800" },
});
