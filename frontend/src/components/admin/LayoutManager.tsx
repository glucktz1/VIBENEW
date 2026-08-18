import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { adminApi } from "@/src/services/api";
import { C, SP } from "./adminTheme";

export default function LayoutManager({ onToast }: { onToast: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [genres, setGenres] = useState<any[]>([]); // { id, name, enabled }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingGenres, setSavingGenres] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await adminApi.homeLayout().catch(() => ({ rows: [] }));
    setRows(d.rows || []);
    const g = await adminApi.homeGenres().catch(() => ({ categories: [], selected: [] }));
    const selected: string[] = g.selected || [];
    const byId: Record<string, any> = {};
    (g.categories || []).forEach((c: any) => { byId[c.category_id] = c; });
    const ordered: any[] = [];
    selected.forEach((id) => { if (byId[id]) { ordered.push({ id, name: byId[id].name, enabled: true }); delete byId[id]; } });
    Object.values(byId).forEach((c: any) => ordered.push({ id: c.category_id, name: c.name, enabled: false }));
    setGenres(ordered);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const move = (list: any[], set: any, i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };
  const toggleRow = (i: number) => setRows(rows.map((r, idx) => (idx === i ? { ...r, enabled: !(r.enabled !== false) } : r)));
  const toggleGenre = (i: number) => setGenres(genres.map((g, idx) => (idx === i ? { ...g, enabled: !g.enabled } : g)));

  const save = async () => {
    setSaving(true);
    try { await adminApi.setHomeLayout(rows); onToast("Home layout saved"); }
    catch (e: any) { onToast(e.message); } finally { setSaving(false); }
  };

  const saveGenres = async () => {
    setSavingGenres(true);
    try {
      const ids = genres.filter((g) => g.enabled).map((g) => g.id);
      await adminApi.setHomeGenres(ids);
      onToast("Filter pills saved");
    } catch (e: any) { onToast(e.message); } finally { setSavingGenres(false); }
  };

  const [seeding, setSeeding] = useState(false);
  const seed = async () => {
    setSeeding(true);
    try {
      const res = await adminApi.seedGenres();
      onToast(res.created?.length ? `Added: ${res.created.join(", ")}` : "All default genres already exist");
      await load();
    } catch (e: any) { onToast(e.message); } finally { setSeeding(false); }
  };

  if (loading) return <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} />;

  const enabledGenreCount = genres.filter((g) => g.enabled).length;

  return (
    <View>
      <Text style={styles.title}>Layout Management</Text>
      <Text style={styles.sub}>Reorder and show/hide the rows on the app home screen.</Text>
      {rows.map((r, i) => (
        <View key={r.id} style={styles.row}>
          <View style={styles.arrows}>
            <Pressable testID={`layout-up-${r.id}`} onPress={() => move(rows, setRows, i, -1)} hitSlop={6}><Ionicons name="chevron-up" size={18} color={i === 0 ? C.border : C.sub} /></Pressable>
            <Pressable testID={`layout-down-${r.id}`} onPress={() => move(rows, setRows, i, 1)} hitSlop={6}><Ionicons name="chevron-down" size={18} color={i === rows.length - 1 ? C.border : C.sub} /></Pressable>
          </View>
          <View style={{ flex: 1, marginLeft: SP.sm }}>
            <Text style={styles.rowTitle}>{r.title}</Text>
            <Text style={styles.rowId}>{r.id}</Text>
          </View>
          <Switch testID={`layout-toggle-${r.id}`} value={r.enabled !== false} onValueChange={() => toggleRow(i)} trackColor={{ true: C.violet, false: C.border }} thumbColor="#fff" />
        </View>
      ))}
      <Pressable testID="layout-save" style={styles.saveBtn} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Save Layout</Text>}
      </Pressable>

      <View style={styles.divider} />

      <Text style={styles.title}>Filter Pills (Genres)</Text>
      <Text style={styles.sub}>Choose which categories appear as filter pills below Quick Access on Home. Order them with the arrows. {enabledGenreCount} shown.</Text>
      <Pressable testID="seed-genres" style={styles.seedBtn} onPress={seed} disabled={seeding}>
        {seeding ? <ActivityIndicator color={C.violet} /> : <><Ionicons name="add-circle" size={16} color={C.violet} /><Text style={styles.seedTxt}>Add default genres (Bongo Hits, Gospel, R&B, Amapiano, Taarabu)</Text></>}
      </Pressable>
      {genres.length === 0 ? <Text style={styles.empty}>No categories yet. Add some under Contents → Categories.</Text> : null}
      {genres.map((g, i) => (
        <View key={g.id} style={[styles.row, !g.enabled && styles.rowOff]}>
          <View style={styles.arrows}>
            <Pressable testID={`genre-up-${g.id}`} onPress={() => move(genres, setGenres, i, -1)} hitSlop={6}><Ionicons name="chevron-up" size={18} color={i === 0 ? C.border : C.sub} /></Pressable>
            <Pressable testID={`genre-down-${g.id}`} onPress={() => move(genres, setGenres, i, 1)} hitSlop={6}><Ionicons name="chevron-down" size={18} color={i === genres.length - 1 ? C.border : C.sub} /></Pressable>
          </View>
          <View style={{ flex: 1, marginLeft: SP.sm }}>
            <Text style={styles.rowTitle}>{g.name}</Text>
            <Text style={styles.rowId}>{g.id}</Text>
          </View>
          <Switch testID={`genre-toggle-${g.id}`} value={g.enabled} onValueChange={() => toggleGenre(i)} trackColor={{ true: C.violet, false: C.border }} thumbColor="#fff" />
        </View>
      ))}
      <Pressable testID="genres-save" style={styles.saveBtn} onPress={saveGenres} disabled={savingGenres}>
        {savingGenres ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Save Filter Pills</Text>}
      </Pressable>
      <View style={{ height: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: C.text, fontSize: 22, fontWeight: "800" },
  sub: { color: C.muted, fontSize: 12, marginTop: 2, marginBottom: SP.md },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: C.cardAlt, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: SP.md, marginBottom: SP.sm },
  rowOff: { opacity: 0.55 },
  arrows: { alignItems: "center" },
  rowTitle: { color: C.text, fontSize: 15, fontWeight: "700" },
  rowId: { color: C.muted, fontSize: 11, marginTop: 2 },
  empty: { color: C.muted, fontSize: 12, marginBottom: SP.sm },
  divider: { height: 1, backgroundColor: C.border, marginVertical: SP.lg },
  saveBtn: { backgroundColor: C.violet, borderRadius: 9999, height: 48, alignItems: "center", justifyContent: "center", marginTop: SP.md },
  saveTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
  seedBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.violet + "22", borderWidth: 1, borderColor: C.violet, borderRadius: 10, minHeight: 44, paddingHorizontal: SP.md, paddingVertical: SP.sm, marginBottom: SP.sm },
  seedTxt: { color: C.violet, fontWeight: "800", fontSize: 12, flexShrink: 1 },
});
