import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { adminApi } from "@/src/services/api";
import { C, SP } from "./adminTheme";

const MEMBERSHIP_C: Record<string, string> = { Premium: C.amber, Free: C.emerald };

function fmtDate(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function cc(country?: string) {
  const m: Record<string, string> = { Tanzania: "TZ", Uganda: "UG", Kenya: "KE", Rwanda: "RW", Zambia: "ZM" };
  return m[country || ""] || (country ? country.slice(0, 2).toUpperCase() : "TZ");
}

export default function UsersManager({ onToast }: { onToast: (m: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [fMembership, setFMembership] = useState("all");
  const [fRegister, setFRegister] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = `?membership_type=${fMembership}&register_by=${encodeURIComponent(fRegister)}&status=${fStatus}${search ? `&search=${encodeURIComponent(search)}` : ""}`;
    const [r, s] = await Promise.all([
      adminApi.users(qs).catch(() => []),
      adminApi.userStats().catch(() => null),
    ]);
    setRows(r); setStats(s); setLoading(false);
  }, [fMembership, fRegister, fStatus, search]);
  useEffect(() => { load(); }, [load]);

  if (selected) return <UserDetail userId={selected} onBack={() => { setSelected(null); load(); }} onToast={onToast} />;

  const statCards = [
    { l: "Total Users", v: stats?.total_users ?? 0, i: "people", c: C.violet, big: true },
    { l: "Active", v: stats?.active ?? 0, i: "checkmark-circle", c: C.emerald },
    { l: "Premium", v: stats?.premium ?? 0, i: "star", c: C.amber },
    { l: "Free", v: stats?.free ?? 0, i: "person", c: C.blue },
    { l: "In Trial", v: stats?.trial ?? 0, i: "time", c: C.blue },
    { l: "Suspended", v: stats?.suspended ?? 0, i: "ban", c: C.red },
  ];

  return (
    <View>
      <Text style={styles.title}>Customers</Text>
      <Text style={styles.sub}>Manage {stats?.total_users ?? 0} registered users</Text>

      <View style={styles.statRow}>
        {statCards.map((s, i) => (
          <View key={i} style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: s.c + "22" }]}><Ionicons name={s.i as any} size={16} color={s.c} /></View>
            <View>
              <Text style={styles.statVal}>{s.v}</Text>
              <Text style={styles.statLbl}>{s.l}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={C.muted} />
        <TextInput testID="users-search" style={styles.searchInput} value={search} onChangeText={setSearch} placeholder={`Search ${stats?.total_users ?? ""} Users`} placeholderTextColor={C.muted} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SP.sm }}>
        <FilterGroup label="Type" value={fMembership} opts={[["all", "All Types"], ["Free", "Free"], ["Premium", "Premium"]]} onPick={setFMembership} />
        <FilterGroup label="Method" value={fRegister} opts={[["all", "All Methods"], ["Email", "Email"], ["Mobile No", "Mobile"]]} onPick={setFRegister} />
        <FilterGroup label="Status" value={fStatus} opts={[["all", "All Status"], ["active", "Active"], ["suspended", "Suspended"]]} onPick={setFStatus} />
      </ScrollView>

      {loading ? <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} /> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ minWidth: 900 }}>
            <View style={styles.thead}>
              <Text style={[styles.th, { width: 150 }]}>USER ID</Text>
              <Text style={[styles.th, { width: 230 }]}>EMAIL / MOBILE</Text>
              <Text style={[styles.th, { width: 90 }]}>TYPE</Text>
              <Text style={[styles.th, { width: 110 }]}>COUNTRY</Text>
              <Text style={[styles.th, { width: 110 }]}>REGISTER BY</Text>
              <Text style={[styles.th, { width: 90 }]}>STATUS</Text>
              <Text style={[styles.th, { width: 70 }]}>ACTIONS</Text>
            </View>
            {rows.map((u) => (
              <Pressable key={u.user_id} testID={`user-row-${u.user_id}`} style={styles.trow} onPress={() => setSelected(u.user_id)}>
                <Text style={[styles.td, styles.tdId, { width: 150 }]} numberOfLines={1}>{u.name || u.user_id}</Text>
                <Text style={[styles.td, { width: 230 }]} numberOfLines={1}>
                  <Text style={styles.ccTag}>{cc(u.country)} </Text>{u.phone || u.email}
                </Text>
                <View style={{ width: 90 }}><View style={[styles.pill, { borderColor: MEMBERSHIP_C[u.membership_type] || C.muted }]}><Text style={[styles.pillTxt, { color: MEMBERSHIP_C[u.membership_type] || C.muted }]}>{u.membership_type}</Text></View></View>
                <Text style={[styles.td, { width: 110 }]} numberOfLines={1}>{u.country}</Text>
                <Text style={[styles.td, { width: 110 }]} numberOfLines={1}>{u.register_by}</Text>
                <View style={{ width: 90 }}><Text style={[styles.status, { color: u.status === "active" ? C.emerald : C.red }]}>{u.status === "active" ? "Active" : "Suspended"}</Text></View>
                <View style={{ width: 70 }}><Ionicons name="chevron-forward" size={18} color={C.muted} /></View>
              </Pressable>
            ))}
            {rows.length === 0 ? <Text style={styles.empty}>No users match your filters.</Text> : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function UserDetail({ userId, onBack, onToast }: { userId: string; onBack: () => void; onToast: (m: string) => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [tab, setTab] = useState<"profile" | "membership" | "history" | "downloads" | "transactions" | "devices">("profile");
  const [history, setHistory] = useState<any>(null);
  const [downloads, setDownloads] = useState<any>(null);
  const [txns, setTxns] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  const loadDetail = useCallback(async () => {
    const d = await adminApi.userDetail(userId).catch(() => null);
    setDetail(d);
    if (d) setForm({ name: d.name || "", phone: d.phone || "", country: d.country || "" });
  }, [userId]);
  useEffect(() => { loadDetail(); }, [loadDetail]);

  useEffect(() => {
    if (tab === "history" && !history) adminApi.userHistory(userId).then(setHistory).catch(() => {});
    if (tab === "downloads" && !downloads) adminApi.userDownloads(userId).then(setDownloads).catch(() => {});
    if (tab === "transactions" && !txns) adminApi.userTransactions(userId).then(setTxns).catch(() => {});
  }, [tab, userId, history, downloads, txns]);

  if (!detail) return <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} />;

  const suspended = detail.status !== "active";
  const toggleStatus = async () => {
    try { await adminApi.userStatus(userId, suspended ? "active" : "suspended"); onToast(suspended ? "User activated" : "User deactivated"); await loadDetail(); }
    catch (e: any) { onToast(e.message); }
  };
  const reset = async () => {
    try { await adminApi.resetUser(userId); onToast("User reset to Free"); await loadDetail(); }
    catch (e: any) { onToast(e.message); }
  };
  const saveEdit = async () => {
    try { await adminApi.updateUser(userId, form); onToast("User updated"); setEditing(false); await loadDetail(); }
    catch (e: any) { onToast(e.message); }
  };

  const tabs: [any, string][] = [["profile", "Profile Details"], ["membership", "Membership"], ["history", "Listening History"], ["downloads", "Downloads"], ["transactions", "Transactions"], ["devices", "Devices"]];

  return (
    <View>
      <Pressable testID="user-detail-back" style={styles.backRow} onPress={onBack}><Ionicons name="chevron-back" size={18} color={C.violet} /><Text style={styles.backTxt}>Back</Text><Text style={styles.backCur}>  ·  Users View</Text></Pressable>

      <View style={styles.headCard}>
        <View style={styles.avatar}><Text style={styles.avatarTxt}>{(detail.name || "U").charAt(0).toUpperCase()}</Text></View>
        <View style={{ flex: 1, marginLeft: SP.md }}>
          <Text style={styles.hName}>{detail.name || "Unknown"}</Text>
          <Text style={styles.hId}>{detail.user_id}</Text>
          <View style={[styles.pill, { borderColor: MEMBERSHIP_C[detail.membership_type] || C.muted, alignSelf: "flex-start", marginTop: 6 }]}><Text style={[styles.pillTxt, { color: MEMBERSHIP_C[detail.membership_type] || C.muted }]}>{detail.membership_type}</Text></View>
        </View>
        <View style={styles.headBtns}>
          <Pressable testID="user-edit" style={styles.headBtn} onPress={() => setEditing((e) => !e)}><Ionicons name="create-outline" size={15} color={C.text} /><Text style={styles.headBtnTxt}>Edit</Text></Pressable>
          <Pressable testID="user-reset" style={styles.headBtn} onPress={reset}><Ionicons name="refresh" size={15} color={C.amber} /><Text style={[styles.headBtnTxt, { color: C.amber }]}>Reset</Text></Pressable>
          <Pressable testID="user-toggle-status" style={[styles.headBtn, { borderColor: suspended ? C.emerald : C.red }]} onPress={toggleStatus}>
            <Ionicons name={suspended ? "checkmark-circle" : "ban"} size={15} color={suspended ? C.emerald : C.red} />
            <Text style={[styles.headBtnTxt, { color: suspended ? C.emerald : C.red }]}>{suspended ? "Activate" : "Deactivate"}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dtabs}>
        {tabs.map(([k, l]) => (
          <Pressable key={k} testID={`user-tab-${k}`} style={[styles.dtab, tab === k && styles.dtabOn]} onPress={() => setTab(k)}>
            <Text style={[styles.dtabTxt, tab === k && { color: "#fff" }]}>{l}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {tab === "profile" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Personal Details</Text>
          {editing ? (
            <>
              <Field label="Name"><TextInput testID="user-edit-name" style={styles.input} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholderTextColor={C.muted} /></Field>
              <Field label="Mobile No"><TextInput testID="user-edit-phone" style={styles.input} value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} placeholder="-" placeholderTextColor={C.muted} /></Field>
              <Field label="Country"><TextInput testID="user-edit-country" style={styles.input} value={form.country} onChangeText={(v) => setForm({ ...form, country: v })} placeholderTextColor={C.muted} /></Field>
              <Pressable testID="user-edit-save" style={styles.saveBtn} onPress={saveEdit}><Text style={styles.saveTxt}>Save Changes</Text></Pressable>
            </>
          ) : (
            <View style={styles.grid2}>
              <KV k="Name" v={detail.name} />
              <KV k="Mobile No" v={detail.phone || "-"} />
              <KV k="Email" v={detail.email} />
              <KV k="User ID" v={detail.user_id} />
              <KV k="Register By" v={detail.register_by} />
              <KV k="Country" v={`${cc(detail.country)} ${detail.country}`} />
              <KV k="Created At" v={fmtDate(detail.created_at)} />
              <KV k="Status" v={detail.status === "active" ? "Active" : "Suspended"} vColor={detail.status === "active" ? C.emerald : C.red} />
            </View>
          )}
        </View>
      ) : null}

      {tab === "membership" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Membership & Plan</Text>
          <View style={styles.grid2}>
            <KV k="Membership Type" v={detail.membership_type} vColor={MEMBERSHIP_C[detail.membership_type]} />
            <KV k="Current Plan" v={detail.subscription?.plan_name || "-"} />
            <KV k="Plan Expiry" v={detail.subscription?.expires_at ? fmtDate(String(detail.subscription.expires_at)) : "-"} />
            <KV k="Total Spent" v={`TZS ${Number(detail.analytics?.total_spent || 0).toLocaleString()}`} />
            <KV k="Total Plays" v={String(detail.analytics?.total_plays || 0)} />
            <KV k="Liked Songs" v={String(detail.analytics?.liked_songs_count || 0)} />
          </View>
        </View>
      ) : null}

      {tab === "history" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Listening History {history ? `(${history.total})` : ""}</Text>
          {!history ? <ActivityIndicator color={C.violet} /> : history.history.length === 0 ? <Text style={styles.emptySm}>No listening activity yet.</Text> :
            history.history.map((h: any, i: number) => (
              <View key={i} style={styles.listRow}>
                <Image source={{ uri: h.thumbnail || "https://picsum.photos/seed/vibe/100" }} style={styles.thumb} />
                <View style={{ flex: 1, marginLeft: SP.sm }}>
                  <Text style={styles.lrTitle} numberOfLines={1}>{h.song_title}</Text>
                  <Text style={styles.lrSub} numberOfLines={1}>{h.artist_name}{h.is_guest ? " · guest" : ""}</Text>
                </View>
                <Text style={styles.lrMeta}>{fmtDate(h.listened_at)}</Text>
              </View>
            ))}
        </View>
      ) : null}

      {tab === "downloads" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Downloads {downloads ? `(${downloads.total})` : ""}</Text>
          {!downloads ? <ActivityIndicator color={C.violet} /> : downloads.downloads.length === 0 ? <Text style={styles.emptySm}>No downloads yet.</Text> :
            downloads.downloads.map((d: any, i: number) => (
              <View key={i} style={styles.listRow}>
                <Image source={{ uri: d.thumbnail || "https://picsum.photos/seed/vibe/100" }} style={styles.thumb} />
                <View style={{ flex: 1, marginLeft: SP.sm }}>
                  <Text style={styles.lrTitle} numberOfLines={1}>{d.title}</Text>
                  <Text style={styles.lrSub} numberOfLines={1}>{d.artist_name}</Text>
                </View>
                <Text style={styles.lrMeta}>{fmtDate(d.downloaded_at)}</Text>
              </View>
            ))}
        </View>
      ) : null}

      {tab === "transactions" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Transactions {txns ? `· TZS ${Number(txns.total_spent).toLocaleString()} spent` : ""}</Text>
          {!txns ? <ActivityIndicator color={C.violet} /> : txns.transactions.length === 0 ? <Text style={styles.emptySm}>No transactions yet.</Text> :
            txns.transactions.map((t: any, i: number) => (
              <View key={i} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lrTitle}>TZS {Number(t.amount).toLocaleString()}</Text>
                  <Text style={styles.lrSub} numberOfLines={1}>{t.plan_id || "subscription"} · {t.gateway}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.status, { color: t.status === "completed" ? C.emerald : t.status === "pending" ? C.amber : C.red }]}>{t.status}</Text>
                  <Text style={styles.lrMeta}>{fmtDate(t.created_at)}</Text>
                </View>
              </View>
            ))}
        </View>
      ) : null}

      {tab === "devices" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Device Information</Text>
          <View style={styles.grid2}>
            <KV k="Platform" v={detail.device?.platform || "Unknown"} />
            <KV k="Manufacturer" v={detail.device?.manufacturer || "Unknown"} />
            <KV k="Device Model" v={detail.device?.model || "Unknown"} />
            <KV k="OS Version" v={detail.device?.os_version || "Unknown"} />
          </View>
        </View>
      ) : null}
      <View style={{ height: 40 }} />
    </View>
  );
}

