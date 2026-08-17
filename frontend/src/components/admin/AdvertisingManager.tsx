import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { adminApi } from "@/src/services/api";
import { C, SP } from "./adminTheme";

const TYPES = ["banner", "interstitial", "audio"];
const PLACES = ["home", "player", "search"];

export default function AdvertisingManager({ onToast }: { onToast: (m: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({ title: "", type: "banner", image_url: "", target_url: "", placement: "home", status: "active" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => { setData(await adminApi.campaigns().catch(() => ({ summary: {}, campaigns: [] }))); }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.title.trim()) { onToast("Title required"); return; }
    setSaving(true);
    try { await adminApi.createCampaign(form); setShow(false); setForm({ title: "", type: "banner", image_url: "", target_url: "", placement: "home", status: "active" }); onToast("Campaign created"); await load(); }
    catch (e: any) { onToast(e.message); } finally { setSaving(false); }
  };
  const toggle = async (c: any) => {
    const next = c.status === "active" ? "paused" : "active";
    try { await adminApi.updateCampaign(c.campaign_id, { status: next }); onToast(next); await load(); } catch (e: any) { onToast(e.message); }
  };
  const remove = async (c: any) => { try { await adminApi.deleteCampaign(c.campaign_id); onToast("Deleted"); await load(); } catch (e: any) { onToast(e.message); } };

  if (!data) return <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} />;
  const s = data.summary || {};

  return (
    <View>
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>In-App Notifications</Text>
          <Text style={styles.sub}>Manage in-app ad campaigns & placements</Text>
        </View>
        <Pressable testID="ad-create" style={styles.createBtn} onPress={() => setShow(true)}>
          <Ionicons name="add" size={18} color="#fff" /><Text style={styles.createText}>New</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {[["Total", s.total || 0], ["Active", s.active || 0], ["Impressions", s.impressions || 0], ["Clicks", s.clicks || 0]].map(([l, v]) => (
          <View key={l as string} style={styles.stat}><Text style={styles.statLabel}>{l}</Text><Text style={styles.statVal}>{Number(v).toLocaleString()}</Text></View>
        ))}
      </View>

      {data.campaigns.length === 0 ? <Text style={styles.empty}>No campaigns yet. Create your first one.</Text> : null}
      {data.campaigns.map((c: any) => (
        <View key={c.campaign_id} style={styles.row}>
          <View style={[styles.typeIcon, { backgroundColor: C.violet + "22" }]}><Ionicons name={c.type === "audio" ? "volume-high" : c.type === "interstitial" ? "phone-portrait" : "image"} size={18} color={C.violet} /></View>
          <View style={{ flex: 1, marginLeft: SP.sm }}>
            <Text style={styles.rowTitle} numberOfLines={1}>{c.title}</Text>
            <Text style={styles.rowSub}>{c.type} · {c.placement} · {c.impressions || 0} views · {c.clicks || 0} clicks</Text>
          </View>
          <Pressable testID={`ad-toggle-${c.campaign_id}`} style={[styles.pill, { borderColor: c.status === "active" ? C.emerald : C.amber }]} onPress={() => toggle(c)}>
            <Text style={[styles.pillText, { color: c.status === "active" ? C.emerald : C.amber }]}>{c.status}</Text>
          </Pressable>
          <Pressable testID={`ad-del-${c.campaign_id}`} hitSlop={8} onPress={() => remove(c)} style={{ marginLeft: 8 }}><Ionicons name="trash-outline" size={18} color={C.red} /></Pressable>
        </View>
      ))}

      <Modal transparent visible={show} animationType="slide" onRequestClose={() => setShow(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>New Campaign</Text>
            <Text style={styles.label}>Title</Text>
            <TextInput testID="ad-title" style={styles.input} value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} placeholder="Campaign title" placeholderTextColor={C.muted} />
            <Text style={styles.label}>Type</Text>
            <View style={styles.wrap}>{TYPES.map((t) => <Pressable key={t} testID={`ad-type-${t}`} style={[styles.pick, form.type === t && styles.pickOn]} onPress={() => setForm({ ...form, type: t })}><Text style={[styles.pickText, form.type === t && { color: "#fff" }]}>{t}</Text></Pressable>)}</View>
            <Text style={styles.label}>Placement</Text>
            <View style={styles.wrap}>{PLACES.map((t) => <Pressable key={t} testID={`ad-place-${t}`} style={[styles.pick, form.placement === t && styles.pickOn]} onPress={() => setForm({ ...form, placement: t })}><Text style={[styles.pickText, form.placement === t && { color: "#fff" }]}>{t}</Text></Pressable>)}</View>
            <Text style={styles.label}>Image URL (optional)</Text>
            <TextInput testID="ad-image" style={styles.input} value={form.image_url} onChangeText={(v) => setForm({ ...form, image_url: v })} placeholder="https://..." placeholderTextColor={C.muted} autoCapitalize="none" />
            <Text style={styles.label}>Target URL (optional)</Text>
            <TextInput testID="ad-target" style={styles.input} value={form.target_url} onChangeText={(v) => setForm({ ...form, target_url: v })} placeholder="https://..." placeholderTextColor={C.muted} autoCapitalize="none" />
            <Pressable testID="ad-save" style={styles.saveBtn} onPress={create} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Create Campaign</Text>}</Pressable>
            <Pressable style={styles.cancel} onPress={() => setShow(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: SP.md },
  title: { color: C.text, fontSize: 22, fontWeight: "800" },
  sub: { color: C.muted, fontSize: 12, marginTop: 2 },
  createBtn: { flexDirection: "row", alignItems: "center", backgroundColor: C.violet, borderRadius: 9999, paddingHorizontal: SP.md, height: 40 },
  createText: { color: "#fff", fontWeight: "800", marginLeft: 4, fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: SP.md },
  stat: { width: "48.5%", backgroundColor: C.cardAlt, borderRadius: 10, padding: SP.md, marginBottom: SP.sm, borderWidth: 1, borderColor: C.border },
  statLabel: { color: C.muted, fontSize: 11 },
  statVal: { color: C.text, fontSize: 20, fontWeight: "800", marginTop: 4 },
  empty: { color: C.muted, textAlign: "center", paddingVertical: SP.xl },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: C.cardAlt, borderRadius: 10, padding: SP.sm, marginBottom: SP.sm, borderWidth: 1, borderColor: C.border },
  typeIcon: { width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: C.text, fontSize: 14, fontWeight: "700" },
  rowSub: { color: C.sub, fontSize: 11, marginTop: 2 },
  pill: { borderWidth: 1, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: SP.lg, maxHeight: "90%" },
  sheetTitle: { color: C.text, fontSize: 18, fontWeight: "800", marginBottom: SP.sm },
  label: { color: C.sub, fontSize: 12, fontWeight: "700", marginTop: SP.md, marginBottom: 6 },
  input: { backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: SP.md, height: 46, color: C.text, borderWidth: 1, borderColor: C.border },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pick: { paddingHorizontal: 14, height: 34, borderRadius: 8, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  pickOn: { backgroundColor: C.violet, borderColor: C.violet },
  pickText: { color: C.sub, fontWeight: "700", fontSize: 12, textTransform: "capitalize" },
  saveBtn: { backgroundColor: C.violet, borderRadius: 9999, height: 50, alignItems: "center", justifyContent: "center", marginTop: SP.lg },
  saveText: { color: "#fff", fontWeight: "800" },
  cancel: { alignItems: "center", paddingVertical: SP.md },
  cancelText: { color: C.muted },
});
