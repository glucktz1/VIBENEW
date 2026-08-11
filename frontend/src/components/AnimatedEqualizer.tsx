import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  cancelAnimation,
} from "react-native-reanimated";
import { COLORS } from "@/src/theme";

function Bar({ delay, color, playing, size }: { delay: number; color: string; playing: boolean; size: number }) {
  const min = size * 0.25;
  const h = useSharedValue(min);

  useEffect(() => {
    cancelAnimation(h);
    if (playing) {
      h.value = withDelay(delay, withRepeat(withTiming(size, { duration: 380 }), -1, true));
    } else {
      h.value = withTiming(min, { duration: 200 });
    }
    return () => cancelAnimation(h);
  }, [playing, size, delay, min, h]);

  const style = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[styles.bar, { backgroundColor: color, width: Math.max(2, size * 0.16) }, style]} />;
}

export default function AnimatedEqualizer({
  playing = true,
  color = COLORS.primary,
  size = 18,
}: {
  playing?: boolean;
  color?: string;
  size?: number;
}) {
  return (
    <View style={[styles.wrap, { width: size + 2, height: size }]}>
      <Bar delay={0} color={color} playing={playing} size={size} />
      <Bar delay={130} color={color} playing={playing} size={size} />
      <Bar delay={260} color={color} playing={playing} size={size} />
      <Bar delay={90} color={color} playing={playing} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  bar: { borderRadius: 2 },
});
