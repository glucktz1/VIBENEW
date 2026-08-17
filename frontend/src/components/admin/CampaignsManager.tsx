import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, Modal, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { adminApi } from "@/src/services/api";
import { C, SP } from "./adminTheme";

const TYPES: { key: string; label: string; icon: string }[] = [
  { key: "sms", label: "SMS", icon: "chatbox-ellipses" },
  { key: "push", label: "Push", icon: "notifications" },
  { key: "in_app", label: "In-App", icon: "megaphone" },
  { key: "email", label: "Email", icon: "mail" },
];
const PLANS = [["all", "All"], ["free", "Free"], ["premium", "Premium"]] as const;
const ACTIVITY = [
  ["all", "Any activity"],
  ["active_7", "Active (7d)"],
  ["inactive_7", "Inactive 7d+"],
  ["inactive_30", "Inactive 30d+"],
  ["inactive_90", "Inactive 90d+"],
] as const;
const CONTENT = [["any", "Any"], ["listened", "Listened to"], ["not_listened", "Not listened to"]] as const;

const EMPTY_FILTER = { plan: "all", country: "all", region: "", activity: "all", content_mode: "any", content_type: "", content_id: "", content_label: "" };

function relTime(iso?: string | null): string {
  if (!iso) return "Never active";
  const d = new Date(iso).getTime();
  if (isNaN(d)) return "Never active";
  const diff = Date.now() - d;
  const day = 86400000;
  if (diff < 3600000) return "Active <1h ago";
  if (diff < day) return `Active ${Math.floor(diff / 3600000)}h ago`;
  const days = Math.floor(diff / day);
  if (days < 30) return `Active ${days}d ago`;
  if (days < 365) return `Active ${Math.floor(days / 30)}mo ago`;
  return `Active ${Math.floor(days / 365)}y ago`;
}

