import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator,
  TextInput, Modal, KeyboardAvoidingView, Platform, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { LineChart, BarChart, PieChart } from "react-native-gifted-charts";
import { adminApi, musicApi } from "@/src/services/api";
import { useAuth } from "@/src/context/AuthContext";

// Gracefy admin palette (zinc / violet) — faithful to the original web dashboard
const C = {
  bg: "#09090b",
  card: "#18181b",
  cardAlt: "rgba(24,24,27,0.6)",
  border: "#27272a",
  text: "#ffffff",
  sub: "#a1a1aa",
  muted: "#71717a",
  violet: "#8b5cf6",
  emerald: "#10b981",
  amber: "#f59e0b",
  blue: "#3b82f6",
  pink: "#ec4899",
  red: "#ef4444",
};
const PIE_COLORS = ["#8b5cf6", "#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#ec4899"];
const GENDER_COLORS = ["#3b82f6", "#ec4899", "#8b5cf6", "#6b7280"];
const SP = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
const CHART_W = Dimensions.get("window").width - 2 * SP.md - 2 * SP.md;

const MENU = [
  { group: "Reports & Analytics", items: [
    { label: "Dashboard", icon: "grid", tab: "overview" },
    { label: "Analytics", icon: "stats-chart", tab: "overview" },
    { label: "Revenue", icon: "cash", tab: "overview" },
    { label: "Transactions", icon: "receipt", tab: "overview" },
  ]},
  { group: "Contents", items: [
    { label: "Songs & Albums", icon: "musical-notes", tab: "content" },
    { label: "Live Radio", icon: "radio" },
    { label: "Neno la Leo", icon: "sunny" },
    { label: "Bible", icon: "book" },
  ]},
  { group: "Control & Management", items: [
    { label: "App Users", icon: "people", tab: "users" },
    { label: "Admin Users", icon: "shield-checkmark", tab: "users" },
    { label: "Churches", icon: "business" },
    { label: "Religious Leaders", icon: "person" },
    { label: "Choir & Singers", icon: "mic" },
    { label: "Donations", icon: "heart" },
    { label: "Subscriptions", icon: "pricetags" },
  ]},
  { group: "System", items: [
    { label: "Settings", icon: "settings" },
    { label: "Feedback", icon: "chatbubbles" },
  ]},
];

