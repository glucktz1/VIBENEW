import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator,
  Modal, Dimensions, useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { LineChart, BarChart, PieChart } from "react-native-gifted-charts";
import { adminApi } from "@/src/services/api";
import { adminArtistApi } from "@/src/services/artistApi";
import ContentManager from "@/src/components/admin/ContentManager";
import CategoriesManager from "@/src/components/admin/CategoriesManager";
import UsersManager from "@/src/components/admin/UsersManager";
import SettingsManager from "@/src/components/admin/SettingsManager";
import AdvertisingManager from "@/src/components/admin/AdvertisingManager";
import RecommendationManager from "@/src/components/admin/RecommendationManager";
import ControlManager from "@/src/components/admin/ControlManager";
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

// Faithful port of Gracefy's admin sidebar navigation tree (App.js).
// `tab` maps to a functional screen; items without `tab` show a "coming soon" toast.
const NAV: any[] = [
  { type: "group", key: "reports", label: "Reports & Analytics", icon: "trending-up", items: [
    { label: "Dashboard", icon: "grid", tab: "overview" },
    { label: "Analytics", icon: "pulse", tab: "analytics" },
    { label: "Location Analytics", icon: "location", tab: "location" },
    { label: "Revenue", icon: "cash", tab: "revenue" },
    { label: "Transactions", icon: "receipt", tab: "transactions" },
    { label: "Withdrawals", icon: "card", tab: "withdrawals" },
  ]},
  { type: "group", key: "contents", label: "Contents", icon: "folder", items: [
    { label: "Albums & Songs", icon: "musical-notes", tab: "content" },
    { label: "Podcasts", icon: "mic-outline" },
    { label: "Books", icon: "book-outline" },
    { label: "Special Mixes", icon: "disc" },
    { label: "Categories", icon: "pricetags", tab: "categories" },
  ]},
  { type: "group", key: "control", label: "Control & Management", icon: "shield", items: [
    { label: "Role Management", icon: "shield-half", tab: "control", sub: "roles" },
    { label: "Approvals", icon: "checkmark-circle", tab: "control", sub: "approvals" },
    { label: "Layout Management", icon: "grid-outline" },
    { label: "CDN Management", icon: "cloud" },
    { label: "HLS Streaming", icon: "radio" },
    { label: "App Health Monitoring", icon: "phone-portrait", tab: "control", sub: "health" },
  ]},
  { type: "group", key: "settings", label: "Settings", icon: "settings", items: [
    { label: "System Settings", icon: "globe", tab: "settings" },
    { label: "App Settings", icon: "settings-outline", tab: "settings" },
    { label: "Branding", icon: "color-palette", tab: "settings" },
    { label: "Legal & Compliance", icon: "document-text", tab: "settings" },
    { label: "Monetization", icon: "card", tab: "settings" },
    { label: "Auth Settings", icon: "lock-closed", tab: "settings" },
    { label: "Security", icon: "lock-closed-outline", tab: "settings" },
  ]},
  { type: "item", label: "Advertising & Campaigns", icon: "megaphone", tab: "advertising" },
  { type: "item", label: "Feedback Manager", icon: "chatbubble-ellipses" },
  { type: "item", label: "Chat & Support", icon: "headset" },
  { type: "item", label: "Knowledge Bank", icon: "bulb" },
  { type: "item", label: "Recommendations", icon: "sparkles", tab: "recommendations" },
  { type: "item", label: "Geo Content", icon: "globe" },
  { type: "group", key: "choir", label: "Artists & Singers", icon: "people-circle", items: [
    { label: "Artists", icon: "mic", tab: "artists" },
    { label: "Artist Management", icon: "people", tab: "artists" },
    { label: "Artist Accounts", icon: "wallet", tab: "withdrawals" },
  ]},
  { type: "group", key: "leaders", label: "Aggregators", icon: "briefcase", items: [
    { label: "Aggregator Management", icon: "people" },
  ]},
  { type: "item", label: "App Users", icon: "people", tab: "users" },
  { type: "item", label: "Admin Users", icon: "shield-checkmark" },
  { type: "item", label: "Production Houses", icon: "business" },
  { type: "item", label: "Live Seminars", icon: "videocam" },
  { type: "item", label: "Live Radio", icon: "radio" },
  { type: "item", label: "Audio Rooms", icon: "mic-circle" },
  { type: "item", label: "Donations", icon: "heart" },
  { type: "item", label: "Community", icon: "chatbubbles" },
  { type: "item", label: "Bookings", icon: "calendar" },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const TAB_TITLES: Record<string, string> = {
  analytics: "Analytics",
  revenue: "Revenue",
  transactions: "Transactions",
  location: "Location Analytics",
  artists: "Artists & Singers",
  withdrawals: "Withdrawals",
  content: "Albums & Songs",
  categories: "Categories",
  settings: "Settings",
  advertising: "Advertising & Campaigns",
  recommendations: "Recommendation Engine",
  control: "Control & Management",
};

export default function AdminDashboard() {
  const router = useRouter();
  const { isAdmin, isGuest, loading: authLoading, user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "content" | "users" | "artists" | "withdrawals" | "analytics" | "revenue" | "transactions" | "location" | "categories" | "settings" | "advertising" | "recommendations" | "control">("overview");
  const [controlView, setControlView] = useState("roles");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ reports: true });
  const [toast, setToast] = useState("");

  // dashboard analytics
  const [overview, setOverview] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [demographics, setDemographics] = useState<any>(null);
  const [realtime, setRealtime] = useState<any>(null);
  const [downloadStats, setDownloadStats] = useState<any>(null);
  const [liveListeners, setLiveListeners] = useState<any>(null);
  const [artistsList, setArtistsList] = useState<any[]>([]);
  const [withdrawalsList, setWithdrawalsList] = useState<any[]>([]);
  const [enhanced, setEnhanced] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [txns, setTxns] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [txStatus, setTxStatus] = useState("all");
  const [analyticsSub, setAnalyticsSub] = useState<"overview" | "users" | "revenue" | "content" | "replays" | "devices" | "datausage">("overview");
  const [aPeriod, setAPeriod] = useState<"7 Days" | "30 Days" | "90 Days" | "1 Year">("30 Days");
  const [dataUsage, setDataUsage] = useState<any>(null);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [deviceDist, setDeviceDist] = useState<any>(null);
  const [contentPerf, setContentPerf] = useState<any>(null);
  const [replayData, setReplayData] = useState<any>(null);
  const [replayPeriod, setReplayPeriod] = useState<"day" | "week" | "month">("week");
  const pollRef = useRef<any>(null);

  const load = useCallback(async () => {
    try {
      const [ov, tr, dm, rt, dl, ll, arts, wds] = await Promise.all([
        adminApi.overview().catch(() => null),
        adminApi.trends().catch(() => null),
        adminApi.demographics().catch(() => null),
        adminApi.realtime().catch(() => null),
        adminApi.downloadStats().catch(() => null),
        adminApi.liveListeners().catch(() => null),
        adminArtistApi.list().catch(() => []),
        adminArtistApi.withdrawals().catch(() => []),
      ]);
      setOverview(ov); setTrends(tr); setDemographics(dm);
      setRealtime(rt); setDownloadStats(dl); setLiveListeners(ll);
      setArtistsList(arts); setWithdrawalsList(wds);
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

  // lazy-load heavier analytics screens on demand
  useEffect(() => {
    if (!isAdmin) return;
    if (tab === "revenue" && !revenue) adminApi.revenueOverview().then(setRevenue).catch(() => {});
    if (tab === "location" && !location) adminApi.locationOverview().then(setLocation).catch(() => {});
    if (tab === "transactions") adminApi.transactions(txStatus).then(setTxns).catch(() => {});
    if (tab === "analytics" && analyticsSub === "datausage" && !dataUsage) adminApi.dataUsage(30).then(setDataUsage).catch(() => {});
    if (tab === "analytics" && (analyticsSub === "users" || analyticsSub === "content" || analyticsSub === "replays" || analyticsSub === "devices") && !breakdown) adminApi.breakdown().then(setBreakdown).catch(() => {});
    if (tab === "analytics" && analyticsSub === "devices" && !deviceDist) adminApi.deviceDistribution().then(setDeviceDist).catch(() => {});
    if (tab === "analytics" && analyticsSub === "content" && !contentPerf) adminApi.contentPerformance().then(setContentPerf).catch(() => {});
    if (tab === "analytics" && analyticsSub === "revenue" && !revenue) adminApi.revenueOverview().then(setRevenue).catch(() => {});
  }, [tab, txStatus, isAdmin, revenue, location, analyticsSub, dataUsage, breakdown, deviceDist, contentPerf]);

  // replays: refetch whenever period changes
  useEffect(() => {
    if (!isAdmin || tab !== "analytics" || analyticsSub !== "replays") return;
    adminApi.replays(replayPeriod).then(setReplayData).catch(() => {});
  }, [tab, analyticsSub, replayPeriod, isAdmin]);

  // fetch enhanced analytics on tab open + whenever the period filter changes
  useEffect(() => {
    if (!isAdmin || tab !== "analytics") return;
    const code = ({ "7 Days": "7d", "30 Days": "30d", "90 Days": "90d", "1 Year": "365d" } as const)[aPeriod];
    adminApi.enhanced(code).then(setEnhanced).catch(() => {});
  }, [aPeriod, tab, isAdmin]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  const onNavPress = (node: any) => {
    setDrawerOpen(false);
    if (node.sub) setControlView(node.sub);
    if (node.tab) setTab(node.tab);
    else flash(`${node.label}: Inakuja hivi karibuni`);
  };

  const setArtistStatus = async (id: string, s: string) => {    try {
      await adminArtistApi.setStatus(id, s);
      setArtistsList((list) => list.map((a) => (a.artist_id === id ? { ...a, status: s } : a)));
      flash(`Artist ${s}`);
    } catch (e: any) { flash(e.message); }
  };

  const setWithdrawalStatus = async (id: string, s: string) => {
    try {
      await adminArtistApi.setWithdrawalStatus(id, s);
      setWithdrawalsList((list) => list.map((w) => (w.withdrawal_id === id ? { ...w, status: s } : w)));
      flash(`Withdrawal ${s}`);
    } catch (e: any) { flash(e.message); }
  };

  const statusColor = (s: string) => s === "approved" || s === "paid" ? C.emerald : s === "rejected" || s === "suspended" ? C.red : C.amber;

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

  const sidebarBody = (
    <>
      <View style={styles.drawerHead}>
        <View style={styles.brandBadge}>
          <Ionicons name="musical-notes" size={16} color="#fff" />
        </View>
        <View style={{ flex: 1, marginLeft: SP.sm }}>
          <Text style={styles.brandName}>Vibe</Text>
          <Text style={styles.brandSub}>Admin Dashboard</Text>
        </View>
        {!isDesktop ? (
          <Pressable testID="drawer-close" onPress={() => setDrawerOpen(false)} hitSlop={10}>
            <Ionicons name="close" size={22} color={C.text} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SP.md }}>
        {NAV.map((node) => {
          if (node.type === "item") {
            const active = node.tab && node.tab === tab;
            return <NavRow key={node.label} node={node} active={!!active} indent={false} onPress={() => onNavPress(node)} />;
          }
          const isOpen = !!expanded[node.key];
          const hasActive = node.items.some((c: any) => c.tab && c.tab === tab);
          return (
            <View key={node.key} style={{ marginBottom: 2 }}>
              <Pressable testID={`nav-group-${node.key}`} style={[styles.groupHead, (isOpen || hasActive) && styles.groupHeadActive]}
                onPress={() => setExpanded((e) => ({ ...e, [node.key]: !e[node.key] }))}>
                <Ionicons name={node.icon as any} size={18} color={isOpen || hasActive ? C.violet : C.sub} />
                <Text style={[styles.groupLabel, (isOpen || hasActive) && { color: C.violet }]}>{node.label}</Text>
                <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={isOpen || hasActive ? C.violet : C.muted} />
              </Pressable>
              {isOpen ? node.items.map((c: any) => (
                <NavRow key={c.label} node={c} active={!!(c.tab && c.tab === tab)} indent onPress={() => onNavPress(c)} />
              )) : null}
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.drawerFooter}>
        <View style={styles.footerAvatar}>
          <Text style={styles.footerAvatarText}>{(user?.name || user?.email || "A").charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerName} numberOfLines={1}>{user?.name || "Vibe Admin"}</Text>
          <Text style={styles.footerEmail} numberOfLines={1}>{user?.email || "admin@vibe.app"}</Text>
        </View>
        <Pressable testID="drawer-logout" hitSlop={10} onPress={async () => { setDrawerOpen(false); await logout(); router.replace("/(tabs)"); }}>
          <Ionicons name="log-out-outline" size={22} color={C.sub} />
        </Pressable>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={{ flex: 1, flexDirection: isDesktop ? "row" : "column" }}>
        {isDesktop ? <View style={styles.desktopSidebar}>{sidebarBody}</View> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
      <View style={styles.header}>
        {!isDesktop ? (
          <Pressable testID="admin-menu" onPress={() => setDrawerOpen(true)} hitSlop={10}>
            <Ionicons name="menu" size={26} color={C.text} />
          </Pressable>
        ) : <View style={{ width: 26 }} />}
        <Text style={styles.h1}>Admin Dashboard</Text>
        <Pressable testID="admin-back" onPress={() => router.replace("/(tabs)")} hitSlop={10}>
          <Ionicons name="home" size={22} color={C.sub} />
        </Pressable>
      </View>

      {(tab === "overview" || tab === "content") ? (
        <View style={styles.segment}>
          {(["overview", "content"] as const).map((t) => (
            <Pressable key={t} testID={`admin-tab-${t}`} style={[styles.segBtn, tab === t && styles.segActive]} onPress={() => setTab(t)}>
              <Text style={[styles.segText, tab === t && styles.segTextActive]}>
                {t === "overview" ? "Dashboard" : "Content"}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Pressable testID="admin-breadcrumb-back" style={styles.crumb} onPress={() => setTab("overview")}>
          <Ionicons name="chevron-back" size={16} color={C.violet} />
          <Text style={styles.crumbText}>Dashboard</Text>
          <Text style={styles.crumbCur}>  ›  {TAB_TITLES[tab] || tab}</Text>
        </Pressable>
      )}

      {loading ? (
        <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} />
      ) : (
        <ScrollView contentContainerStyle={[{ padding: SP.md, paddingBottom: 60 }, isDesktop && styles.desktopContent]} showsVerticalScrollIndicator={false}>
          {tab === "overview" ? (
            <DashboardOverview
              overview={overview} trends={trends} demographics={demographics}
              realtime={realtime} downloadStats={downloadStats} liveListeners={liveListeners}
            />
          ) : null}

          {tab === "content" ? <ContentManager onToast={flash} /> : null}

          {tab === "categories" ? <CategoriesManager onToast={flash} /> : null}

          {tab === "settings" ? <SettingsManager onToast={flash} /> : null}

          {tab === "advertising" ? <AdvertisingManager onToast={flash} /> : null}

          {tab === "recommendations" ? <RecommendationManager onToast={flash} /> : null}

          {tab === "control" ? <ControlManager onToast={flash} initial={controlView} /> : null}

          {tab === "users" ? <UsersManager onToast={flash} /> : null}

          {tab === "artists" ? (
            <>
              <Text style={styles.sectionTitle}>Artists & Singers ({artistsList.length})</Text>
              {artistsList.length === 0 ? <Text style={styles.topSub}>No artists yet.</Text> : null}
              {artistsList.map((a) => (
                <View key={a.artist_id} style={styles.artCard}>
                  <View style={styles.artHead}>
                    <View style={styles.userAvatar}><Ionicons name="mic" size={16} color="#fff" /></View>
                    <View style={{ flex: 1, marginLeft: SP.sm }}>
                      <Text style={styles.topTitle} numberOfLines={1}>{a.name}</Text>
                      <Text style={styles.topSub} numberOfLines={1}>{a.email} · {a.songs_count || 0} songs</Text>
                    </View>
                    <Text style={[styles.statusTag, { color: statusColor(a.status), borderColor: statusColor(a.status) }]}>{a.status}</Text>
                  </View>
                  <View style={styles.artActions}>
                    {a.status !== "approved" ? (
                      <Pressable testID={`artist-approve-${a.artist_id}`} style={[styles.miniBtn, { backgroundColor: C.emerald }]} onPress={() => setArtistStatus(a.artist_id, "approved")}>
                        <Text style={styles.miniBtnText}>Approve</Text>
                      </Pressable>
                    ) : (
                      <Pressable testID={`artist-suspend-${a.artist_id}`} style={[styles.miniBtn, { backgroundColor: C.amber }]} onPress={() => setArtistStatus(a.artist_id, "suspended")}>
                        <Text style={styles.miniBtnText}>Suspend</Text>
                      </Pressable>
                    )}
                    <Pressable testID={`artist-reject-${a.artist_id}`} style={[styles.miniBtn, { backgroundColor: C.red }]} onPress={() => setArtistStatus(a.artist_id, "rejected")}>
                      <Text style={styles.miniBtnText}>Reject</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </>
          ) : null}

          {tab === "withdrawals" ? (
            <>
              <Text style={styles.sectionTitle}>Withdrawal Requests ({withdrawalsList.length})</Text>
              {withdrawalsList.length === 0 ? <Text style={styles.topSub}>No withdrawal requests yet.</Text> : null}
              {withdrawalsList.map((w) => (
                <View key={w.withdrawal_id} style={styles.artCard}>
                  <View style={styles.artHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.topTitle}>{w.currency} {Number(w.amount).toLocaleString()}</Text>
                      <Text style={styles.topSub} numberOfLines={1}>{w.artist_name} · {w.method} · {w.details || "-"}</Text>
                    </View>
                    <Text style={[styles.statusTag, { color: statusColor(w.status), borderColor: statusColor(w.status) }]}>{w.status}</Text>
                  </View>
                  {w.status === "pending" ? (
                    <View style={styles.artActions}>
                      <Pressable testID={`wd-approve-${w.withdrawal_id}`} style={[styles.miniBtn, { backgroundColor: C.blue }]} onPress={() => setWithdrawalStatus(w.withdrawal_id, "approved")}>
                        <Text style={styles.miniBtnText}>Approve</Text>
                      </Pressable>
                      <Pressable testID={`wd-paid-${w.withdrawal_id}`} style={[styles.miniBtn, { backgroundColor: C.emerald }]} onPress={() => setWithdrawalStatus(w.withdrawal_id, "paid")}>
                        <Text style={styles.miniBtnText}>Mark Paid</Text>
                      </Pressable>
                      <Pressable testID={`wd-reject-${w.withdrawal_id}`} style={[styles.miniBtn, { backgroundColor: C.red }]} onPress={() => setWithdrawalStatus(w.withdrawal_id, "rejected")}>
                        <Text style={styles.miniBtnText}>Reject</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ))}
            </>
          ) : null}

          {tab === "analytics" ? (
            !enhanced ? <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} /> : (
              <View>
                <Text style={styles.pageTitle}>Analytics Dashboard</Text>
                <Text style={styles.pageSub}>Comprehensive platform performance metrics</Text>

                <View style={styles.liveBar}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveLabel}>Live</Text>
                  <Text style={styles.liveStat}>  {realtime?.active_streams ?? 0} </Text><Text style={styles.liveMuted}>active streams</Text>
                  <Text style={styles.liveMuted}>   •   </Text>
                  <Text style={styles.liveStat}>{realtime?.active_listeners ?? 0} </Text><Text style={styles.liveMuted}>listeners now</Text>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SP.md }}>
                  {["7 Days", "30 Days", "90 Days", "1 Year"].map((p) => (
                    <Pressable key={p} testID={`period-${p}`} style={[styles.filterChip, aPeriod === p && styles.filterChipActive]} onPress={() => setAPeriod(p)}>
                      <Text style={[styles.filterChipText, aPeriod === p && { color: "#fff" }]}>{p}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subTabs}>
                  {([["overview", "Overview"], ["users", "Users"], ["revenue", "Revenue"], ["content", "Content"], ["replays", "Replays"], ["devices", "Devices"], ["datausage", "Data Usage"]] as const).map(([k, l]) => (
                    <Pressable key={k} testID={`analytics-sub-${k}`} style={[styles.subTab, analyticsSub === k && styles.subTabOn]} onPress={() => setAnalyticsSub(k as any)}>
                      <Text style={[styles.subTabText, analyticsSub === k && { color: "#fff" }]}>{l}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {analyticsSub === "overview" ? (
                  <>
                    <View style={styles.statGrid}>
                      {[
                        { l: "Total Streams", v: enhanced.overview.total_streams, s: `${enhanced.overview.revenue_streams} revenue-eligible`, c: C.violet, i: "play" },
                        { l: "Unique Listeners", v: enhanced.overview.unique_listeners, s: "", c: C.blue, i: "people" },
                        { l: "Total Hours", v: enhanced.overview.total_listening_hours, s: `${enhanced.overview.avg_session_duration} min avg`, c: C.emerald, i: "time" },
                        { l: "Gross Revenue", v: `TZS ${Number(enhanced.overview.gross_revenue).toLocaleString()}`, s: "", c: C.amber, i: "cash" },
                        { l: "Platform Revenue", v: `TZS ${Number(enhanced.overview.platform_revenue).toLocaleString()}`, s: "", c: C.pink, i: "trending-up" },
                        { l: "Songs Played", v: enhanced.overview.unique_songs_played, s: "", c: C.blue, i: "headset" },
                      ].map((s, i) => (
                        <View key={i} style={styles.statCard}>
                          <View style={[styles.statIcon, { backgroundColor: s.c + "22" }]}><Ionicons name={s.i as any} size={20} color={s.c} /></View>
                          <Text style={styles.statValue} numberOfLines={1}>{s.v}</Text>
                          <Text style={styles.statLabel}>{s.l}</Text>
                          {s.s ? <Text style={styles.statSub}>{s.s}</Text> : null}
                        </View>
                      ))}
                    </View>

                    {/* highlight cards */}
                    <View style={styles.hlRow}>
                      <View style={[styles.hlCard, { borderColor: C.emerald }]}>
                        <Text style={styles.hlLabel}>PAID PLAYS</Text>
                        <Text style={[styles.hlValue, { color: C.emerald }]}>{Number(enhanced.overview.revenue_streams).toLocaleString()}</Text>
                      </View>
                      <View style={[styles.hlCard, { borderColor: C.blue }]}>
                        <Text style={styles.hlLabel}>FREE LISTENS</Text>
                        <Text style={[styles.hlValue, { color: C.blue }]}>{Number(enhanced.overview.total_streams - enhanced.overview.revenue_streams).toLocaleString()}</Text>
                      </View>
                      <View style={[styles.hlCard, { borderColor: C.amber }]}>
                        <Text style={styles.hlLabel}>CONVERSION</Text>
                        <Text style={[styles.hlValue, { color: C.amber }]}>{enhanced.overview.total_streams ? Math.round((enhanced.overview.revenue_streams / enhanced.overview.total_streams) * 100) : 0}%</Text>
                      </View>
                    </View>

                    {/* count cards */}
                    <View style={styles.secGrid}>
                      {[
                        { l: "Albums", v: overview?.total_albums || 0, i: "albums" },
                        { l: "Songs", v: overview?.total_songs || 0, i: "musical-notes" },
                        { l: "Artists", v: overview?.total_leaders != null ? (artistsList.length) : 0, i: "mic" },
                        { l: "Users", v: overview?.total_users || 0, i: "people" },
                      ].map((s, i) => (
                        <View key={i} style={styles.secCard}>
                          <View style={styles.secHead}><Ionicons name={s.i as any} size={14} color={C.muted} /><Text style={styles.secLabel}>{s.l}</Text></View>
                          <Text style={styles.secValue}>{s.v}</Text>
                        </View>
                      ))}
                    </View>

                    <ChartCard icon="play" iconColor={C.amber} title="Top Songs">
                      {enhanced.top_songs?.length ? enhanced.top_songs.map((t: any, i: number) => (
                        <View key={i} style={styles.rankRow}>
                          <Text style={styles.locRank}>{i + 1}.</Text>
                          <Text style={styles.locName} numberOfLines={1}>{t.title}</Text>
                          <Text style={styles.locVal}>{Number(t.plays).toLocaleString()} ▶</Text>
                        </View>
                      )) : <Empty />}
                    </ChartCard>
                    <ChartCard icon="musical-notes" iconColor={C.pink} title="Category Distribution">
                      {enhanced.category_breakdown?.length ? (
                        <>
                          <View style={{ alignItems: "center", marginVertical: SP.sm }}>
                            <PieChart donut innerRadius={50} radius={85} innerCircleColor={C.card}
                              data={enhanced.category_breakdown.map((d: any, i: number) => ({ value: d.value, color: PIE_COLORS[i % PIE_COLORS.length] }))} />
                          </View>
                          <Legend items={enhanced.category_breakdown.map((d: any, i: number) => ({ c: PIE_COLORS[i % PIE_COLORS.length], t: d.name }))} />
                        </>
                      ) : <Empty />}
                    </ChartCard>
                  </>
                ) : analyticsSub === "users" ? (
                  !breakdown ? <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} /> : (
                    <>
                      <View style={styles.statGrid}>
                        {[
                          { l: "Total Users", v: Number(breakdown.users.total).toLocaleString(), c: C.violet, i: "people" },
                          { l: "Premium Users", v: Number(breakdown.users.premium).toLocaleString(), c: C.amber, i: "star" },
                          { l: "Free Users", v: Number(breakdown.users.free).toLocaleString(), c: C.blue, i: "person" },
                          { l: "Premium Rate", v: `${breakdown.users.premium_pct}%`, c: C.emerald, i: "trending-up" },
                        ].map((s, i) => (
                          <View key={i} style={styles.statCard}>
                            <View style={[styles.statIcon, { backgroundColor: s.c + "22" }]}><Ionicons name={s.i as any} size={20} color={s.c} /></View>
                            <Text style={styles.statValue} numberOfLines={1}>{s.v}</Text>
                            <Text style={styles.statLabel}>{s.l}</Text>
                          </View>
                        ))}
                      </View>
                      <ChartCard icon="trending-up" iconColor={C.violet} title="User Growth" desc="New sign-ups (last 6 months)">
                        {breakdown.users.growth?.some((d: any) => d.new > 0) ? (
                          <BarChart
                            data={breakdown.users.growth.map((d: any) => ({ value: d.new, label: d.month, frontColor: C.violet }))}
                            barWidth={20} barBorderRadius={4} spacing={18}
                            yAxisColor={C.border} xAxisColor={C.border} yAxisTextStyle={styles.axis} xAxisLabelTextStyle={styles.axis}
                            height={170} noOfSections={4} initialSpacing={12} backgroundColor="transparent" />
                        ) : <Empty />}
                      </ChartCard>
                      <ChartCard icon="pie-chart" iconColor={C.amber} title="Premium vs Free">
                        {breakdown.users.total ? (
                          <>
                            <View style={{ alignItems: "center", marginVertical: SP.sm }}>
                              <PieChart donut innerRadius={50} radius={85} innerCircleColor={C.card}
                                data={[{ value: breakdown.users.premium, color: C.amber }, { value: breakdown.users.free, color: C.blue }]} />
                            </View>
                            <Legend items={[{ c: C.amber, t: `Premium (${breakdown.users.premium})` }, { c: C.blue, t: `Free (${breakdown.users.free})` }]} />
                          </>
                        ) : <Empty />}
                      </ChartCard>
                    </>
                  )
                ) : analyticsSub === "revenue" ? (
                  !revenue ? <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} /> : (
                    <>
                      <View style={styles.statGrid}>
                        {[
                          { l: "Gross Revenue", v: `TZS ${Number(revenue.gross_revenue).toLocaleString()}`, c: C.emerald, i: "cash" },
                          { l: "Platform Earnings", v: `TZS ${Number(revenue.platform_earnings).toLocaleString()}`, c: C.amber, i: "trending-up" },
                          { l: "Artist Payouts", v: `TZS ${Number(revenue.artist_payouts).toLocaleString()}`, c: C.pink, i: "wallet" },
                          { l: "Listening Hours", v: revenue.total_listening_hours, c: C.violet, i: "time" },
                        ].map((s, i) => (
                          <View key={i} style={styles.statCard}>
                            <View style={[styles.statIcon, { backgroundColor: s.c + "22" }]}><Ionicons name={s.i as any} size={20} color={s.c} /></View>
                            <Text style={styles.statValue} numberOfLines={1}>{s.v}</Text>
                            <Text style={styles.statLabel}>{s.l}</Text>
                          </View>
                        ))}
                      </View>
                      <ChartCard icon="cash" iconColor={C.emerald} title="Revenue Over Time" desc="Last 14 days">
                        {revenue.daily?.some((d: any) => d.amount > 0) ? (
                          <LineChart areaChart curved
                            data={revenue.daily.map((d: any) => ({ value: d.amount, label: d.date }))}
                            color={C.emerald} startFillColor={C.emerald} endFillColor={C.emerald} startOpacity={0.3} endOpacity={0.02}
                            thickness={2} hideDataPoints hideRules yAxisColor={C.border} xAxisColor={C.border}
                            yAxisTextStyle={styles.axis} xAxisLabelTextStyle={styles.axis}
                            width={CHART_W - 40} height={170} noOfSections={4} initialSpacing={8} backgroundColor="transparent" />
                        ) : <Empty />}
                      </ChartCard>
                      <ChartCard icon="mic" iconColor={C.violet} title="Top Earning Artists">
                        {revenue.top_artists?.length ? revenue.top_artists.map((a: any, i: number) => (
                          <View key={i} style={styles.rankRow}>
                            <Text style={styles.locRank}>{i + 1}.</Text>
                            <Text style={styles.locName} numberOfLines={1}>{a.name}</Text>
                            <Text style={styles.locVal}>TZS {Number(a.gross).toLocaleString()}</Text>
                          </View>
                        )) : <Empty />}
                      </ChartCard>
                    </>
                  )
                ) : analyticsSub === "content" ? (
                  !contentPerf ? <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} /> : (
                    <>
                      <ChartCard icon="disc" iconColor={C.emerald} title="Album Performance">
                        {contentPerf.albums?.length ? (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ minWidth: 640 }}>
                              <View style={styles.tblHead}>
                                <Text style={[styles.tblTh, { width: 30 }]}>#</Text>
                                <Text style={[styles.tblTh, { width: 170 }]}>Album</Text>
                                <Text style={[styles.tblTh, { width: 110 }]}>Artist</Text>
                                <Text style={[styles.tblTh, { width: 70, textAlign: "right" }]}>Plays</Text>
                                <Text style={[styles.tblTh, { width: 90, textAlign: "right" }]}>Minutes</Text>
                                <Text style={[styles.tblTh, { width: 60, textAlign: "right" }]}>Hours</Text>
                                <Text style={[styles.tblTh, { width: 100, textAlign: "right" }]}>Revenue</Text>
                              </View>
                              {contentPerf.albums.map((a: any, i: number) => (
                                <View key={a.album_id} style={styles.tblRow}>
                                  <Text style={[styles.tblTd, { width: 30, color: C.muted }]}>{i + 1}</Text>
                                  <Text style={[styles.tblTd, { width: 170, color: C.text, fontWeight: "700" }]} numberOfLines={1}>{a.title}</Text>
                                  <Text style={[styles.tblTd, { width: 110 }]} numberOfLines={1}>{a.artist_name}</Text>
                                  <Text style={[styles.tblTd, { width: 70, textAlign: "right", color: C.violet, fontWeight: "700" }]}>{Number(a.total_plays).toLocaleString()}</Text>
                                  <Text style={[styles.tblTd, { width: 90, textAlign: "right", color: C.emerald, fontWeight: "700" }]}>{Number(a.minutes_streamed).toLocaleString()}</Text>
                                  <Text style={[styles.tblTd, { width: 60, textAlign: "right" }]}>{a.total_hours}h</Text>
                                  <Text style={[styles.tblTd, { width: 100, textAlign: "right", color: C.amber, fontWeight: "700" }]}>TZS {Number(a.revenue).toLocaleString()}</Text>
                                </View>
                              ))}
                            </View>
                          </ScrollView>
                        ) : <Empty />}
                      </ChartCard>
                      <ChartCard icon="musical-notes" iconColor={C.violet} title="Top Performing Songs">
                        {contentPerf.top_songs?.length ? contentPerf.top_songs.map((s: any, i: number) => (
                          <View key={i} style={styles.rankRow}>
                            <Text style={styles.locRank}>{i + 1}.</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.locName} numberOfLines={1}>{s.title}</Text>
                              <Text style={styles.songMeta} numberOfLines={1}>{s.artist}{s.album ? ` · ${s.album}` : ""}</Text>
                            </View>
                            <Text style={styles.devVal}>{Number(s.plays).toLocaleString()} ▶  ·  {s.hours}h</Text>
                          </View>
                        )) : <Empty />}
                      </ChartCard>
                    </>
                  )
                ) : analyticsSub === "replays" ? (
                  <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SP.md }}>
                      {(["day", "week", "month"] as const).map((p) => (
                        <Pressable key={p} testID={`replay-period-${p}`} style={[styles.filterChip, replayPeriod === p && styles.filterChipActive]} onPress={() => setReplayPeriod(p)}>
                          <Text style={[styles.filterChipText, replayPeriod === p && { color: "#fff" }]}>{p === "day" ? "Today" : p === "week" ? "This Week" : "This Month"}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    {!replayData ? <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} /> : (
                      <>
                        <View style={styles.statGrid}>
                          {[
                            { l: "Users Who Replayed", v: replayData.summary.users_who_replayed, c: C.amber, i: "people" },
                            { l: "Replay Minutes", v: Number(replayData.summary.total_replay_minutes).toLocaleString(), c: C.blue, i: "time" },
                            { l: "Replay Sessions", v: replayData.summary.total_replay_sessions, c: C.violet, i: "repeat" },
                          ].map((s, i) => (
                            <View key={i} style={styles.statCard}>
                              <View style={[styles.statIcon, { backgroundColor: s.c + "22" }]}><Ionicons name={s.i as any} size={20} color={s.c} /></View>
                              <Text style={styles.statValue} numberOfLines={1}>{s.v}</Text>
                              <Text style={styles.statLabel}>{s.l}</Text>
                            </View>
                          ))}
                        </View>
                        <ChartCard icon="people" iconColor={C.amber} title="Users Who Replayed Same Song">
                          {replayData.user_replays?.length ? replayData.user_replays.map((r: any, i: number) => (
                            <View key={i} style={styles.rankRow}>
                              <View style={styles.replayBadge}><Text style={styles.replayBadgeTxt}>{r.replay_count}x</Text></View>
                              <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={styles.locName} numberOfLines={1}>{r.song_title}</Text>
                                <Text style={styles.songMeta} numberOfLines={1}>{r.user_name}</Text>
                              </View>
                              <Text style={styles.devVal}>{r.total_minutes} min</Text>
                            </View>
                          )) : <Empty />}
                        </ChartCard>
                        <ChartCard icon="repeat" iconColor={C.pink} title="Most Replayed Songs">
                          {replayData.top_replayed_songs?.length ? replayData.top_replayed_songs.map((s: any, i: number) => (
                            <View key={i} style={styles.rankRow}>
                              <Text style={styles.locRank}>{i + 1}.</Text>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.locName} numberOfLines={1}>{s.song_title}</Text>
                                <Text style={styles.songMeta} numberOfLines={1}>{s.artist_name} · {s.unique_users} users · {s.replay_ratio}x avg</Text>
                              </View>
                              <Text style={styles.devVal}>{Number(s.total_plays).toLocaleString()} ▶</Text>
                            </View>
                          )) : <Empty />}
                        </ChartCard>
                      </>
                    )}
                  </>
                ) : analyticsSub === "devices" ? (
                  !deviceDist ? <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} /> : (
                    <>
                      <Text style={styles.secHdr}>Device &amp; Platform Distribution</Text>
                      <View style={styles.statGrid}>
                        {(() => {
                          const pd = deviceDist.platform_distribution || {};
                          const tot = deviceDist.total_users || 1;
                          return [
                            { l: "Android Users", v: pd.android || 0, s: `${(((pd.android || 0) / tot) * 100).toFixed(1)}%`, c: C.emerald, i: "logo-android" },
                            { l: "iOS Users", v: pd.ios || 0, s: `${(((pd.ios || 0) / tot) * 100).toFixed(1)}%`, c: C.blue, i: "logo-apple" },
                            { l: "Web Users", v: pd.web || 0, s: `${(((pd.web || 0) / tot) * 100).toFixed(1)}%`, c: C.violet, i: "desktop" },
                            { l: "Unknown Platform", v: pd.unknown || 0, s: "Needs device tracking", c: C.muted, i: "help-circle" },
                          ];
                        })().map((s, i) => (
                          <View key={i} style={styles.statCard}>
                            <View style={[styles.statIcon, { backgroundColor: s.c + "22" }]}><Ionicons name={s.i as any} size={20} color={s.c} /></View>
                            <Text style={styles.statValue} numberOfLines={1}>{s.v}</Text>
                            <Text style={styles.statLabel}>{s.l}</Text>
                            <Text style={styles.statSub}>{s.s}</Text>
                          </View>
                        ))}
                      </View>

                      <ChartCard icon="pie-chart" iconColor={C.blue} title="Platform Distribution">
                        {Object.values(deviceDist.platform_distribution || {}).some((v: any) => v > 0) ? (
                          <>
                            <View style={{ alignItems: "center", marginVertical: SP.sm }}>
                              <PieChart donut innerRadius={50} radius={85} innerCircleColor={C.card}
                                data={Object.entries(deviceDist.platform_distribution || {}).map(([, v]: any, i: number) => ({ value: v, color: PIE_COLORS[i % PIE_COLORS.length] }))} />
                            </View>
                            <Legend items={Object.entries(deviceDist.platform_distribution || {}).map(([k, v]: any, i: number) => ({ c: PIE_COLORS[i % PIE_COLORS.length], t: `${k.charAt(0).toUpperCase() + k.slice(1)} (${v})` }))} />
                          </>
                        ) : <Empty />}
                      </ChartCard>

                      <ChartCard icon="phone-portrait" iconColor={C.emerald} title="Device Manufacturers">
                        {Object.keys(deviceDist.manufacturer_distribution || {}).length ? Object.entries(deviceDist.manufacturer_distribution).map(([name, count]: any, i: number) => (
                          <View key={name} style={styles.rankRow}>
                            <Text style={styles.locRank}>{i + 1}.</Text>
                            <Text style={styles.locName} numberOfLines={1}>{name}</Text>
                            <Text style={styles.devVal}>{count}  ·  {(((count as number) / (deviceDist.total_users || 1)) * 100).toFixed(1)}%</Text>
                          </View>
                        )) : <Empty />}
                      </ChartCard>

                      <ChartCard icon="hardware-chip" iconColor={C.amber} title="Top Device Models">
                        {Object.keys(deviceDist.top_device_models || {}).length ? Object.entries(deviceDist.top_device_models).map(([model, count]: any) => (
                          <View key={model} style={styles.rankRow}>
                            <Text style={styles.locName} numberOfLines={1}>{model}</Text>
                            <Text style={styles.devVal}>{count}</Text>
                          </View>
                        )) : <Empty />}
                      </ChartCard>

                      <ChartCard icon="globe" iconColor={C.blue} title="Location Distribution">
                        {Object.keys(deviceDist.location_distribution || {}).length ? Object.entries(deviceDist.location_distribution).map(([loc, count]: any) => (
                          <View key={loc} style={styles.rankRow}>
                            <Text style={styles.locName} numberOfLines={1}>{loc}</Text>
                            <Text style={styles.devVal}>{count}</Text>
                          </View>
                        )) : <Empty />}
                      </ChartCard>
                    </>
                  )
                ) : (
                  !dataUsage ? <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} /> : (
                    <>
                      <View style={styles.statGrid}>
                        {[
                          { l: "Total Data Used", v: `${dataUsage.total_data_gb} GB`, c: C.violet, i: "cloud" },
                          { l: "Streaming Data", v: `${dataUsage.streaming_gb} GB`, c: C.blue, i: "play" },
                          { l: "Downloads Data", v: `${dataUsage.downloads_gb} GB`, c: C.emerald, i: "download" },
                          { l: "Listening Minutes", v: Number(dataUsage.listening_minutes).toLocaleString(), c: C.amber, i: "time" },
                        ].map((s, i) => (
                          <View key={i} style={styles.statCard}>
                            <View style={[styles.statIcon, { backgroundColor: s.c + "22" }]}><Ionicons name={s.i as any} size={20} color={s.c} /></View>
                            <Text style={styles.statValue} numberOfLines={1}>{s.v}</Text>
                            <Text style={styles.statLabel}>{s.l}</Text>
                          </View>
                        ))}
                      </View>
                      <ChartCard icon="bar-chart" iconColor={C.blue} title="Data Used per Day" desc="Streams + Downloads (MB)">
                        {dataUsage.per_day?.some((d: any) => d.streams_mb + d.downloads_mb > 0) ? (
                          <BarChart
                            data={dataUsage.per_day.slice(-14).map((d: any) => ({ value: Math.round(d.streams_mb + d.downloads_mb), label: d.date, frontColor: C.blue }))}
                            barWidth={12} barBorderRadius={3} spacing={8}
                            yAxisColor={C.border} xAxisColor={C.border} yAxisTextStyle={styles.axis} xAxisLabelTextStyle={styles.axis}
                            height={170} noOfSections={4} initialSpacing={8} backgroundColor="transparent" />
                        ) : <Empty />}
                      </ChartCard>
                      <ChartCard icon="time" iconColor={C.amber} title="Listening Minutes per Day">
                        {dataUsage.minutes_per_day?.some((d: any) => d.minutes > 0) ? (
                          <BarChart
                            data={dataUsage.minutes_per_day.slice(-14).map((d: any) => ({ value: d.minutes, label: d.date, frontColor: C.amber }))}
                            barWidth={12} barBorderRadius={3} spacing={8}
                            yAxisColor={C.border} xAxisColor={C.border} yAxisTextStyle={styles.axis} xAxisLabelTextStyle={styles.axis}
                            height={170} noOfSections={4} initialSpacing={8} backgroundColor="transparent" />
                        ) : <Empty />}
                      </ChartCard>
                    </>
                  )
                )}
              </View>
            )
          ) : null}

          {tab === "revenue" ? (
            !revenue ? <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} /> : (
              <View>
                <Text style={styles.pageTitle}>Revenue & Performance</Text>
                <Text style={styles.pageSub}>Earnings, payouts & top performers</Text>
                <View style={styles.statGrid}>
                  {[
                    { l: "Listening Hours", v: revenue.total_listening_hours, c: C.violet, i: "time" },
                    { l: "Gross Revenue", v: `TZS ${Number(revenue.gross_revenue).toLocaleString()}`, c: C.emerald, i: "cash" },
                    { l: "Platform Earnings", v: `TZS ${Number(revenue.platform_earnings).toLocaleString()}`, c: C.amber, i: "trending-up" },
                    { l: "Artist Payouts", v: `TZS ${Number(revenue.artist_payouts).toLocaleString()}`, c: C.pink, i: "wallet" },
                  ].map((s, i) => (
                    <View key={i} style={styles.statCard}>
                      <View style={[styles.statIcon, { backgroundColor: s.c + "22" }]}><Ionicons name={s.i as any} size={20} color={s.c} /></View>
                      <Text style={styles.statValue} numberOfLines={1}>{s.v}</Text>
                      <Text style={styles.statLabel}>{s.l}</Text>
                    </View>
                  ))}
                </View>
                <ChartCard icon="cash" iconColor={C.emerald} title="Revenue Over Time" desc="Last 14 days">
                  {revenue.daily?.some((d: any) => d.amount > 0) ? (
                    <LineChart areaChart curved
                      data={revenue.daily.map((d: any) => ({ value: d.amount, label: d.date }))}
                      color={C.emerald} startFillColor={C.emerald} endFillColor={C.emerald} startOpacity={0.3} endOpacity={0.02}
                      thickness={2} hideDataPoints hideRules yAxisColor={C.border} xAxisColor={C.border}
                      yAxisTextStyle={styles.axis} xAxisLabelTextStyle={styles.axis}
                      width={CHART_W - 40} height={170} noOfSections={4} initialSpacing={8} backgroundColor="transparent" />
                  ) : <Empty />}
                </ChartCard>
                <ChartCard icon="mic" iconColor={C.violet} title="Top Artists">
                  {revenue.top_artists?.length ? revenue.top_artists.map((a: any, i: number) => (
                    <View key={i} style={styles.rankRow}>
                      <Text style={styles.locRank}>{i + 1}.</Text>
                      <Text style={styles.locName} numberOfLines={1}>{a.name}</Text>
                      <Text style={styles.locVal}>TZS {Number(a.gross).toLocaleString()}</Text>
                    </View>
                  )) : <Text style={styles.emptyText}>No artist revenue data available</Text>}
                </ChartCard>
                <ChartCard icon="albums" iconColor={C.amber} title="Top Albums">
                  {revenue.top_albums?.length ? revenue.top_albums.map((a: any, i: number) => (
                    <View key={i} style={styles.rankRow}>
                      <Text style={styles.locRank}>{i + 1}.</Text>
                      <Text style={styles.locName} numberOfLines={1}>{a.title}</Text>
                      <Text style={styles.locVal}>{Number(a.plays).toLocaleString()} ▶</Text>
                    </View>
                  )) : <Empty />}
                </ChartCard>
              </View>
            )
          ) : null}

          {tab === "transactions" ? (
            <View>
              <Text style={styles.pageTitle}>Transactions</Text>
              <Text style={styles.pageSub}>Monitor and manage payment transactions</Text>
              {txns ? (
                <>
                  <View style={styles.secGrid}>
                    <View style={styles.secCard}><Text style={styles.secLabel}>Total Transactions</Text><Text style={styles.secValue}>{txns.summary.total}</Text></View>
                    <View style={styles.secCard}><Text style={styles.secLabel}>Completed Revenue</Text><Text style={styles.secValue}>TZS {Number(txns.summary.completed_revenue).toLocaleString()}</Text></View>
                    <View style={styles.secCard}><Text style={styles.secLabel}>Pending</Text><Text style={styles.secValue}>{txns.summary.pending}</Text></View>
                    <View style={styles.secCard}><Text style={styles.secLabel}>Failed</Text><Text style={styles.secValue}>{txns.summary.failed}</Text></View>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SP.sm }}>
                    {["all", "completed", "pending", "failed"].map((s) => (
                      <Pressable key={s} testID={`tx-filter-${s}`} style={[styles.filterChip, txStatus === s && styles.filterChipActive]} onPress={() => setTxStatus(s)}>
                        <Text style={[styles.filterChipText, txStatus === s && { color: "#fff" }]}>{s}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  {txns.transactions.length === 0 ? <Text style={styles.emptyText}>No transactions</Text> : null}
                  {txns.transactions.map((t: any, i: number) => (
                    <View key={i} style={styles.txRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.topTitle}>TZS {Number(t.amount).toLocaleString()} · {t.plan_id}</Text>
                        <Text style={styles.topSub} numberOfLines={1}>{t.phone || t.user_id} · {t.gateway} · {(t.created_at || "").slice(0, 10)}</Text>
                      </View>
                      <Text style={[styles.statusTag, { color: statusColor(t.status), borderColor: statusColor(t.status) }]}>{t.status}</Text>
                    </View>
                  ))}
                </>
              ) : <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} />}
            </View>
          ) : null}

          {tab === "location" ? (
            !location ? <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} /> : (
              <View>
                <Text style={styles.pageTitle}>Location Analytics</Text>
                <Text style={styles.pageSub}>Distribution of users across countries</Text>
                <View style={styles.secGrid}>
                  <View style={styles.secCard}><Text style={styles.secLabel}>Total Users</Text><Text style={styles.secValue}>{location.total_users}</Text></View>
                  <View style={styles.secCard}><Text style={styles.secLabel}>Countries</Text><Text style={styles.secValue}>{location.total_countries}</Text></View>
                </View>
                <ChartCard icon="location" iconColor={C.emerald} title="Users by Country">
                  {location.countries?.length ? location.countries.map((c: any, i: number) => {
                    const pct = Math.min(100, (c.value / (location.total_users || 1)) * 100);
                    return (
                      <View key={i} style={styles.locRow}>
                        <Text style={styles.locRank}>{i + 1}.</Text>
                        <Text style={styles.locName} numberOfLines={1}>{c.name}</Text>
                        <View style={styles.locBarTrack}><View style={[styles.locBarFill, { width: `${pct}%` }]} /></View>
                        <Text style={styles.locVal}>{c.value}</Text>
                      </View>
                    );
                  }) : <Empty />}
                </ChartCard>
                <ChartCard icon="trending-up" iconColor={C.violet} title="User Growth" desc="Daily new users and cumulative growth">
                  {location.growth?.length ? (
                    <LineChart areaChart curved
                      data={location.growth.map((d: any) => ({ value: d.cumulative, label: d.month }))}
                      data2={location.growth.map((d: any) => ({ value: d.new }))}
                      color1={C.violet} color2={C.emerald}
                      startFillColor1={C.violet} endFillColor1={C.violet} startOpacity={0.3} endOpacity={0.02}
                      thickness={2} hideDataPoints hideRules yAxisColor={C.border} xAxisColor={C.border}
                      yAxisTextStyle={styles.axis} xAxisLabelTextStyle={styles.axis}
                      width={CHART_W - 40} height={170} noOfSections={4} initialSpacing={8} backgroundColor="transparent" />
                  ) : <Empty />}
                  <Legend items={[{ c: C.violet, t: "Cumulative" }, { c: C.emerald, t: "New" }]} />
                </ChartCard>
              </View>
            )
          ) : null}
        </ScrollView>
      )}

      {toast ? <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View> : null}
        </View>
      </View>

      {/* Side drawer navigation — mobile only */}
      {!isDesktop ? (
        <Modal transparent visible={drawerOpen} animationType="slide" onRequestClose={() => setDrawerOpen(false)}>
          <Pressable style={styles.drawerOverlay} onPress={() => setDrawerOpen(false)}>
            <Pressable style={styles.drawer} onPress={(e) => e.stopPropagation()}>
              {sidebarBody}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

// ============ Dashboard Overview (faithful port of Gracefy Dashboard.jsx) ============
function DashboardOverview({ overview, trends, demographics, realtime, downloadStats, liveListeners }: any) {
  const primary = [
    { label: "Total Users", value: overview?.total_users || 0, icon: "people", color: C.violet, sub: `${overview?.total_customers || 0} customers` },
    { label: "Total Songs", value: overview?.total_songs || 0, icon: "musical-notes", color: C.emerald, sub: `${overview?.total_albums || 0} albums` },
    { label: "Production Houses", value: overview?.total_churches || 0, icon: "business", color: C.amber, sub: `${overview?.total_leaders || 0} aggregators` },
    { label: "Total Raised", value: `${overview?.currency || "TZS"} ${Number(overview?.total_raised || 0).toLocaleString()}`, icon: "cash", color: C.pink, sub: `${overview?.total_donations || 0} campaigns` },
  ];
  const secondary = [
    { label: "Customers", value: overview?.total_customers || 0, icon: "people-outline" },
    { label: "System Users", value: overview?.total_system_users || 0, icon: "person-add-outline" },
    { label: "Aggregators", value: overview?.total_leaders || 0, icon: "briefcase-outline" },
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

function NavRow({ node, active, indent, onPress }: any) {
  return (
    <Pressable
      testID={`nav-${slug(node.label)}`}
      style={[styles.navRow, indent && styles.navIndent, active && styles.navRowActive]}
      onPress={onPress}
    >
      <Ionicons name={node.icon as any} size={indent ? 16 : 18} color={active ? C.violet : C.sub} />
      <Text style={[styles.navLabel, active && { color: C.violet, fontWeight: "700" }]} numberOfLines={1}>{node.label}</Text>
    </Pressable>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  desktopSidebar: { width: 280, height: "100%", backgroundColor: C.card, borderRightWidth: 1, borderRightColor: C.border, paddingTop: SP.md },
  desktopContent: { maxWidth: 1200, width: "100%", alignSelf: "center", paddingHorizontal: SP.lg },
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
  crumb: { flexDirection: "row", alignItems: "center", marginHorizontal: SP.md, paddingVertical: SP.sm },
  crumbText: { color: C.violet, fontWeight: "700", fontSize: 13 },
  crumbCur: { color: C.sub, fontWeight: "700", fontSize: 13 },
  subTabs: { marginBottom: SP.md },
  subTab: { paddingHorizontal: SP.md, height: 34, borderRadius: 9999, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", marginRight: SP.sm },
  subTabOn: { backgroundColor: C.violet, borderColor: C.violet },
  subTabText: { color: C.sub, fontWeight: "700", fontSize: 12 },
  hlRow: { flexDirection: "row", gap: SP.sm, marginBottom: SP.sm },
  hlCard: { flex: 1, backgroundColor: C.cardAlt, borderRadius: 10, padding: SP.sm, borderWidth: 1, alignItems: "center" },
  hlLabel: { color: C.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  hlValue: { fontSize: 18, fontWeight: "900", marginTop: 4 },

  pageTitle: { color: C.text, fontSize: 24, fontWeight: "800" },
  pageSub: { color: C.muted, fontSize: 12, marginTop: 2, marginBottom: SP.md },

  banner: { borderRadius: 14, padding: SP.md, marginBottom: SP.md, borderWidth: 1, borderColor: C.border },
  bannerRowWrap: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  bannerAccent: { fontWeight: "700", fontSize: 13, marginRight: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.emerald, marginRight: 6 },
  liveBar: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 10, paddingHorizontal: SP.md, marginBottom: SP.md },
  liveLabel: { color: C.emerald, fontWeight: "800", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  liveStat: { color: C.text, fontWeight: "800", fontSize: 14 },
  liveMuted: { color: C.muted, fontSize: 12 },
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
  secHdr: { color: C.text, fontSize: 15, fontWeight: "800", marginBottom: SP.sm },
  devVal: { color: C.sub, fontSize: 12, fontWeight: "700", marginLeft: 8 },
  songMeta: { color: C.muted, fontSize: 11, marginTop: 1 },
  tblHead: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  tblTh: { color: C.muted, fontSize: 10, fontWeight: "800", textTransform: "uppercase", paddingRight: 6 },
  tblRow: { flexDirection: "row", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "rgba(39,39,42,0.5)" },
  tblTd: { color: C.sub, fontSize: 12, paddingRight: 6 },
  replayBadge: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.amber + "22", alignItems: "center", justifyContent: "center" },
  replayBadgeTxt: { color: C.amber, fontWeight: "800", fontSize: 12 },

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
  rankRow: { flexDirection: "row", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "rgba(39,39,42,0.5)" },
  filterChip: { paddingHorizontal: SP.md, height: 34, borderRadius: 9999, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", marginRight: SP.sm },
  filterChipActive: { backgroundColor: C.violet, borderColor: C.violet },
  filterChipText: { color: C.sub, fontWeight: "700", fontSize: 12, textTransform: "capitalize" },
  txRow: { flexDirection: "row", alignItems: "center", backgroundColor: C.cardAlt, borderRadius: 10, padding: SP.md, marginBottom: SP.sm, borderWidth: 1, borderColor: C.border },
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
  artCard: { backgroundColor: C.cardAlt, borderRadius: 12, padding: SP.md, marginBottom: SP.sm, borderWidth: 1, borderColor: C.border },
  artHead: { flexDirection: "row", alignItems: "center" },
  statusTag: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", borderWidth: 1, borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 },
  artActions: { flexDirection: "row", gap: SP.sm, marginTop: SP.sm },
  miniBtn: { flex: 1, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  miniBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },

  toast: { position: "absolute", bottom: 40, left: SP.lg, right: SP.lg, backgroundColor: C.card, borderRadius: 8, padding: SP.md, borderWidth: 1, borderColor: C.border },
  toastText: { color: C.text, textAlign: "center", fontWeight: "600" },

  drawerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", flexDirection: "row" },
  drawer: { width: "82%", maxWidth: 320, height: "100%", backgroundColor: "#0b0b0d", borderRightWidth: 1, borderRightColor: C.border, paddingTop: SP.xl },
  drawerHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: SP.md, paddingBottom: SP.md, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: SP.sm },
  brandBadge: { width: 34, height: 34, borderRadius: 9, backgroundColor: C.violet, alignItems: "center", justifyContent: "center" },
  brandName: { color: C.text, fontSize: 16, fontWeight: "800" },
  brandSub: { color: C.muted, fontSize: 11 },
  groupHead: { flexDirection: "row", alignItems: "center", paddingVertical: 11, paddingHorizontal: SP.md, marginHorizontal: SP.sm, borderRadius: 8 },
  groupHeadActive: { backgroundColor: "rgba(139,92,246,0.16)" },
  groupLabel: { flex: 1, color: C.sub, fontSize: 14, fontWeight: "700", marginLeft: SP.sm },
  navRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: SP.md, marginHorizontal: SP.sm, borderRadius: 8 },
  navIndent: { paddingLeft: SP.xl, paddingVertical: 8 },
  navRowActive: { backgroundColor: "rgba(139,92,246,0.16)" },
  navLabel: { flex: 1, color: C.sub, fontSize: 13.5, marginLeft: SP.md, fontWeight: "500" },
  drawerFooter: { flexDirection: "row", alignItems: "center", padding: SP.md, borderTopWidth: 1, borderTopColor: C.border },
  footerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.violet, alignItems: "center", justifyContent: "center", marginRight: SP.sm },
  footerAvatarText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  footerName: { color: C.text, fontSize: 13, fontWeight: "700" },
  footerEmail: { color: C.muted, fontSize: 11 },

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
