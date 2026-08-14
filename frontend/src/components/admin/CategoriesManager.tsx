import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { adminApi } from "@/src/services/api";
import { C, SP } from "./adminTheme";

const SWATCHES = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#22c55e", "#a855f7"];

export default function CategoriesManager({ onToast }: { onToast: (m: string) => void }) {
  const [cats, setCats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const c = await adminApi.categories().catch(() => []);
    setCats(c); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!name.trim()) { onToast("Enter a category name"); return; }
    setSaving(true);
    try { await adminApi.createCategory({ name: name.trim(), color }); setName(""); onToast("Category added"); await load(); }
    catch (e: any) { onToast(e.message); } finally { setSaving(false); }
  };
  const remove = async (id: string) => {
    try { await adminApi.deleteCategory(id); onToast("Category deleted"); await load(); }
    catch (e: any) { onToast(e.message); }
  };

  if (loading) return <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} />;

  return (
    <View>
      <Text style={styles.title}>Categories</Text>
      <Text style={styles.sub}>Define categories used when creating albums</Text>

      <View style={styles.addCard}>
        <TextInput testID="cat-name" style={styles.input} value={name} onChangeText={setName} placeholder="New category name" placeholderTextColor={C.muted} />
        <View style={styles.swatchRow}>
          {SWATCHES.map((s) => (
            <Pressable key={s} testID={`swatch-${s}`} onPress={() => setColor(s)} style={[styles.swatch, { backgroundColor: s }, color === s && styles.swatchOn]} />
          ))}
        </View>
        <Pressable testID="cat-add" style={styles.addBtn} onPress={add} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <><Ionicons name="add" size={18} color="#fff" /><Text style={styles.addText}>Add Category</Text></>}
        </Pressable>
      </View>

      <Text style={styles.count}>{cats.length} categories</Text>
      {cats.map((c) => (
        <View key={c.category_id} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: c.color || C.violet }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{c.name}</Text>
            <Text style={styles.meta}>{c.album_count || 0} albums</Text>
          </View>
          <Pressable testID={`cat-del-${c.category_id}`} hitSlop={10} onPress={() => remove(c.category_id)}>
            <Ionicons name="trash-outline" size={18} color={C.red} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: C.text, fontSize: 22, fontWeight: "800" },
  sub: { color: C.muted, fontSize: 12, marginTop: 2, marginBottom: SP.md },
  addCard: { backgroundColor: C.cardAlt, borderRadius: 12, padding: SP.md, borderWidth: 1, borderColor: C.border, marginBottom: SP.lg },
  input: { backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: SP.md, height: 46, color: C.text, borderWidth: 1, borderColor: C.border },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginVertical: SP.md },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  swatchOn: { borderWidth: 3, borderColor: "#fff" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: C.violet, borderRadius: 9999, height: 46 },
  addText: { color: "#fff", fontWeight: "800", marginLeft: 4 },
  count: { color: C.sub, fontSize: 12, fontWeight: "700", marginBottom: SP.sm },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: C.cardAlt, borderRadius: 10, padding: SP.md, marginBottom: SP.sm, borderWidth: 1, borderColor: C.border },
  dot: { width: 14, height: 14, borderRadius: 7, marginRight: SP.md },
  name: { color: C.text, fontSize: 15, fontWeight: "700" },
  meta: { color: C.muted, fontSize: 11, marginTop: 2 },
});
