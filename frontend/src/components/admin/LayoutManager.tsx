import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { adminApi } from "@/src/services/api";
import { C, SP } from "./adminTheme";

export default function LayoutManager({ onToast }: { onToast: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await adminApi.homeLayout().catch(() => ({ rows: [] }));
    setRows(d.rows || []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  };
  const toggle = (i: number) => setRows(rows.map((r, idx) => (idx === i ? { ...r, enabled: !(r.enabled !== false) } : r)));

  const save = async () => {
    setSaving(true);
    try { await adminApi.setHomeLayout(rows); onToast("Home layout saved"); }
    catch (e: any) { onToast(e.message); } finally { setSaving(false); }
  };

  if (loading) return <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} />;

  return (
    <View>
      <Text style={styles.title}>Layout Management</Text>
      <Text style={styles.sub}>Reorder and show/hide the rows on the app home screen.</Text>
      {rows.map((r, i) => (
        <View key={r.id} style={styles.row}>
          <View style={styles.arrows}>
            <Pressable testID={`layout-up-${r.id}`} onPress={() => move(i, -1)} hitSlop={6}><Ionicons name="chevron-up" size={18} color={i === 0 ? C.border : C.sub} /></Pressable>
            <Pressable testID={`layout-down-${r.id}`} onPress={() => move(i, 1)} hitSlop={6}><Ionicons name="chevron-down" size={18} color={i === rows.length - 1 ? C.border : C.sub} /></Pressable>
          </View>
          <View style={{ flex: 1, marginLeft: SP.sm }}>
            <Text style={styles.rowTitle}>{r.title}</Text>
            <Text style={styles.rowId}>{r.id}</Text>
          </View>
          <Switch testID={`layout-toggle-${r.id}`} value={r.enabled !== false} onValueChange={() => toggle(i)} trackColor={{ true: C.violet, false: C.border }} thumbColor="#fff" />
        </View>
      ))}
      <Pressable testID="layout-save" style={styles.saveBtn} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Save Layout</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: C.text, fontSize: 22, fontWeight: "800" },
  sub: { color: C.muted, fontSize: 12, marginTop: 2, marginBottom: SP.md },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: C.cardAlt, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: SP.md, marginBottom: SP.sm },
  arrows: { alignItems: "center" },
  rowTitle: { color: C.text, fontSize: 15, fontWeight: "700" },
  rowId: { color: C.muted, fontSize: 11, marginTop: 2 },
  saveBtn: { backgroundColor: C.violet, borderRadius: 9999, height: 48, alignItems: "center", justifyContent: "center", marginTop: SP.md },
  saveTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