export default function CampaignsManager({ onToast }: { onToast: (m: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState<string[]>([]);

  // create form
  const [name, setName] = useState("");
  const [type, setType] = useState("sms");
  const [title, setTitle] = useState("");
  const [bodyMsg, setBodyMsg] = useState("");
  const [schedule, setSchedule] = useState("");
  const [filter, setFilter] = useState<any>({ ...EMPTY_FILTER });

  // content search
  const [contentQ, setContentQ] = useState("");
  const [contentRes, setContentRes] = useState<{ albums: any[]; songs: any[] }>({ albums: [], songs: [] });

  // preview
  const [preview, setPreview] = useState<{ total: number; with_phone: number; users: any[] } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const debRef = useRef<any>(null);

  const load = useCallback(async () => {
    setData(await adminApi.marketingCampaigns().catch(() => ({ summary: {}, campaigns: [] })));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { adminApi.userCountries().then(setCountries).catch(() => {}); }, []);

  const runPreview = useCallback(async (f: any) => {
    setPreviewing(true);
    try { setPreview(await adminApi.audiencePreview(f)); }
    catch { setPreview({ total: 0, with_phone: 0, users: [] }); }
    finally { setPreviewing(false); }
  }, []);

  // auto preview when filter changes (debounced), while modal open
  useEffect(() => {
    if (!show) return;
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => runPreview(filter), 450);
    return () => debRef.current && clearTimeout(debRef.current);
  }, [filter, show, runPreview]);

  // content search debounce
  useEffect(() => {
    if (filter.content_mode === "any") return;
    if (!contentQ.trim()) { setContentRes({ albums: [], songs: [] }); return; }
    const t = setTimeout(async () => {
      try { setContentRes(await adminApi.contentSearch(contentQ)); } catch { setContentRes({ albums: [], songs: [] }); }
    }, 350);
    return () => clearTimeout(t);
  }, [contentQ, filter.content_mode]);

  const resetForm = () => {
    setName(""); setType("sms"); setTitle(""); setBodyMsg(""); setSchedule("");
    setFilter({ ...EMPTY_FILTER }); setContentQ(""); setContentRes({ albums: [], songs: [] });
    setPreview(null); setSelected(new Set());
  };
  const openNew = () => { resetForm(); setShow(true); };

  const toggleUser = (uid: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(uid) ? n.delete(uid) : n.add(uid); return n; });
  };

  const targetableUsers = useMemo(() => {
    if (!preview) return [];
    return type === "sms" ? preview.users.filter((u) => u.phone) : preview.users;
  }, [preview, type]);

  const targetCount = selected.size > 0 ? selected.size : targetableUsers.length;

  const create = async () => {
    if (!name.trim()) { onToast("Campaign name required"); return; }
    if (!bodyMsg.trim()) { onToast("Message body required"); return; }
    if (targetCount === 0) { onToast("No matching users to send to"); return; }
    setSaving(true);
    try {
      const f = { ...filter, user_ids: selected.size > 0 ? Array.from(selected) : [] };
      const res = await adminApi.createMarketingCampaign({
        name, type, title, body: bodyMsg, filter: f, schedule_at: schedule.trim() || null,
      });
      onToast(schedule.trim() ? `Scheduled for ${targetCount} users` : `Sent to ${res.sent} users (simulated)`);
      setShow(false); resetForm(); await load();
    } catch (e: any) { onToast(e.message); } finally { setSaving(false); }
  };

  const remove = async (c: any) => {
    try { await adminApi.deleteMarketingCampaign(c.campaign_id); onToast("Deleted"); await load(); }
    catch (e: any) { onToast(e.message); }
  };

  if (!data) return <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} />;
  const s = data.summary || {};

  const pickContent = (item: any, kind: "album" | "song") => {
    setFilter({
      ...filter,
      content_type: kind,
      content_id: kind === "album" ? item.album_id : item.song_id,
      content_label: `${item.title}${item.artist_name ? " · " + item.artist_name : ""}`,
    });
    setContentQ(""); setContentRes({ albums: [], songs: [] });
  };

  return (
    <View>
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Marketing Campaigns</Text>
          <Text style={styles.sub}>Target users by activity & content, then send SMS</Text>
        </View>
        <Pressable testID="mc-create" style={styles.createBtn} onPress={openNew}>
          <Ionicons name="add" size={18} color="#fff" /><Text style={styles.createText}>New</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {[["Total", s.total || 0], ["Sent", s.sent || 0], ["Scheduled", s.scheduled || 0], ["Recipients", s.recipients || 0]].map(([l, v]) => (
          <View key={l as string} style={styles.stat}><Text style={styles.statLabel}>{l}</Text><Text style={styles.statVal}>{Number(v).toLocaleString()}</Text></View>
        ))}
      </View>

      {data.campaigns.length === 0 ? <Text style={styles.empty}>No campaigns yet. Create your first one.</Text> : null}
      {data.campaigns.map((c: any) => {
        const t = TYPES.find((x) => x.key === c.type) || TYPES[0];
        return (
          <View key={c.campaign_id} style={styles.row}>
            <View style={[styles.typeIcon, { backgroundColor: C.violet + "22" }]}><Ionicons name={t.icon as any} size={18} color={C.violet} /></View>
            <View style={{ flex: 1, marginLeft: SP.sm }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{c.name}</Text>
              <Text style={styles.rowSub}>{t.label} · {c.recipient_count || 0} recipients{c.delivery === "simulated" ? " · simulated" : ""}</Text>
            </View>
            <View style={[styles.pill, { borderColor: c.status === "sent" ? C.emerald : C.amber }]}>
              <Text style={[styles.pillText, { color: c.status === "sent" ? C.emerald : C.amber }]}>{c.status}</Text>
            </View>
            <Pressable testID={`mc-del-${c.campaign_id}`} hitSlop={8} onPress={() => remove(c)} style={{ marginLeft: 8 }}><Ionicons name="trash-outline" size={18} color={C.red} /></Pressable>
          </View>
        );
      })}

      <Modal transparent visible={show} animationType="slide" onRequestClose={() => setShow(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Create Campaign</Text>
                <Text style={styles.sheetSub}>Send targeted messages to your users</Text>
              </View>
              <Pressable testID="mc-close" onPress={() => setShow(false)} hitSlop={10}><Ionicons name="close" size={22} color={C.text} /></Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SP.xl }} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Campaign Name *</Text>
              <TextInput testID="mc-name" style={styles.input} value={name} onChangeText={setName} placeholder="e.g., New Album Launch" placeholderTextColor={C.muted} />

              <Text style={styles.label}>Campaign Type *</Text>
              <View style={styles.wrap}>{TYPES.map((t) => (
                <Pressable key={t.key} testID={`mc-type-${t.key}`} style={[styles.pick, type === t.key && styles.pickOn]} onPress={() => setType(t.key)}>
                  <Ionicons name={t.icon as any} size={13} color={type === t.key ? "#fff" : C.sub} />
                  <Text style={[styles.pickText, type === t.key && { color: "#fff" }]}>{t.label}</Text>
                </Pressable>
              ))}</View>

              <Text style={styles.label}>Message Title</Text>
              <TextInput testID="mc-title" style={styles.input} value={title} onChangeText={setTitle} placeholder="Notification / SMS subject" placeholderTextColor={C.muted} />

              <Text style={styles.label}>Message Body *</Text>
              <TextInput testID="mc-body" style={[styles.input, styles.area]} value={bodyMsg} onChangeText={setBodyMsg} placeholder="Your message content..." placeholderTextColor={C.muted} multiline />

              <View style={styles.divider} />
              <View style={styles.audHead}><Ionicons name="people" size={16} color={C.violet} /><Text style={styles.audTitle}>Target Audience</Text></View>

              <Text style={styles.label}>Plan</Text>
              <View style={styles.wrap}>{PLANS.map(([k, l]) => (
                <Pressable key={k} testID={`mc-plan-${k}`} style={[styles.pick, filter.plan === k && styles.pickOn]} onPress={() => { setSelected(new Set()); setFilter({ ...filter, plan: k }); }}>
                  <Text style={[styles.pickText, filter.plan === k && { color: "#fff" }]}>{l}</Text>
                </Pressable>
              ))}</View>

              <Text style={styles.label}>Activity</Text>
              <View style={styles.wrap}>{ACTIVITY.map(([k, l]) => (
                <Pressable key={k} testID={`mc-act-${k}`} style={[styles.pick, filter.activity === k && styles.pickOn]} onPress={() => { setSelected(new Set()); setFilter({ ...filter, activity: k }); }}>
                  <Text style={[styles.pickText, filter.activity === k && { color: "#fff" }]}>{l}</Text>
                </Pressable>
              ))}</View>

              <Text style={styles.label}>Country</Text>
              <View style={styles.wrap}>
                <Pressable style={[styles.pick, filter.country === "all" && styles.pickOn]} onPress={() => { setSelected(new Set()); setFilter({ ...filter, country: "all" }); }}>
                  <Text style={[styles.pickText, filter.country === "all" && { color: "#fff" }]}>All</Text>
                </Pressable>
                {countries.map((co) => (
                  <Pressable key={co} style={[styles.pick, filter.country === co && styles.pickOn]} onPress={() => { setSelected(new Set()); setFilter({ ...filter, country: co }); }}>
                    <Text style={[styles.pickText, filter.country === co && { color: "#fff" }]}>{co}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Content Filter</Text>
              <View style={styles.wrap}>{CONTENT.map(([k, l]) => (
                <Pressable key={k} testID={`mc-content-${k}`} style={[styles.pick, filter.content_mode === k && styles.pickOn]} onPress={() => { setSelected(new Set()); setFilter({ ...filter, content_mode: k, ...(k === "any" ? { content_id: "", content_type: "", content_label: "" } : {}) }); }}>
                  <Text style={[styles.pickText, filter.content_mode === k && { color: "#fff" }]}>{l}</Text>
                </Pressable>
              ))}</View>

              {filter.content_mode !== "any" ? (
                <View style={{ marginTop: SP.sm }}>
                  {filter.content_id ? (
                    <View style={styles.chosen}>
                      <Ionicons name="musical-notes" size={14} color={C.violet} />
                      <Text style={styles.chosenText} numberOfLines={1}>{filter.content_label}</Text>
                      <Pressable hitSlop={8} onPress={() => { setSelected(new Set()); setFilter({ ...filter, content_id: "", content_type: "", content_label: "" }); }}><Ionicons name="close-circle" size={18} color={C.muted} /></Pressable>
                    </View>
                  ) : (
                    <>
                      <TextInput testID="mc-content-search" style={styles.input} value={contentQ} onChangeText={setContentQ} placeholder="Search songs or albums..." placeholderTextColor={C.muted} />
                      {(contentRes.albums.length > 0 || contentRes.songs.length > 0) ? (
                        <View style={styles.results}>
                          {contentRes.albums.map((a) => (
                            <Pressable key={a.album_id} testID={`mc-pick-album-${a.album_id}`} style={styles.resultRow} onPress={() => pickContent(a, "album")}>
                              <Ionicons name="albums" size={14} color={C.sub} />
                              <Text style={styles.resultText} numberOfLines={1}>{a.title} <Text style={styles.resultTag}>ALBUM</Text></Text>
                            </Pressable>
                          ))}
                          {contentRes.songs.map((so) => (
                            <Pressable key={so.song_id} testID={`mc-pick-song-${so.song_id}`} style={styles.resultRow} onPress={() => pickContent(so, "song")}>
                              <Ionicons name="musical-note" size={14} color={C.sub} />
                              <Text style={styles.resultText} numberOfLines={1}>{so.title} <Text style={styles.resultTag}>SONG</Text></Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </>
                  )}
                </View>
              ) : null}

              {/* Audience preview */}
              <View style={styles.previewHead}>
                <Ionicons name="people-circle" size={16} color={C.emerald} />
                <Text style={styles.previewCount}>
                  Target: <Text style={{ color: C.emerald }}>{targetCount} users</Text>
                  {type === "sms" && preview ? <Text style={styles.previewMuted}>  ({preview.with_phone} with phone)</Text> : null}
                </Text>
                {previewing ? <ActivityIndicator size="small" color={C.violet} style={{ marginLeft: 8 }} /> : null}
              </View>
              {selected.size > 0 ? (
                <Pressable testID="mc-clear-sel" style={styles.clearSel} onPress={() => setSelected(new Set())}>
                  <Text style={styles.clearSelText}>Custom selection: {selected.size} users · tap to clear & send to all</Text>
                </Pressable>
              ) : (
                <Text style={styles.selHint}>Tap users below to hand-pick a custom list (optional)</Text>
              )}

              <View style={styles.listBox}>
                {targetableUsers.length === 0 && !previewing ? (
                  <Text style={styles.emptyList}>No matching users for these filters.</Text>
                ) : null}
                {targetableUsers.slice(0, 200).map((u: any) => {
                  const on = selected.has(u.user_id);
                  const noPhone = type === "sms" && !u.phone;
                  return (
                    <Pressable key={u.user_id} testID={`mc-user-${u.user_id}`} style={[styles.userRow, on && styles.userRowOn]} onPress={() => toggleUser(u.user_id)}>
                      <Ionicons name={on ? "checkbox" : "square-outline"} size={18} color={on ? C.violet : C.muted} />
                      <View style={{ flex: 1, marginLeft: SP.sm }}>
                        <Text style={styles.userName} numberOfLines={1}>{u.name}</Text>
                        <Text style={styles.userMeta} numberOfLines={1}>
                          {u.phone ? u.phone : <Text style={{ color: C.amber }}>Hakuna simu</Text>} · {u.plan} · {u.country}
                        </Text>
                      </View>
                      <Text style={styles.userActive}>{relTime(u.last_active)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Schedule (optional)</Text>
              <TextInput testID="mc-schedule" style={styles.input} value={schedule} onChangeText={setSchedule} placeholder="YYYY-MM-DD HH:MM (leave empty to send now)" placeholderTextColor={C.muted} autoCapitalize="none" />

              <Pressable testID="mc-send" style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={create} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{schedule.trim() ? "Schedule Campaign" : `Send to ${targetCount} users`}</Text>}
              </Pressable>
              <Pressable style={styles.cancel} onPress={() => setShow(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
            </ScrollView>
          </View>
        </View>
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

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: Platform.OS === "web" ? SP.lg : 0 },
  sheet: { backgroundColor: C.card, borderRadius: 18, padding: SP.lg, width: "100%", maxWidth: 560, maxHeight: "92%" },
  sheetHead: { flexDirection: "row", alignItems: "flex-start", marginBottom: SP.sm },
  sheetTitle: { color: C.text, fontSize: 18, fontWeight: "800" },
  sheetSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  label: { color: C.sub, fontSize: 12, fontWeight: "700", marginTop: SP.md, marginBottom: 6 },
  input: { backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: SP.md, minHeight: 46, color: C.text, borderWidth: 1, borderColor: C.border },
  area: { minHeight: 90, paddingTop: SP.sm, textAlignVertical: "top" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pick: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, height: 34, borderRadius: 8, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  pickOn: { backgroundColor: C.violet, borderColor: C.violet },
  pickText: { color: C.sub, fontWeight: "700", fontSize: 12 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: SP.md },
  audHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  audTitle: { color: C.text, fontSize: 15, fontWeight: "800" },
  chosen: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.bg, borderRadius: 8, borderWidth: 1, borderColor: C.violet, paddingHorizontal: SP.md, height: 44 },
  chosenText: { flex: 1, color: C.text, fontSize: 13, fontWeight: "600" },
  results: { backgroundColor: C.bg, borderRadius: 8, borderWidth: 1, borderColor: C.border, marginTop: 6, overflow: "hidden" },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: SP.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  resultText: { color: C.text, fontSize: 13, flex: 1 },
  resultTag: { color: C.muted, fontSize: 9, fontWeight: "800" },
  previewHead: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: SP.lg },
  previewCount: { color: C.text, fontSize: 14, fontWeight: "700" },
  previewMuted: { color: C.muted, fontSize: 12, fontWeight: "600" },
  selHint: { color: C.muted, fontSize: 11, marginTop: 4 },
  clearSel: { marginTop: 4 },
  clearSelText: { color: C.violet, fontSize: 11, fontWeight: "700" },
  listBox: { marginTop: SP.sm, borderWidth: 1, borderColor: C.border, borderRadius: 10, overflow: "hidden", maxHeight: 260 },
  emptyList: { color: C.muted, textAlign: "center", padding: SP.lg, fontSize: 12 },
  userRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: SP.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.cardAlt },
  userRowOn: { backgroundColor: C.violet + "22" },
  userName: { color: C.text, fontSize: 13, fontWeight: "700" },
  userMeta: { color: C.sub, fontSize: 11, marginTop: 2 },
  userActive: { color: C.muted, fontSize: 10, fontWeight: "600", marginLeft: 6 },
  saveBtn: { backgroundColor: C.violet, borderRadius: 9999, height: 50, alignItems: "center", justifyContent: "center", marginTop: SP.lg },
  saveText: { color: "#fff", fontWeight: "800" },
  cancel: { alignItems: "center", paddingVertical: SP.md },
  cancelText: { color: C.muted },
});
