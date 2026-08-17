import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { adminApi } from "@/src/services/api";
import { C, SP } from "./adminTheme";

const ALGOS = [
  { key: "trending", label: "Trending", desc: "Most played right now" },
  { key: "collaborative", label: "Collaborative", desc: "Based on similar listeners" },
  { key: "hybrid", label: "Hybrid", desc: "Blend of trending + personal" },
];
const WEIGHTS = [
  { key: "trending_weight", label: "Trending Weight" },
  { key: "recency_weight", label: "Recency Weight" },
  { key: "personalization_weight", label: "Personalization Weight" },
];
const TOGGLES = [
  { key: "enabled", label: "Engine Enabled", desc: "Serve personalised recommendations" },
  { key: "include_new_artists", label: "Include New Artists", desc: "Surface newly-approved artists" },
  { key: "boost_local_content", label: "Boost Local Content", desc: "Prioritise content from user's country" },
];

export default function RecommendationManager({ onToast }: { onToast: (m: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [orig, setOrig] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => { const r = await adminApi.recommendations().catch(() => null); setData(r); setOrig(JSON.stringify(r)); }, []);
  useEffect(() => { load(); }, [load]);

  const dirty = data && JSON.stringify(data) !== orig;
  const save = async () => {
    setSaving(true);
    try { const u = await adminApi.updateRecommendations(data); setData(u); setOrig(JSON.stringify(u)); onToast("Saved"); }
    catch (e: any) { onToast(e.message); } finally { setSaving(false); }
  };
  const bump = (k: string, d: number) => setData({ ...data, [k]: Math.max(0, Math.min(100, (data[k] || 0) + d)) });

  if (!data) return <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} />;

  return (
    <View>
      <Text style={styles.title}>Recommendation Engine</Text>
      <Text style={styles.sub}>Tune how the app suggests music to listeners</Text>

      {TOGGLES.map((t) => (
        <View key={t.key} style={styles.row}>
          <View style={{ flex: 1, paddingRight: SP.sm }}>
            <Text style={styles.rowLabel}>{t.label}</Text><Text style={styles.rowDesc}>{t.desc}</Text>
          </View>
          <Switch testID={`rec-${t.key}`} value={!!data[t.key]} onValueChange={(v) => setData({ ...data, [t.key]: v })} trackColor={{ true: C.violet, false: C.border }} thumbColor="#fff" />
        </View>
      ))}

      <Text style={styles.section}>Algorithm</Text>
      <View style={styles.wrap}>
        {ALGOS.map((a) => (
          <Pressable key={a.key} testID={`rec-algo-${a.key}`} style={[styles.algo, data.algorithm === a.key && styles.algoOn]} onPress={() => setData({ ...data, algorithm: a.key })}>
            <Text style={[styles.algoLabel, data.algorithm === a.key && { color: "#fff" }]}>{a.label}</Text>
            <Text style={[styles.algoDesc, data.algorithm === a.key && { color: "rgba(255,255,255,0.8)" }]}>{a.desc}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Ranking Weights (%)</Text>
      {WEIGHTS.map((w) => (
        <View key={w.key} style={styles.row}>
          <Text style={[styles.rowLabel, { flex: 1 }]}>{w.label}</Text>
          <View style={styles.stepper}>
            <Pressable testID={`rec-dec-${w.key}`} style={styles.stepBtn} onPress={() => bump(w.key, -5)}><Ionicons name="remove" size={16} color={C.text} /></Pressable>
            <Text style={styles.stepVal}>{data[w.key]}</Text>
            <Pressable testID={`rec-inc-${w.key}`} style={styles.stepBtn} onPress={() => bump(w.key, 5)}><Ionicons name="add" size={16} color={C.text} /></Pressable>
          </View>
        </View>
      ))}
      <View style={styles.row}>
        <Text style={[styles.rowLabel, { flex: 1 }]}>Max Recommendations</Text>
        <View style={styles.stepper}>
          <Pressable testID="rec-dec-max" style={styles.stepBtn} onPress={() => setData({ ...data, max_recommendations: Math.max(5, data.max_recommendations - 5) })}><Ionicons name="remove" size={16} color={C.text} /></Pressable>
          <Text style={styles.stepVal}>{data.max_recommendations}</Text>
          <Pressable testID="rec-inc-max" style={styles.stepBtn} onPress={() => setData({ ...data, max_recommendations: data.max_recommendations + 5 })}><Ionicons name="add" size={16} color={C.text} /></Pressable>
        </View>
      </View>

      {dirty ? (
        <View style={styles.saveBar}>
          <Text style={styles.unsaved}>You have unsaved changes</Text>
          <Pressable testID="rec-save" style={styles.saveBtn} onPress={save} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Changes</Text>}</Pressable>
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
  wrap: { gap: SP.sm },
  algo: { backgroundColor: C.cardAlt, borderRadius: 10, padding: SP.md, borderWidth: 1, borderColor: C.border, marginBottom: SP.sm },
  algoOn: { backgroundColor: C.violet, borderColor: C.violet },
  algoLabel: { color: C.text, fontSize: 14, fontWeight: "800" },
  algoDesc: { color: C.muted, fontSize: 11, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  stepVal: { color: C.text, fontSize: 15, fontWeight: "800", minWidth: 34, textAlign: "center" },
  saveBar: { backgroundColor: C.card, borderRadius: 12, padding: SP.md, borderWidth: 1, borderColor: C.violet, marginTop: SP.md },
  unsaved: { color: C.amber, fontSize: 12, fontWeight: "700", marginBottom: SP.sm },
  saveBtn: { backgroundColor: C.violet, borderRadius: 9999, height: 48, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#fff", fontWeight: "800" },
});
