import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { adminApi } from "@/src/services/api";
import { C, SP } from "./adminTheme";

const TEMPLATE = {
  en: { "profile.language": "Language", "home.madeForYou": "Made for You" },
  sw: { "profile.language": "Lugha", "home.madeForYou": "Kwa Ajili Yako" },
};

export default function TranslationsManager({ onToast }: { onToast: (m: string) => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [langs, setLangs] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await adminApi.translationsAdmin();
      const obj = data && Object.keys(data).length ? data : TEMPLATE;
      setText(JSON.stringify(obj, null, 2));
      setLangs(Object.keys(obj));
    } catch { setText(JSON.stringify(TEMPLATE, null, 2)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain"], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      const uri = res.assets[0].uri;
      let content = "";
      if (Platform.OS === "web") { const r = await fetch(uri); content = await r.text(); }
      else { content = await FileSystem.readAsStringAsync(uri); }
      // validate
      JSON.parse(content);
      setText(content);
      onToast("File loaded — review then Save");
    } catch (e: any) { onToast("Invalid JSON file"); }
  };

  const save = async () => {
    let parsed: any;
    try { parsed = JSON.parse(text); }
    catch { onToast("Invalid JSON — check the format"); return; }
    if (typeof parsed !== "object" || Array.isArray(parsed)) { onToast("JSON must be an object of languages"); return; }
    setSaving(true);
    try {
      const res = await adminApi.setTranslations(parsed);
      setLangs(res.languages || Object.keys(parsed));
      onToast("Translations saved");
    } catch (e: any) { onToast(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <ActivityIndicator color={C.violet} style={{ marginTop: SP.lg }} />;

  return (
    <View>
      <Text style={styles.section}>Language & Translations</Text>
      <Text style={styles.sectionDesc}>Upload a JSON file (or paste below) mapping keys to translated text per language code. Built-in Swahili & English are always available; this overrides/extends them and can add new languages.</Text>

      <View style={styles.langRow}>
        <Ionicons name="globe" size={14} color={C.sub} />
        <Text style={styles.langText}>Active languages: {langs.length ? langs.join(", ") : "sw, en (built-in)"}</Text>
      </View>

      <Pressable testID="tr-upload" style={styles.uploadBtn} onPress={pickFile}>
        <Ionicons name="cloud-upload" size={16} color={C.violet} />
        <Text style={styles.uploadText}>Upload .json file</Text>
      </Pressable>

      <Text style={styles.label}>Translations JSON</Text>
      <TextInput
        testID="tr-json"
        style={styles.area}
        value={text}
        onChangeText={setText}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        placeholder='{ "en": { "profile.language": "Language" }, "sw": { ... } }'
        placeholderTextColor={C.muted}
      />

      <Pressable testID="tr-save" style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Translations</Text>}
      </Pressable>
      <View style={{ height: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { color: C.violet, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginTop: SP.md },
  sectionDesc: { color: C.muted, fontSize: 11, marginTop: 2, marginBottom: SP.sm, lineHeight: 16 },
  langRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.cardAlt, borderRadius: 8, padding: SP.sm, borderWidth: 1, borderColor: C.border, marginBottom: SP.sm },
  langText: { color: C.text, fontSize: 12, fontWeight: "600" },
  uploadBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.violet + "22", borderRadius: 8, height: 44, borderWidth: 1, borderColor: C.violet, marginBottom: SP.md },
  uploadText: { color: C.violet, fontWeight: "800", fontSize: 13 },
  label: { color: C.sub, fontSize: 12, fontWeight: "700", marginBottom: 6 },
  area: { minHeight: 220, backgroundColor: C.bg, borderRadius: 8, borderWidth: 1, borderColor: C.border, color: C.text, padding: SP.md, fontSize: 12, textAlignVertical: "top", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  saveBtn: { backgroundColor: C.violet, borderRadius: 9999, height: 50, alignItems: "center", justifyContent: "center", marginTop: SP.md },
  saveText: { color: "#fff", fontWeight: "800" },
});
