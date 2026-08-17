import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { adminApi } from "@/src/services/api";
import { adminArtistApi } from "@/src/services/artistApi";
import { C, SP } from "./adminTheme";

const ROLES = ["customer", "content_manager", "moderator", "finance", "support", "admin"];

export default function ControlManager({ onToast, initial = "roles" }: { onToast: (m: string) => void; initial?: string }) {
  const [view, setView] = useState<"roles" | "approvals" | "health">(initial as any);
  const [users, setUsers] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setView(initial as any); }, [initial]);

  const load = useCallback(async () => {
    setLoading(true);
    const [u, ap, h] = await Promise.all([
      adminApi.users().catch(() => []),
      adminApi.approvals().catch(() => null),
      adminApi.health().catch(() => null),
    ]);
    setUsers(u); setApprovals(ap); setHealth(h); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const changeRole = async (email: string, role: string) => {
    try { await adminApi.setUserRole(email, role); setUsers((l) => l.map((u) => u.email === email ? { ...u, role } : u)); onToast(`Role → ${role}`); }
    catch (e: any) { onToast(e.message); }
  };
  const setArtist = async (id: string, s: string) => {
    try { await adminArtistApi.setStatus(id, s); onToast(`Artist ${s}`); await load(); } catch (e: any) { onToast(e.message); }
  };
  const setAlbum = async (id: string, s: string) => {
    try { await adminApi.approveAlbum(id, s); onToast(`Album ${s}`); await load(); } catch (e: any) { onToast(e.message); }
  };
  const setSong = async (id: string, s: string) => {
    try { await adminApi.approveSong(id, s); onToast(`Song ${s}`); await load(); } catch (e: any) { onToast(e.message); }
  };

  return (
    <View>
      <Text style={styles.title}>Control & Management</Text>
      <Text style={styles.sub}>Roles, content approvals & system health</Text>
      <View style={styles.subTabs}>
        {([["roles", "Roles"], ["approvals", "Approvals"], ["health", "App Health"]] as const).map(([k, l]) => (
          <Pressable key={k} testID={`cm-sub-${k}`} style={[styles.subTab, view === k && styles.subTabOn]} onPress={() => setView(k as any)}>
            <Text style={[styles.subTabText, view === k && { color: "#fff" }]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} /> : (
        <>
          {view === "roles" ? (
            <>
              <Text style={styles.count}>{users.length} users</Text>
              {users.map((u) => (
                <View key={u.email} style={styles.card}>
                  <View style={styles.rowHead}>
                    <View style={styles.avatar}><Ionicons name="person" size={15} color="#fff" /></View>
                    <View style={{ flex: 1, marginLeft: SP.sm }}>
                      <Text style={styles.name} numberOfLines={1}>{u.name || u.email}</Text>
                      <Text style={styles.meta} numberOfLines={1}>{u.email}</Text>
                    </View>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: SP.sm }}>
                    {ROLES.map((r) => (
                      <Pressable key={r} testID={`role-${u.email}-${r}`} style={[styles.roleChip, (u.role || "customer") === r && styles.roleOn]} onPress={() => changeRole(u.email, r)}>
                        <Text style={[styles.roleText, (u.role || "customer") === r && { color: "#fff" }]}>{r.replace("_", " ")}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ))}
            </>
          ) : null}

          {view === "approvals" && approvals ? (
            <>
              <View style={styles.grid}>
                {[["Artists", approvals.summary.artists], ["Albums", approvals.summary.albums], ["Songs", approvals.summary.songs], ["Total", approvals.summary.total]].map(([l, v]) => (
                  <View key={l as string} style={styles.stat}><Text style={styles.statLabel}>{l}</Text><Text style={styles.statVal}>{v as number}</Text></View>
                ))}
              </View>
              {approvals.summary.total === 0 ? <Text style={styles.empty}>No pending approvals 🎉</Text> : null}

              {approvals.artists.map((a: any) => (
                <View key={a.artist_id} style={styles.card}>
                  <Text style={styles.name}>{a.name} <Text style={styles.tagPending}>ARTIST</Text></Text>
                  <Text style={styles.meta}>{a.email}</Text>
                  <View style={styles.actions}>
                    <Pressable testID={`ap-artist-approve-${a.artist_id}`} style={[styles.btn, { backgroundColor: C.emerald }]} onPress={() => setArtist(a.artist_id, "approved")}><Text style={styles.btnText}>Approve</Text></Pressable>
                    <Pressable testID={`ap-artist-reject-${a.artist_id}`} style={[styles.btn, { backgroundColor: C.red }]} onPress={() => setArtist(a.artist_id, "rejected")}><Text style={styles.btnText}>Reject</Text></Pressable>
                  </View>
                </View>
              ))}
              {approvals.albums.map((a: any) => (
                <View key={a.album_id} style={styles.card}>
                  <Text style={styles.name}>{a.title} <Text style={styles.tagPending}>ALBUM</Text></Text>
                  <Text style={styles.meta}>{a.artist_name}</Text>
                  <View style={styles.actions}>
                    <Pressable testID={`ap-album-approve-${a.album_id}`} style={[styles.btn, { backgroundColor: C.emerald }]} onPress={() => setAlbum(a.album_id, "active")}><Text style={styles.btnText}>Approve</Text></Pressable>
                    <Pressable testID={`ap-album-reject-${a.album_id}`} style={[styles.btn, { backgroundColor: C.red }]} onPress={() => setAlbum(a.album_id, "rejected")}><Text style={styles.btnText}>Reject</Text></Pressable>
                  </View>
                </View>
              ))}
              {approvals.songs.map((s: any) => (
                <View key={s.song_id} style={styles.card}>
                  <Text style={styles.name}>{s.title} <Text style={styles.tagPending}>SONG</Text></Text>
                  <Text style={styles.meta}>{s.artist_name}</Text>
                  <View style={styles.actions}>
                    <Pressable testID={`ap-song-approve-${s.song_id}`} style={[styles.btn, { backgroundColor: C.emerald }]} onPress={() => setSong(s.song_id, "active")}><Text style={styles.btnText}>Approve</Text></Pressable>
                    <Pressable testID={`ap-song-reject-${s.song_id}`} style={[styles.btn, { backgroundColor: C.red }]} onPress={() => setSong(s.song_id, "rejected")}><Text style={styles.btnText}>Reject</Text></Pressable>
                  </View>
                </View>
              ))}
            </>
          ) : null}

          {view === "health" && health ? (
            <>
              {health.services.map((s: any) => (
                <View key={s.name} style={styles.svcRow}>
                  <View style={[styles.dot, { backgroundColor: s.ok ? C.emerald : C.red }]} />
                  <Text style={styles.svcName}>{s.name}</Text>
                  <Text style={[styles.svcStatus, { color: s.ok ? C.emerald : C.red }]}>{s.status}</Text>
                </View>
              ))}
              <Text style={styles.section}>Platform Counts</Text>
              <View style={styles.grid}>
                {Object.entries(health.counts).map(([k, v]) => (
                  <View key={k} style={styles.stat}><Text style={styles.statLabel}>{k}</Text><Text style={styles.statVal}>{Number(v).toLocaleString()}</Text></View>
                ))}
              </View>
            </>
          ) : null}
        </>
      )}
      <View style={{ height: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: C.text, fontSize: 22, fontWeight: "800" },
  sub: { color: C.muted, fontSize: 12, marginTop: 2, marginBottom: SP.md },
  subTabs: { flexDirection: "row", gap: SP.sm, marginBottom: SP.md },
  subTab: { paddingHorizontal: SP.md, height: 34, borderRadius: 9999, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  subTabOn: { backgroundColor: C.violet, borderColor: C.violet },
  subTabText: { color: C.sub, fontWeight: "700", fontSize: 12 },
  count: { color: C.sub, fontSize: 12, fontWeight: "700", marginBottom: SP.sm },
  card: { backgroundColor: C.cardAlt, borderRadius: 10, padding: SP.md, marginBottom: SP.sm, borderWidth: 1, borderColor: C.border },
  rowHead: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.violet, alignItems: "center", justifyContent: "center" },
  name: { color: C.text, fontSize: 14, fontWeight: "700" },
  meta: { color: C.muted, fontSize: 11, marginTop: 2 },
  tagPending: { color: C.amber, fontSize: 10, fontWeight: "800" },
  roleChip: { paddingHorizontal: 12, height: 30, borderRadius: 9999, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", marginRight: 6 },
  roleOn: { backgroundColor: C.violet, borderColor: C.violet },
  roleText: { color: C.sub, fontWeight: "700", fontSize: 11, textTransform: "capitalize" },
  actions: { flexDirection: "row", gap: SP.sm, marginTop: SP.sm },
  btn: { flex: 1, height: 38, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: SP.sm },
  stat: { width: "48.5%", backgroundColor: C.cardAlt, borderRadius: 10, padding: SP.md, marginBottom: SP.sm, borderWidth: 1, borderColor: C.border },
  statLabel: { color: C.muted, fontSize: 11, textTransform: "capitalize" },
  statVal: { color: C.text, fontSize: 20, fontWeight: "800", marginTop: 4 },
  empty: { color: C.muted, textAlign: "center", paddingVertical: SP.lg },
  svcRow: { flexDirection: "row", alignItems: "center", backgroundColor: C.cardAlt, borderRadius: 10, padding: SP.md, marginBottom: SP.sm, borderWidth: 1, borderColor: C.border },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: SP.sm },
  svcName: { flex: 1, color: C.text, fontSize: 14, fontWeight: "600" },
  svcStatus: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  section: { color: C.violet, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginTop: SP.md, marginBottom: SP.sm },
});
