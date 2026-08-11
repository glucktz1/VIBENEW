import React from "react";
import { useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MiniPlayer from "@/src/components/MiniPlayer";

// A single MiniPlayer mounted at the root so it persists across ALL screens
// (tabs + stack). It docks above the tab bar on tab routes and near the
// bottom safe-area on other routes, and hides on the full player + auth.
export default function GlobalMiniPlayer() {
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  const top = segments[0] as string | undefined;
  if (top === "player" || top === "(auth)") return null;

  const inTabs = top === "(tabs)";
  const tabBarHeight = 58 + insets.bottom;
  const bottomOffset = inTabs ? tabBarHeight + 6 : insets.bottom + 10;

  return <MiniPlayer bottomOffset={bottomOffset} />;
}
