import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput, Image, Modal, KeyboardAvoidingView, Platform } from "react-native";
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
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [showEnroll, setShowEnroll] = useState(false);
  const [view, setView] = useState<"list" | "history">("list");
  const [history, setHistory] = useState<any[] | null>(null);

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

  const selectedIds = Object.keys(checked).filter((k) => checked[k]);
  const openHistory = async () => { setView("history"); setHistory(await adminApi.enrollments().catch(() => [])); };

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
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Customers</Text>
          <Text style={styles.sub}>Manage {stats?.total_users ?? 0} registered users</Text>
        </View>
        {view === "list" ? (
          <View style={styles.headActions}>
            <Pressable testID="users-history-btn" style={styles.ghostBtn} onPress={openHistory}><Ionicons name="time-outline" size={15} color={C.text} /><Text style={styles.ghostTxt}>History</Text></Pressable>
            <Pressable testID="users-enroll-btn" style={styles.primaryBtn} onPress={() => setShowEnroll(true)}><Ionicons name="add-circle" size={16} color="#fff" /><Text style={styles.primaryTxt}>Enroll{selectedIds.length ? ` (${selectedIds.length})` : ""}</Text></Pressable>
          </View>
        ) : (
          <Pressable testID="users-history-back" style={styles.ghostBtn} onPress={() => setView("list")}><Ionicons name="chevron-back" size={15} color={C.violet} /><Text style={[styles.ghostTxt, { color: C.violet }]}>Back to Users</Text></Pressable>
        )}
      </View>

      {view === "history" ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Enrollment Records</Text>
          {!history ? <ActivityIndicator color={C.violet} /> : history.length === 0 ? <Text style={styles.emptySm}>No enrollments yet.</Text> :
            history.map((h) => (
              <View key={h.enrollment_id} style={styles.histRow}>
                <View style={[styles.statIcon, { backgroundColor: (h.mode === "plan" ? C.violet : C.emerald) + "22" }]}><Ionicons name={h.mode === "plan" ? "card" : "time"} size={16} color={h.mode === "plan" ? C.violet : C.emerald} /></View>
                <View style={{ flex: 1, marginLeft: SP.sm }}>
                  <Text style={styles.lrTitle}>{h.plan_name}</Text>
                  <Text style={styles.lrSub} numberOfLines={1}>by {h.admin_email} · {h.applied_count}/{h.total_count} applied{h.pending_count ? ` · ${h.pending_count} pending` : ""}</Text>
                </View>
                <Text style={styles.lrMeta}>{fmtDate(h.created_at)}</Text>
              </View>
            ))}
        </View>
      ) : (
      <>
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
            <View style={styles.thead}>
              <Text style={[styles.th, { width: 36 }]}> </Text>
              <Text style={[styles.th, { width: 150 }]}>USER ID</Text>
              <Text style={[styles.th, { width: 230 }]}>EMAIL / MOBILE</Text>
              <Text style={[styles.th, { width: 90 }]}>TYPE</Text>
              <Text style={[styles.th, { width: 110 }]}>COUNTRY</Text>
              <Text style={[styles.th, { width: 110 }]}>REGISTER BY</Text>
              <Text style={[styles.th, { width: 90 }]}>STATUS</Text>
              <Text style={[styles.th, { width: 70 }]}>ACTIONS</Text>
            </View>
            {rows.map((u) => (
              <View key={u.user_id} style={styles.trow}>
                <Pressable testID={`user-check-${u.user_id}`} style={{ width: 36 }} onPress={() => setChecked((c) => ({ ...c, [u.user_id]: !c[u.user_id] }))} hitSlop={8}>
                  <Ionicons name={checked[u.user_id] ? "checkbox" : "square-outline"} size={18} color={checked[u.user_id] ? C.violet : C.muted} />
                </Pressable>
                <Pressable testID={`user-row-${u.user_id}`} style={{ width: 150 }} onPress={() => setSelected(u.user_id)}><Text style={[styles.td, styles.tdId]} numberOfLines={1}>{u.name || u.user_id}</Text></Pressable>
                <Text style={[styles.td, { width: 230 }]} numberOfLines={1}>
                  <Text style={styles.ccTag}>{cc(u.country)} </Text>{u.phone || u.email}
                </Text>
                <View style={{ width: 90 }}><View style={[styles.pill, { borderColor: MEMBERSHIP_C[u.membership_type] || C.muted }]}><Text style={[styles.pillTxt, { color: MEMBERSHIP_C[u.membership_type] || C.muted }]}>{u.membership_type}</Text></View></View>
                <Text style={[styles.td, { width: 110 }]} numberOfLines={1}>{u.country}</Text>
                <Text style={[styles.td, { width: 110 }]} numberOfLines={1}>{u.register_by}</Text>
                <View style={{ width: 90 }}><Text style={[styles.status, { color: u.status === "active" ? C.emerald : C.red }]}>{u.status === "active" ? "Active" : "Suspended"}</Text></View>
                <Pressable style={{ width: 70 }} onPress={() => setSelected(u.user_id)}><Ionicons name="chevron-forward" size={18} color={C.muted} /></Pressable>
              </View>
            ))}
            {rows.length === 0 ? <Text style={styles.empty}>No users match your filters.</Text> : null}
          </View>
        </ScrollView>
      )}
      </>
      )}
      <EnrollModal visible={showEnroll} onClose={() => setShowEnroll(false)} selectedIds={selectedIds} onToast={onToast} onDone={() => { setShowEnroll(false); setChecked({}); load(); }} />
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

const DURATIONS: [string, number, string][] = [["Daily", 1, "daily"], ["3 Days", 3, "3days"], ["Weekly", 7, "weekly"], ["Monthly", 30, "monthly"]];

