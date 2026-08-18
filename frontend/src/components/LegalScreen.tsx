import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useRouter } from "expo-router";
import { billingApi } from "@/src/services/api";
import { useLang } from "@/src/context/LanguageContext";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function LegalScreen({ kind }: { kind: "terms" | "privacy" }) {
  const router = useRouter();
  const { t } = useLang();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const title = kind === "terms" ? t("profile.terms") : t("profile.privacy");

  useEffect(() => {
    (async () => {
      try {
        const s = await billingApi.publicSettings();
        setUrl((kind === "terms" ? s.terms_url : s.privacy_url) || "");
      } catch { setUrl(""); }
      finally { setLoading(false); }
    })();
  }, [kind]);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="legal-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
      ) : url ? (
        Platform.OS === "web" ? (
          <View style={{ flex: 1 }}>
            {/* @ts-ignore iframe is valid on web */}
            <iframe src={url} style={{ flex: 1, border: "none", width: "100%", height: "100%" }} title={title} />
          </View>
        ) : (
          <WebView source={{ uri: url }} style={{ flex: 1, backgroundColor: COLORS.background }} startInLoadingState renderLoading={() => <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />} />
        )
      ) : (
        <View style={styles.empty}>
          <Ionicons name={kind === "terms" ? "document-text-outline" : "shield-checkmark-outline"} size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>{t("common.notSet")}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { flex: 1, textAlign: "center", color: COLORS.text, fontSize: FONT.lg, fontWeight: "800", marginHorizontal: SPACING.sm },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  emptyText: { color: COLORS.textMuted, fontSize: FONT.md, marginTop: SPACING.md, textAlign: "center" },
});