export default function AdminDashboard() {
  const router = useRouter();
  const { isAdmin, isGuest, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "content" | "users">("overview");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState("");

  // dashboard analytics
  const [overview, setOverview] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [demographics, setDemographics] = useState<any>(null);
  const [realtime, setRealtime] = useState<any>(null);
  const [downloadStats, setDownloadStats] = useState<any>(null);
  const [liveListeners, setLiveListeners] = useState<any>(null);
  const pollRef = useRef<any>(null);

  // add forms
  const [showAlbum, setShowAlbum] = useState(false);
  const [showSong, setShowSong] = useState(false);
  const [albForm, setAlbForm] = useState({ title: "", artist_name: "", thumbnail: "" });
  const [songForm, setSongForm] = useState({ title: "", album_id: "", audio_url: "" });

  const load = useCallback(async () => {
    try {
      const [u, a, ov, tr, dm, rt, dl, ll] = await Promise.all([
        adminApi.users().catch(() => []),
        musicApi.albums().catch(() => []),
        adminApi.overview().catch(() => null),
        adminApi.trends().catch(() => null),
        adminApi.demographics().catch(() => null),
        adminApi.realtime().catch(() => null),
        adminApi.downloadStats().catch(() => null),
        adminApi.liveListeners().catch(() => null),
      ]);
      setUsers(u); setAlbums(a);
      setOverview(ov); setTrends(tr); setDemographics(dm);
      setRealtime(rt); setDownloadStats(dl); setLiveListeners(ll);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    load();
    // refresh realtime + live listeners every 15s (faithful to original)
    pollRef.current = setInterval(async () => {
      const [rt, ll] = await Promise.all([
        adminApi.realtime().catch(() => null),
        adminApi.liveListeners().catch(() => null),
      ]);
      if (rt) setRealtime(rt);
      if (ll) setLiveListeners(ll);
    }, 15000);
    return () => clearInterval(pollRef.current);
  }, [isAdmin, load]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  const createAlbum = async () => {
    if (!albForm.title || !albForm.artist_name) return;
    try {
      await adminApi.createAlbum({ ...albForm, thumbnail: albForm.thumbnail || "https://picsum.photos/seed/vibe/400" });
      setShowAlbum(false); setAlbForm({ title: "", artist_name: "", thumbnail: "" });
      flash("Albamu imeongezwa"); load();
    } catch (e: any) { flash(e.message); }
  };

  const createSong = async () => {
    if (!songForm.title || !songForm.album_id || !songForm.audio_url) return;
    try {
      await adminApi.createSong(songForm);
      setShowSong(false); setSongForm({ title: "", album_id: "", audio_url: "" });
      flash("Wimbo umeongezwa"); load();
    } catch (e: any) { flash(e.message); }
  };

  if (authLoading) return <View style={styles.center}><ActivityIndicator color={C.violet} size="large" /></View>;

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <Ionicons name="lock-closed" size={48} color={C.muted} />
        <Text style={styles.denied}>Huna ruhusa ya admin</Text>
        {isGuest ? (
          <>
            <Text style={styles.deniedSub}>Ingia na akaunti ya admin ili kuendelea.</Text>
            <Pressable testID="admin-login" style={styles.primary} onPress={() => router.push("/(auth)/login")}>
              <Text style={styles.primaryText}>Ingia kama Admin</Text>
            </Pressable>
          </>
        ) : null}
        <Pressable style={styles.ghostBtn} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.ghostBtnText}>Rudi Nyumbani</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="admin-menu" onPress={() => setDrawerOpen(true)} hitSlop={10}>
          <Ionicons name="menu" size={26} color={C.text} />
        </Pressable>
        <Text style={styles.h1}>Admin Dashboard</Text>
        <Pressable testID="admin-back" onPress={() => router.replace("/(tabs)")} hitSlop={10}>
          <Ionicons name="home" size={22} color={C.sub} />
        </Pressable>
      </View>

      <View style={styles.segment}>
        {(["overview", "content", "users"] as const).map((t) => (
          <Pressable key={t} testID={`admin-tab-${t}`} style={[styles.segBtn, tab === t && styles.segActive]} onPress={() => setTab(t)}>
            <Text style={[styles.segText, tab === t && styles.segTextActive]}>
              {t === "overview" ? "Dashboard" : t === "content" ? "Content" : "Users"}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: SP.md, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {tab === "overview" ? (
            <DashboardOverview
              overview={overview} trends={trends} demographics={demographics}
              realtime={realtime} downloadStats={downloadStats} liveListeners={liveListeners}
            />
          ) : null}

          {tab === "content" ? (
            <>
              <View style={styles.actionRow}>
                <Pressable testID="admin-add-album" style={styles.actBtn} onPress={() => setShowAlbum(true)}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.actText}>Albamu</Text>
                </Pressable>
                <Pressable testID="admin-add-song" style={[styles.actBtn, { backgroundColor: C.emerald }]} onPress={() => setShowSong(true)}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.actText}>Wimbo</Text>
                </Pressable>
              </View>
              <Text style={styles.sectionTitle}>Albamu ({albums.length})</Text>
              {albums.map((a) => (
                <View key={a.album_id} style={styles.contentRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.topTitle} numberOfLines={1}>{a.title}</Text>
                    <Text style={styles.topSub}>{a.artist_name} · {a.songs_count} nyimbo</Text>
                  </View>
                </View>
              ))}
            </>
          ) : null}

          {tab === "users" ? (
            <>
              <Text style={styles.sectionTitle}>Watumiaji ({users.length})</Text>
              {users.map((u, i) => (
                <View key={i} style={styles.contentRow}>
                  <View style={styles.userAvatar}>
                    <Ionicons name="person" size={16} color="#fff" />
                  </View>
                  <View style={{ flex: 1, marginLeft: SP.sm }}>
                    <Text style={styles.topTitle} numberOfLines={1}>{u.name || u.email}</Text>
                    <Text style={styles.topSub} numberOfLines={1}>{u.email}</Text>
                  </View>
                  {u.is_premium ? <Ionicons name="star" size={16} color={C.amber} /> : null}
                  {u.role !== "customer" ? <Text style={styles.roleBadge}>{u.role}</Text> : null}
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      )}

      {toast ? <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View> : null}

      {/* Side drawer navigation */}
      <Modal transparent visible={drawerOpen} animationType="slide" onRequestClose={() => setDrawerOpen(false)}>
        <Pressable style={styles.drawerOverlay} onPress={() => setDrawerOpen(false)}>
          <Pressable style={styles.drawer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.drawerHead}>
              <Ionicons name="musical-notes" size={20} color={C.violet} />
              <Text style={styles.drawerTitle}>Admin Dashboard</Text>
              <Pressable testID="drawer-close" onPress={() => setDrawerOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={C.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {MENU.map((grp) => (
                <View key={grp.group} style={{ marginBottom: SP.md }}>
                  <Text style={styles.drawerGroup}>{grp.group}</Text>
                  {grp.items.map((it) => (
                    <Pressable
                      key={it.label}
                      testID={`menu-${(it.tab || it.label).toLowerCase().replace(/\s+/g, "-")}`}
                      style={styles.drawerItem}
                      onPress={() => {
                        setDrawerOpen(false);
                        if (it.tab) setTab(it.tab as any);
                        else flash(`${it.label}: Inakuja hivi karibuni`);
                      }}
                    >
                      <Ionicons name={it.icon as any} size={18} color={it.tab === tab ? C.violet : C.sub} />
                      <Text style={[styles.drawerLabel, it.tab === tab && { color: C.violet, fontWeight: "800" }]}>{it.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add album modal */}
      <FormModal
        visible={showAlbum} title="Ongeza Albamu" onClose={() => setShowAlbum(false)} onSave={createAlbum} testID="album-form"
        fields={[
          { key: "title", label: "Kichwa", value: albForm.title, set: (v: string) => setAlbForm({ ...albForm, title: v }) },
          { key: "artist_name", label: "Msanii", value: albForm.artist_name, set: (v: string) => setAlbForm({ ...albForm, artist_name: v }) },
          { key: "thumbnail", label: "URL ya Picha (hiari)", value: albForm.thumbnail, set: (v: string) => setAlbForm({ ...albForm, thumbnail: v }) },
        ]}
      />
      {/* Add song modal */}
      <FormModal
        visible={showSong} title="Ongeza Wimbo" onClose={() => setShowSong(false)} onSave={createSong} testID="song-form"
        fields={[
          { key: "title", label: "Kichwa", value: songForm.title, set: (v: string) => setSongForm({ ...songForm, title: v }) },
          { key: "album_id", label: "Album ID", value: songForm.album_id, set: (v: string) => setSongForm({ ...songForm, album_id: v }) },
          { key: "audio_url", label: "URL ya Sauti", value: songForm.audio_url, set: (v: string) => setSongForm({ ...songForm, audio_url: v }) },
        ]}
      />
    </SafeAreaView>
  );
}

// ============ Dashboard Overview (faithful port of Gracefy Dashboard.jsx) ============
function DashboardOverview({ overview, trends, demographics, realtime, downloadStats, liveListeners }: any) {
  const primary = [
    { label: "Total Users", value: overview?.total_users || 0, icon: "people", color: C.violet, sub: `${overview?.total_customers || 0} customers` },
    { label: "Total Songs", value: overview?.total_songs || 0, icon: "musical-notes", color: C.emerald, sub: `${overview?.total_albums || 0} albums` },
    { label: "Churches", value: overview?.total_churches || 0, icon: "business", color: C.amber, sub: `${overview?.total_leaders || 0} leaders` },
    { label: "Total Raised", value: `${overview?.currency || "TZS"} ${Number(overview?.total_raised || 0).toLocaleString()}`, icon: "heart", color: C.pink, sub: `${overview?.total_donations || 0} campaigns` },
  ];
  const secondary = [
    { label: "Customers", value: overview?.total_customers || 0, icon: "people-outline" },
    { label: "System Users", value: overview?.total_system_users || 0, icon: "person-add-outline" },
    { label: "Religious Leaders", value: overview?.total_leaders || 0, icon: "person-outline" },
    { label: "Pending Approvals", value: overview?.pending_approvals || 0, icon: "checkmark-circle-outline" },
  ];

  return (
    <View>
      {/* Page header */}
      <Text style={styles.pageTitle}>Dashboard</Text>
      <Text style={styles.pageSub}>Welcome back! Here&apos;s what&apos;s happening with your platform.</Text>

      {/* Live streaming banner */}
      {(realtime || liveListeners) ? (
        <LinearGradient colors={["rgba(16,185,129,0.18)", "#18181b", "rgba(139,92,246,0.18)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.banner}>
          <View style={styles.bannerRowWrap}>
            <View style={styles.liveDot} />
            <Text style={[styles.bannerAccent, { color: C.emerald }]}>Live</Text>
            <Metric num={liveListeners?.total_active_listeners ?? realtime?.active_streams ?? 0} label="active listeners" />
            <Dot />
            <Metric num={realtime?.guest_visitors_today ?? 0} label="guest visitors" numColor={C.amber} />
            <Dot />
            <Metric num={realtime?.plays_today ?? 0} label="plays today" />
            <Dot />
            <Metric num={realtime?.new_users_today ?? 0} label="new users" numColor={C.emerald} />
            <Dot />
            <Metric num={realtime?.transactions_today ?? 0} label="txns today" numColor={C.amber} />
          </View>
          {liveListeners?.top_playing_now?.length > 0 ? (
            <View style={styles.nowWrap}>
              <Text style={styles.nowLabel}>Now Playing:</Text>
              <View style={styles.chipWrap}>
                {liveListeners.top_playing_now.slice(0, 3).map((it: any, i: number) => (
                  <View key={i} style={styles.pill}>
                    <Text style={styles.pillText}>{it.title} </Text>
                    <Text style={[styles.pillText, { color: C.emerald }]}>· {it.listeners} listening</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </LinearGradient>
      ) : null}

      {/* Download stats banner */}
      {downloadStats ? (
        <LinearGradient colors={["rgba(59,130,246,0.18)", "#18181b", "rgba(99,102,241,0.18)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.banner}>
          <View style={styles.bannerRowWrap}>
            <Ionicons name="download" size={15} color={C.blue} />
            <Text style={[styles.bannerAccent, { color: C.blue, marginLeft: 4 }]}>Downloads</Text>
            <Metric num={downloadStats.total_downloads || 0} label="total" />
            <Dot />
            <Metric num={downloadStats.downloads_today || 0} label="today" />
            <Dot />
            <Metric num={downloadStats.downloads_this_week || 0} label="this week" />
            <Dot />
            <Metric num={downloadStats.unique_downloaders || 0} label="users" />
          </View>
        </LinearGradient>
      ) : null}

      {/* Primary stats */}
      <View style={styles.statGrid}>
        {primary.map((s, i) => (
          <View key={i} testID={`stat-${i}`} style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: s.color + "22" }]}>
              <Ionicons name={s.icon as any} size={20} color={s.color} />
            </View>
            <Text style={styles.statValue} numberOfLines={1}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
            <Text style={styles.statSub}>{s.sub}</Text>
          </View>
        ))}
      </View>

      {/* Secondary stats */}
      <View style={styles.secGrid}>
        {secondary.map((s, i) => (
          <View key={i} style={styles.secCard}>
            <View style={styles.secHead}>
              <Ionicons name={s.icon as any} size={14} color={C.muted} />
              <Text style={styles.secLabel}>{s.label}</Text>
            </View>
            <Text style={styles.secValue}>{s.value}</Text>
          </View>
        ))}
      </View>

      {/* Customer growth (area, 2 series) */}
      <ChartCard icon="trending-up" iconColor={C.violet} title="Customer Growth" desc="Total customers vs active users over time">
        {trends?.user_growth?.length ? (
          <LineChart
            areaChart curved
            data={trends.user_growth.map((d: any) => ({ value: d.users, label: d.month }))}
            data2={trends.user_growth.map((d: any) => ({ value: d.active }))}
            color1={C.violet} color2={C.emerald}
            startFillColor1={C.violet} endFillColor1={C.violet} startOpacity={0.3} endOpacity={0.02}
            startFillColor2={C.emerald} endFillColor2={C.emerald} startOpacity2={0.3} endOpacity2={0.02}
            thickness={2} hideDataPoints hideRules
            yAxisColor={C.border} xAxisColor={C.border}
            yAxisTextStyle={styles.axis} xAxisLabelTextStyle={styles.axis}
            width={CHART_W - 40} height={180} initialSpacing={10} noOfSections={4}
            backgroundColor="transparent"
          />
        ) : <Empty />}
        <Legend items={[{ c: C.violet, t: "Total Users" }, { c: C.emerald, t: "Active Users" }]} />
      </ChartCard>

      {/* Donations trend (area) */}
      <ChartCard icon="cash" iconColor={C.emerald} title="Donations Trend">
        {trends?.donations_trend?.length ? (
          <LineChart
            areaChart curved
            data={trends.donations_trend.map((d: any) => ({ value: d.amount, label: d.month }))}
            color={C.emerald} startFillColor={C.emerald} endFillColor={C.emerald} startOpacity={0.3} endOpacity={0.02}
            thickness={2} hideDataPoints hideRules
            yAxisColor={C.border} xAxisColor={C.border}
            yAxisTextStyle={styles.axis} xAxisLabelTextStyle={styles.axis}
            width={CHART_W - 40} height={180} initialSpacing={10} noOfSections={4}
            backgroundColor="transparent"
          />
        ) : <Empty />}
      </ChartCard>

      {/* Content performance (bar) */}
      <ChartCard icon="play" iconColor={C.amber} title="Content Performance">
        {trends?.content_performance?.length ? (
          <BarChart
            data={trends.content_performance.map((d: any) => ({ value: d.plays, label: d.category, frontColor: C.violet }))}
            barWidth={26} barBorderRadius={4} spacing={18}
            yAxisColor={C.border} xAxisColor={C.border}
            yAxisTextStyle={styles.axis} xAxisLabelTextStyle={styles.axis}
            height={180} noOfSections={4} initialSpacing={12}
            backgroundColor="transparent"
          />
        ) : <Empty />}
      </ChartCard>

      {/* Category distribution (pie) */}
      <ChartCard icon="musical-notes" iconColor={C.pink} title="Category Distribution">
        {trends?.content_performance?.length ? (
          <>
            <View style={{ alignItems: "center", marginVertical: SP.sm }}>
              <PieChart
                donut innerRadius={55} radius={90}
                innerCircleColor={C.card}
                data={trends.content_performance.map((d: any, i: number) => ({ value: d.plays, color: PIE_COLORS[i % PIE_COLORS.length] }))}
              />
            </View>
            <Legend items={trends.content_performance.map((d: any, i: number) => ({ c: PIE_COLORS[i % PIE_COLORS.length], t: d.category }))} />
          </>
        ) : <Empty />}
      </ChartCard>

      {/* User Demographics */}
      <View style={styles.demoHead}>
        <Ionicons name="people" size={20} color={C.violet} />
        <Text style={styles.demoTitle}>User Demographics</Text>
      </View>

      <ChartCard icon="phone-portrait" iconColor={C.blue} title="Device Type" small>
        <DemoPie data={demographics?.device?.data} colorsByName />
      </ChartCard>

      <ChartCard icon="people" iconColor={C.pink} title="Gender" small>
        <DemoPie data={demographics?.gender?.data} genderColors />
      </ChartCard>

      <ChartCard icon="calendar" iconColor={C.amber} title="Age Groups" small>
        {demographics?.age?.data?.length ? (
          <BarChart
            horizontal
            data={demographics.age.data.map((d: any) => ({ value: d.value, label: d.name, frontColor: C.amber }))}
            barWidth={16} barBorderRadius={4} spacing={14}
            yAxisColor={C.border} xAxisColor={C.border}
            yAxisTextStyle={styles.axis} xAxisLabelTextStyle={styles.axis}
            height={160} noOfSections={4}
            backgroundColor="transparent"
          />
        ) : <Empty />}
      </ChartCard>

      <ChartCard icon="location" iconColor={C.emerald} title="Top Locations" desc={`${demographics?.location?.total_locations || 0} countries`} small>
        {demographics?.location?.data?.length ? (
          demographics.location.data.slice(0, 8).map((it: any, i: number) => {
            const pct = Math.min(100, (it.value / (demographics?.total_users || 1)) * 100);
            return (
              <View key={i} style={styles.locRow}>
                <Text style={styles.locRank}>{i + 1}.</Text>
                <Text style={styles.locName} numberOfLines={1}>{it.name}</Text>
                <View style={styles.locBarTrack}>
                  <View style={[styles.locBarFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.locVal}>{it.value}</Text>
              </View>
            );
          })
        ) : <Text style={styles.emptyText}>No location data yet</Text>}
      </ChartCard>
    </View>
  );
}

function Metric({ num, label, numColor = C.text }: any) {
  return (
    <Text style={styles.metric}>
      <Text style={[styles.metricNum, { color: numColor }]}>{Number(num).toLocaleString()}</Text> {label}
    </Text>
  );
}
const Dot = () => <Text style={styles.metricDot}>•</Text>;

function ChartCard({ icon, iconColor, title, desc, small, children }: any) {
  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHead}>
        <Ionicons name={icon} size={small ? 16 : 18} color={iconColor} />
        <Text style={[styles.chartTitle, small && { fontSize: 13 }]}>{title}</Text>
      </View>
      {desc ? <Text style={styles.chartDesc}>{desc}</Text> : null}
      {children}
    </View>
  );
}

function Legend({ items }: any) {
  return (
    <View style={styles.legendWrap}>
      {items.map((it: any, i: number) => (
        <View key={i} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: it.c }]} />
          <Text style={styles.legendText}>{it.t}</Text>
        </View>
      ))}
    </View>
  );
}

function DemoPie({ data, colorsByName, genderColors }: any) {
  if (!data?.length) return <Empty />;
  const DEV: Record<string, string> = { ANDROID: "#3ddc84", IOS: "#a1a1aa", WEB: "#3b82f6", UNKNOWN: "#6b7280" };
  const colorFor = (name: string, i: number) =>
    colorsByName ? (DEV[name] || PIE_COLORS[i % PIE_COLORS.length]) : genderColors ? GENDER_COLORS[i % GENDER_COLORS.length] : PIE_COLORS[i % PIE_COLORS.length];
  return (
    <>
      <View style={{ alignItems: "center", marginVertical: SP.sm }}>
        <PieChart donut innerRadius={38} radius={62} innerCircleColor={C.card}
          data={data.map((d: any, i: number) => ({ value: d.value, color: colorFor(d.name, i) }))} />
      </View>
      <View style={styles.legendWrap}>
        {data.map((d: any, i: number) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colorFor(d.name, i) }]} />
            <Text style={styles.legendText}>{d.name}: {d.value}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

const Empty = () => <Text style={styles.emptyText}>No data yet</Text>;

function FormModal({ visible, title, fields, onClose, onSave, testID }: any) {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.sheet} testID={testID}>
          <View style={styles.handle} />
          <Text style={styles.modalTitle}>{title}</Text>
          {fields.map((f: any) => (
            <View key={f.key} style={{ marginBottom: SP.sm }}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <TextInput
                testID={`${testID}-${f.key}`}
                style={styles.input}
                value={f.value}
                onChangeText={f.set}
                placeholder={f.label}
                placeholderTextColor={C.muted}
                autoCapitalize="none"
              />
            </View>
          ))}
          <Pressable testID={`${testID}-save`} style={styles.saveBtn} onPress={onSave}>
            <Text style={styles.saveText}>Hifadhi</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Ghairi</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: SP.lg },
  denied: { color: C.text, fontSize: 16, fontWeight: "700", marginTop: SP.md },
  deniedSub: { color: C.sub, fontSize: 14, textAlign: "center", marginTop: SP.sm, paddingHorizontal: SP.lg },
  ghostBtn: { paddingVertical: SP.md, marginTop: SP.sm },
  ghostBtnText: { color: C.muted, fontSize: 14, fontWeight: "600" },
  primary: { backgroundColor: C.violet, borderRadius: 9999, paddingHorizontal: SP.xl, height: 48, alignItems: "center", justifyContent: "center", marginTop: SP.lg },
  primaryText: { color: "#fff", fontWeight: "800" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SP.md },
  h1: { color: C.text, fontSize: 20, fontWeight: "800" },

  segment: { flexDirection: "row", marginHorizontal: SP.md, backgroundColor: C.card, borderRadius: 10, padding: 4 },
  segBtn: { flex: 1, paddingVertical: SP.sm, borderRadius: 8, alignItems: "center" },
  segActive: { backgroundColor: C.violet },
  segText: { color: C.sub, fontWeight: "700", fontSize: 12 },
  segTextActive: { color: "#fff" },

  pageTitle: { color: C.text, fontSize: 24, fontWeight: "800" },
  pageSub: { color: C.muted, fontSize: 12, marginTop: 2, marginBottom: SP.md },

  banner: { borderRadius: 14, padding: SP.md, marginBottom: SP.md, borderWidth: 1, borderColor: C.border },
  bannerRowWrap: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  bannerAccent: { fontWeight: "700", fontSize: 13, marginRight: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.emerald, marginRight: 6 },
  metric: { color: C.sub, fontSize: 12, marginRight: 4 },
  metricNum: { fontWeight: "800" },
  metricDot: { color: C.muted, marginHorizontal: 4 },
  nowWrap: { marginTop: SP.sm, paddingTop: SP.sm, borderTopWidth: 1, borderTopColor: "rgba(63,63,70,0.5)" },
  nowLabel: { color: C.muted, fontSize: 11, marginBottom: 6 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: { backgroundColor: "rgba(39,39,42,0.6)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, flexDirection: "row" },
  pillText: { color: C.text, fontSize: 11 },

  statGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  statCard: { width: "48.5%", backgroundColor: C.cardAlt, borderRadius: 12, padding: SP.md, marginBottom: SP.sm, borderWidth: 1, borderColor: C.border },
  statIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statValue: { color: C.text, fontSize: 22, fontWeight: "800", marginTop: SP.sm },
  statLabel: { color: C.sub, fontSize: 13, marginTop: 2 },
  statSub: { color: C.muted, fontSize: 11, marginTop: 2 },

  secGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: SP.xs, marginBottom: SP.md },
  secCard: { width: "48.5%", backgroundColor: "rgba(24,24,27,0.4)", borderRadius: 10, padding: SP.md, marginBottom: SP.sm, borderWidth: 1, borderColor: "rgba(39,39,42,0.5)" },
  secHead: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  secLabel: { color: C.muted, fontSize: 11, marginLeft: 6 },
  secValue: { color: C.text, fontSize: 18, fontWeight: "700" },

  chartCard: { backgroundColor: C.cardAlt, borderRadius: 12, padding: SP.md, borderWidth: 1, borderColor: C.border, marginBottom: SP.md },
  chartHead: { flexDirection: "row", alignItems: "center" },
  chartTitle: { color: C.text, fontSize: 15, fontWeight: "700", marginLeft: 8 },
  chartDesc: { color: C.muted, fontSize: 11, marginTop: 2, marginBottom: SP.sm },
  axis: { color: C.muted, fontSize: 10 },

  legendWrap: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: SP.sm },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { color: C.sub, fontSize: 11 },

  demoHead: { flexDirection: "row", alignItems: "center", marginTop: SP.sm, marginBottom: SP.sm },
  demoTitle: { color: C.text, fontSize: 18, fontWeight: "800", marginLeft: 8 },

  locRow: { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  locRank: { width: 20, color: C.muted, fontSize: 11 },
  locName: { flex: 1, color: C.sub, fontSize: 13 },
  locBarTrack: { width: 64, height: 6, borderRadius: 3, backgroundColor: C.border, overflow: "hidden", marginHorizontal: 8 },
  locBarFill: { height: "100%", backgroundColor: C.emerald, borderRadius: 3 },
  locVal: { width: 32, textAlign: "right", color: C.sub, fontSize: 11 },

  emptyText: { color: C.muted, fontSize: 12, textAlign: "center", paddingVertical: SP.lg },

  sectionTitle: { color: C.text, fontSize: 16, fontWeight: "800", marginTop: SP.lg, marginBottom: SP.sm },
  topTitle: { color: C.text, fontSize: 14, fontWeight: "600" },
  topSub: { color: C.sub, fontSize: 12, marginTop: 2 },
  actionRow: { flexDirection: "row", gap: SP.sm, marginBottom: SP.sm },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: C.violet, borderRadius: 8, height: 46 },
  actText: { color: "#fff", fontWeight: "800", marginLeft: 4 },
  contentRow: { flexDirection: "row", alignItems: "center", paddingVertical: SP.sm, borderBottomWidth: 1, borderBottomColor: C.border },
  userAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.violet, alignItems: "center", justifyContent: "center" },
  roleBadge: { color: C.amber, fontSize: 10, fontWeight: "800", marginLeft: SP.sm, textTransform: "uppercase" },

  toast: { position: "absolute", bottom: 40, left: SP.lg, right: SP.lg, backgroundColor: C.card, borderRadius: 8, padding: SP.md, borderWidth: 1, borderColor: C.border },
  toastText: { color: C.text, textAlign: "center", fontWeight: "600" },

  drawerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", flexDirection: "row" },
  drawer: { width: "78%", maxWidth: 320, height: "100%", backgroundColor: C.card, borderRightWidth: 1, borderRightColor: C.border, padding: SP.md, paddingTop: SP.xl },
  drawerHead: { flexDirection: "row", alignItems: "center", marginBottom: SP.lg },
  drawerTitle: { flex: 1, color: C.text, fontSize: 16, fontWeight: "800", marginLeft: SP.sm },
  drawerGroup: { color: C.muted, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: SP.xs, marginTop: SP.xs },
  drawerItem: { flexDirection: "row", alignItems: "center", paddingVertical: SP.sm, paddingLeft: SP.sm },
  drawerLabel: { color: C.text, fontSize: 14, marginLeft: SP.md, fontWeight: "600" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: SP.lg, paddingBottom: SP.xl },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginBottom: SP.md },
  modalTitle: { color: C.text, fontSize: 20, fontWeight: "800", marginBottom: SP.md },
  fieldLabel: { color: C.sub, fontSize: 12, marginBottom: 4 },
  input: { backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: SP.md, height: 46, color: C.text, borderWidth: 1, borderColor: C.border },
  saveBtn: { backgroundColor: C.violet, borderRadius: 9999, height: 50, alignItems: "center", justifyContent: "center", marginTop: SP.sm },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  cancelBtn: { alignItems: "center", paddingVertical: SP.md },
  cancelText: { color: C.muted },
});
