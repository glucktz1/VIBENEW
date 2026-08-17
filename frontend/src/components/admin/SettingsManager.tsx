import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { adminApi } from "@/src/services/api";
import { C, SP } from "./adminTheme";

const TOGGLES: { key: string; label: string; desc: string }[] = [
  { key: "premium_for_all", label: "Premium for All Mode", desc: "Give every user premium access (promo)" },
  { key: "billing_enabled", label: "Billing Enabled", desc: "Allow paid subscriptions" },
  { key: "no_ads_for_premium", label: "No ads for Premium", desc: "Hide ads for premium subscribers" },
  { key: "background_playback", label: "Background playback", desc: "Allow audio to continue in background" },
  { key: "free_unlimited_downloads", label: "Unlimited downloads (Free)", desc: "Let free users download without limit" },
  { key: "free_unlimited_songs", label: "Unlimited song access (Free)", desc: "Remove daily song cap for free users" },
  { key: "phone_otp_enabled", label: "Phone OTP", desc: "Enable phone number OTP verification" },
];
const NUMS: { key: string; label: string; step: number; min: number }[] = [
  { key: "min_play_duration", label: "Minimum Play Duration (sec)", step: 5, min: 0 },
  { key: "replay_limit_per_song", label: "Replay Limit Per Song", step: 1, min: 0 },
  { key: "free_user_skip_limit", label: "Free User Skip Limit", step: 1, min: 0 },
  { key: "free_user_daily_songs", label: "Free User Daily Songs", step: 5, min: 0 },
  { key: "guest_play_limit", label: "Guest Play Limit", step: 1, min: 0 },
];

export default function SettingsManager({ onToast }: { onToast: (m: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [orig, setOrig] = useState<any>(null);
  const [saving, setSaving] = useState(false);

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

  return (
    <View>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.sub}>Configure app behaviour, playback limits & billing</Text>

      <Text style={styles.section}>Playback & Access</Text>
      {TOGGLES.map((t) => (
        <View key={t.key} style={styles.row}>
          <View style={{ flex: 1, paddingRight: SP.sm }}>
            <Text style={styles.rowLabel}>{t.label}</Text>
            <Text style={styles.rowDesc}>{t.desc}</Text>
          </View>
          <Switch testID={`set-${t.key}`} value={!!data[t.key]} onValueChange={(v) => setData({ ...data, [t.key]: v })}
            trackColor={{ true: C.violet, false: C.border }} thumbColor="#fff" />
        </View>
      ))}

      <Text style={styles.section}>Limits</Text>
      {NUMS.map((n) => (
        <View key={n.key} style={styles.row}>
          <Text style={[styles.rowLabel, { flex: 1 }]}>{n.label}</Text>
          <View style={styles.stepper}>
            <Pressable testID={`dec-${n.key}`} style={styles.stepBtn} onPress={() => setData({ ...data, [n.key]: Math.max(n.min, (data[n.key] || 0) - n.step) })}>
              <Ionicons name="remove" size={16} color={C.text} />
            </Pressable>
            <Text style={styles.stepVal}>{data[n.key]}</Text>
            <Pressable testID={`inc-${n.key}`} style={styles.stepBtn} onPress={() => setData({ ...data, [n.key]: (data[n.key] || 0) + n.step })}>
              <Ionicons name="add" size={16} color={C.text} />
            </Pressable>
          </View>
        </View>
      ))}

      {dirty ? (
        <View style={styles.saveBar}>
          <Text style={styles.unsaved}>You have unsaved changes</Text>
          <Pressable testID="settings-save" style={styles.saveBtn} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Changes</Text>}
          </Pressable>
        </View>
      ) : null}
      <View style={{ height: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: C.text, fontSize: 22, fontWeight: "800" },
  sub: { color: C.muted, fontSize: 12, marginTop: 2, marginBottom: SP.md },
  section: { color: C.violet, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginTop: SP.md, marginBottom: SP.sm },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: C.cardAlt, borderRadius: 10, padding: SP.md, marginBottom: SP.sm, borderWidth: 1, borderColor: C.border },
  rowLabel: { color: C.text, fontSize: 14, fontWeight: "600" },
  rowDesc: { color: C.muted, fontSize: 11, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  stepVal: { color: C.text, fontSize: 15, fontWeight: "800", minWidth: 34, textAlign: "center" },
  saveBar: { backgroundColor: C.card, borderRadius: 12, padding: SP.md, borderWidth: 1, borderColor: C.violet, marginTop: SP.md },
  unsaved: { color: C.amber, fontSize: 12, fontWeight: "700", marginBottom: SP.sm },
  saveBtn: { backgroundColor: C.violet, borderRadius: 9999, height: 48, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#fff", fontWeight: "800" },
});