const FilterGroup = ({ label, value, opts, onPick }: any) => (
  <View style={{ flexDirection: "row", marginRight: SP.md }}>
    {opts.map(([k, l]: any) => (
      <Pressable key={k} style={[styles.fchip, value === k && styles.fchipOn]} onPress={() => onPick(k)}>
        <Text style={[styles.fchipTxt, value === k && { color: "#fff" }]}>{l}</Text>
      </Pressable>
    ))}
  </View>
);
const KV = ({ k, v, vColor }: any) => (
  <View style={styles.kv}><Text style={styles.kLbl}>{k}</Text><Text style={[styles.kVal, vColor && { color: vColor }]}>{v || "-"}</Text></View>
);
const Field = ({ label, children }: any) => (
  <View style={{ marginBottom: SP.sm }}><Text style={styles.kLbl}>{label}</Text>{children}</View>
);

const styles = StyleSheet.create({
  title: { color: C.text, fontSize: 22, fontWeight: "800" },
  sub: { color: C.muted, fontSize: 12, marginTop: 2, marginBottom: SP.md },
  statRow: { flexDirection: "row", flexWrap: "wrap", gap: SP.sm, marginBottom: SP.md },
  statCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.cardAlt, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 12, paddingHorizontal: SP.md, minWidth: 150, flexGrow: 1 },
  statIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  statVal: { color: C.text, fontSize: 18, fontWeight: "800" },
  statLbl: { color: C.muted, fontSize: 11 },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 10, paddingHorizontal: SP.md, height: 46, borderWidth: 1, borderColor: C.border, marginBottom: SP.sm },
  searchInput: { flex: 1, color: C.text, marginLeft: SP.sm, fontSize: 14 },
  fchip: { paddingHorizontal: 12, height: 32, borderRadius: 9999, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", marginRight: 6 },
  fchipOn: { backgroundColor: C.violet, borderColor: C.violet },
  fchipTxt: { color: C.sub, fontWeight: "700", fontSize: 12 },
  thead: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: SP.sm },
  th: { color: C.muted, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  trow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(39,39,42,0.5)", paddingHorizontal: SP.sm },
  td: { color: C.sub, fontSize: 13, paddingRight: 8 },
  tdId: { color: C.text, fontWeight: "700" },
  ccTag: { color: C.muted, fontSize: 10, fontWeight: "800" },
  pill: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" },
  pillTxt: { fontSize: 10, fontWeight: "800" },
  status: { fontSize: 12, fontWeight: "800", textTransform: "capitalize" },
  empty: { color: C.muted, textAlign: "center", paddingVertical: SP.xl },
  emptySm: { color: C.muted, paddingVertical: SP.md },
  // detail
  backRow: { flexDirection: "row", alignItems: "center", marginBottom: SP.md },
  backTxt: { color: C.violet, fontWeight: "700", fontSize: 14 },
  backCur: { color: C.muted, fontSize: 13 },
  headCard: { flexDirection: "row", alignItems: "center", backgroundColor: C.cardAlt, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: SP.md, marginBottom: SP.md, flexWrap: "wrap", gap: SP.sm },
  avatar: { width: 60, height: 60, borderRadius: 12, backgroundColor: C.violet, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontSize: 26, fontWeight: "800" },
  hName: { color: C.text, fontSize: 20, fontWeight: "800" },
  hId: { color: C.muted, fontSize: 12, marginTop: 2 },
  headBtns: { flexDirection: "row", gap: SP.sm },
  headBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: C.border, borderRadius: 9999, paddingHorizontal: 12, height: 36 },
  headBtnTxt: { color: C.text, fontWeight: "700", fontSize: 12 },
  dtabs: { marginBottom: SP.md },
  dtab: { paddingHorizontal: SP.md, height: 34, borderRadius: 9999, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", marginRight: SP.sm },
  dtabOn: { backgroundColor: C.violet, borderColor: C.violet },
  dtabTxt: { color: C.sub, fontWeight: "700", fontSize: 12 },
  panel: { backgroundColor: C.cardAlt, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: SP.md },
  panelTitle: { color: C.text, fontSize: 15, fontWeight: "800", marginBottom: SP.md },
  grid2: { flexDirection: "row", flexWrap: "wrap" },
  kv: { width: "50%", paddingVertical: 10, paddingRight: SP.md },
  kLbl: { color: C.muted, fontSize: 11, marginBottom: 3 },
  kVal: { color: C.text, fontSize: 14, fontWeight: "600" },
  input: { backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: SP.md, height: 44, color: C.text, borderWidth: 1, borderColor: C.border },
  saveBtn: { backgroundColor: C.violet, borderRadius: 9999, height: 46, alignItems: "center", justifyContent: "center", marginTop: SP.sm },
  saveTxt: { color: "#fff", fontWeight: "800" },
  listRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(39,39,42,0.5)" },
  thumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: C.card },
  lrTitle: { color: C.text, fontSize: 13, fontWeight: "700" },
  lrSub: { color: C.muted, fontSize: 11, marginTop: 1 },
  lrMeta: { color: C.muted, fontSize: 11 },
});