function EnrollModal({ visible, onClose, selectedIds, onToast, onDone }: { visible: boolean; onClose: () => void; selectedIds: string[]; onToast: (m: string) => void; onDone: () => void }) {
  const [mode, setMode] = useState<"plan" | "free_hours">("plan");
  const [durKey, setDurKey] = useState("weekly");
  const [freeHours, setFreeHours] = useState("5");
  const [freePeriod, setFreePeriod] = useState<"day" | "week" | "month">("week");
  const [phones, setPhones] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const phoneList = phones.split(/[\n,]/).map((p) => p.trim()).filter(Boolean);
    if (selectedIds.length === 0 && phoneList.length === 0) { onToast("Select users or paste mobile numbers"); return; }
    const dur = DURATIONS.find((d) => d[2] === durKey)!;
    const body: any = { mode, user_ids: selectedIds, phones: phoneList };
    if (mode === "plan") { body.duration_days = dur[1]; body.plan_name = dur[0]; }
    else { body.free_hours = parseFloat(freeHours) || 0; body.free_period = freePeriod; }
    setSubmitting(true);
    try {
      const res = await adminApi.enroll(body);
      onToast(`Enrolled ${res.applied_count} user(s)${res.pending_count ? `, ${res.pending_count} pending` : ""}`);
      setPhones("");
      onDone();
    } catch (e: any) { onToast(e.message); } finally { setSubmitting(false); }
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Enroll Subscribers</Text>
            <Pressable testID="enroll-close" onPress={onClose} hitSlop={10}><Ionicons name="close" size={22} color={C.text} /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.modeRow}>
              <Pressable testID="enroll-mode-plan" style={[styles.modeBtn, mode === "plan" && styles.modeOn]} onPress={() => setMode("plan")}><Text style={[styles.modeTxt, mode === "plan" && { color: "#fff" }]}>Subscription Plan</Text></Pressable>
              <Pressable testID="enroll-mode-free" style={[styles.modeBtn, mode === "free_hours" && styles.modeOn]} onPress={() => setMode("free_hours")}><Text style={[styles.modeTxt, mode === "free_hours" && { color: "#fff" }]}>Free Listening Hours</Text></Pressable>
            </View>

            <Text style={styles.kLbl}>Targets</Text>
            <Text style={styles.hintTxt}>{selectedIds.length} user(s) selected from the list. You can also paste mobile numbers below (one per line) for bulk enrollment.</Text>
            <TextInput testID="enroll-phones" style={[styles.input, { height: 110, textAlignVertical: "top", paddingTop: 10 }]} value={phones} onChangeText={setPhones} placeholder={"+255700000001\n+255700000002"} placeholderTextColor={C.muted} multiline autoCapitalize="none" />

            {mode === "plan" ? (
              <>
                <Text style={styles.kLbl}>Duration of Access</Text>
                <View style={styles.wrapRow}>
                  {DURATIONS.map(([l, , k]) => (
                    <Pressable key={k} testID={`enroll-dur-${k}`} style={[styles.pick, durKey === k && styles.pickOn]} onPress={() => setDurKey(k)}><Text style={[styles.pickTxt, durKey === k && { color: "#fff" }]}>{l}</Text></Pressable>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.kLbl}>Free Listening Hours</Text>
                <TextInput testID="enroll-hours" style={styles.input} value={freeHours} onChangeText={setFreeHours} keyboardType="numeric" placeholder="5" placeholderTextColor={C.muted} />
                <Text style={styles.kLbl}>Per Period</Text>
                <View style={styles.wrapRow}>
                  {(["day", "week", "month"] as const).map((p) => (
                    <Pressable key={p} testID={`enroll-period-${p}`} style={[styles.pick, freePeriod === p && styles.pickOn]} onPress={() => setFreePeriod(p)}><Text style={[styles.pickTxt, freePeriod === p && { color: "#fff" }]}>{p === "day" ? "Per Day" : p === "week" ? "Per Week" : "Per Month"}</Text></Pressable>
                  ))}
                </View>
                <Text style={styles.hintTxt}>e.g. 5 hours free per week — access expires at end of the period.</Text>
              </>
            )}

            <Pressable testID="enroll-submit" style={styles.saveBtn} onPress={submit} disabled={submitting}>{submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Enroll Users</Text>}</Pressable>
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const FilterGroup = ({ label, value, opts, onPick }: any) => (  <View style={{ flexDirection: "row", marginRight: SP.md }}>
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
  headRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: SP.sm, flexWrap: "wrap", gap: SP.sm },
  headActions: { flexDirection: "row", gap: SP.sm },
  ghostBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: C.border, borderRadius: 9999, paddingHorizontal: 12, height: 38 },
  ghostTxt: { color: C.text, fontWeight: "700", fontSize: 12 },
  primaryBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.violet, borderRadius: 9999, paddingHorizontal: 14, height: 38 },
  primaryTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },
  histRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(39,39,42,0.5)" },
  hintTxt: { color: C.muted, fontSize: 11, marginBottom: 6, lineHeight: 15 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: SP.lg, maxHeight: "92%" },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SP.sm },
  sheetTitle: { color: C.text, fontSize: 18, fontWeight: "800" },
  modeRow: { flexDirection: "row", gap: SP.sm, marginBottom: SP.md },
  modeBtn: { flex: 1, height: 40, borderRadius: 8, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  modeOn: { backgroundColor: C.violet, borderColor: C.violet },
  modeTxt: { color: C.sub, fontWeight: "700", fontSize: 12 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: SP.sm },
  pick: { paddingHorizontal: 14, height: 38, borderRadius: 8, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  pickOn: { backgroundColor: C.violet, borderColor: C.violet },
  pickTxt: { color: C.sub, fontWeight: "700", fontSize: 12 },
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
