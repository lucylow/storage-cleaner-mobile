import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useThemeContext } from "@/lib/theme-provider";
import { playImpact } from "@/lib/haptics";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type FadeInProps = {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

export function FadeIn({ children, delay = 0, style }: FadeInProps) {
  const { reducedMotion } = useThemeContext();
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reducedMotion ? 0 : 14)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, friction: 8, tension: 70, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, opacity, reducedMotion, translateY]);

  return <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>{children}</Animated.View>;
}

type PressableScaleProps = Omit<PressableProps, "style"> & {
  children: ReactNode;
  haptic?: boolean;
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
};

export function PressableScale({ children, haptic = true, scaleTo = 0.975, style, onPressIn, onPressOut, disabled, ...props }: PressableScaleProps) {
  const { reducedMotion } = useThemeContext();
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    if (reducedMotion) {
      scale.setValue(1);
      return;
    }
    Animated.spring(scale, { toValue: value, friction: 7, tension: 180, useNativeDriver: true }).start();
  };

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={(event) => {
        if (!disabled) {
          animateTo(scaleTo);
          if (haptic) void playImpact();
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateTo(1);
        onPressOut?.(event);
      }}
      style={[style, { transform: [{ scale }] }]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}

type AnimatedBarProps = {
  progress: number;
  trackStyle?: StyleProp<ViewStyle>;
  fillStyle?: StyleProp<ViewStyle>;
  duration?: number;
};

export function AnimatedBar({ progress, trackStyle, fillStyle, duration = 720 }: AnimatedBarProps) {
  const { reducedMotion } = useThemeContext();
  const safeProgress = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
  const width = useRef(new Animated.Value(reducedMotion ? safeProgress : 0)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: safeProgress,
      duration: reducedMotion ? 0 : duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [duration, reducedMotion, safeProgress, width]);

  return (
    <View style={trackStyle}>
      <Animated.View
        style={[
          fillStyle,
          {
            width: width.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
          },
        ]}
      />
    </View>
  );
}

type CountUpTextProps = {
  value: number;
  format: (value: number) => string;
  style?: StyleProp<TextStyle>;
  duration?: number;
};

export function CountUpText({ value, format, style, duration = 680 }: CountUpTextProps) {
  const { reducedMotion } = useThemeContext();
  const animated = useRef(new Animated.Value(reducedMotion ? value : 0)).current;
  const [display, setDisplay] = useState(reducedMotion ? value : 0);

  useEffect(() => {
    if (reducedMotion) {
      animated.setValue(value);
      setDisplay(value);
      return;
    }
    const listener = animated.addListener(({ value: next }) => setDisplay(next));
    Animated.timing(animated, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => animated.removeListener(listener);
  }, [animated, duration, reducedMotion, value]);

  return <Text style={style}>{format(display)}</Text>;
}

export function LiveDot({ color = "#4F46E5", size = 6, style }: { color?: string; size?: number; style?: StyleProp<ViewStyle> }) {
  const { reducedMotion } = useThemeContext();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.45, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reducedMotion]);

  return (
    <View style={[{ width: size + 8, height: size + 8, alignItems: "center", justifyContent: "center" }, style]}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: size + 8,
          height: size + 8,
          borderRadius: (size + 8) / 2,
          backgroundColor: color,
          opacity: reducedMotion ? 0 : pulse.interpolate({ inputRange: [1, 1.45], outputRange: [0.18, 0] }),
          transform: [{ scale: pulse }],
        }}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

type CircularProgressProps = {
  progress: number;
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  fillColor?: string;
  children?: ReactNode;
};

export function CircularProgress({
  progress,
  size = 64,
  strokeWidth = 5,
  trackColor = "#3730A3",
  fillColor = "#C7D2FE",
  children,
}: CircularProgressProps) {
  const { reducedMotion } = useThemeContext();
  const safeProgress = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const animated = useRef(new Animated.Value(reducedMotion ? safeProgress : 0)).current;

  useEffect(() => {
    Animated.timing(animated, {
      toValue: safeProgress,
      duration: reducedMotion ? 0 : 820,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animated, reducedMotion, safeProgress]);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={fillColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={animated.interpolate({
            inputRange: [0, 100],
            outputRange: [circumference, 0],
          })}
        />
      </Svg>
      {children}
    </View>
  );
}

type RadarOrbProps = {
  active: boolean;
  cancelled?: boolean;
  children: ReactNode;
};

export function RadarOrb({ active, cancelled, children }: RadarOrbProps) {
  const { reducedMotion } = useThemeContext();
  const ringA = useRef(new Animated.Value(0)).current;
  const ringB = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    if (!active || reducedMotion) {
      ringA.setValue(0);
      ringB.setValue(0);
      rotate.setValue(0);
      glow.setValue(1);
      return;
    }
    const makeRing = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 1700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
    const spin = Animated.loop(Animated.timing(rotate, { toValue: 1, duration: 2800, easing: Easing.linear, useNativeDriver: true }));
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.88, duration: 850, useNativeDriver: true }),
      ]),
    );
    const first = makeRing(ringA, 0);
    const second = makeRing(ringB, 650);
    first.start();
    second.start();
    spin.start();
    breathe.start();
    return () => {
      first.stop();
      second.stop();
      spin.stop();
      breathe.stop();
    };
  }, [active, glow, reducedMotion, ringA, ringB, rotate]);

  const ringStyle = (value: Animated.Value) => ({
    ...StyleSheet.absoluteFillObject,
    borderRadius: 80,
    borderWidth: 1.5,
    borderColor: "rgba(79,70,229,0.32)",
    opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.42] }) }],
  });

  return (
    <View style={radarStyles.wrap}>
      {active && !reducedMotion ? (
        <>
          <Animated.View pointerEvents="none" style={ringStyle(ringA)} />
          <Animated.View pointerEvents="none" style={ringStyle(ringB)} />
        </>
      ) : null}
      <Animated.View
        style={[
          radarStyles.orb,
          cancelled && radarStyles.cancelled,
          active && { opacity: glow, transform: [{ rotate: rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const radarStyles = StyleSheet.create({
  wrap: { width: 168, height: 168, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  orb: { width: 112, height: 112, borderRadius: 56, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  cancelled: { backgroundColor: "#F1F5F9" },
});

export function ShimmerBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  const { reducedMotion } = useThemeContext();
  const shimmer = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (reducedMotion) {
      shimmer.setValue(0.55);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, shimmer]);

  return <Animated.View style={[{ backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 10, opacity: shimmer }, style]} />;
}

export function PopScale({ active, children, style }: { active: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { reducedMotion } = useThemeContext();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion || !active) {
      scale.setValue(1);
      return;
    }
    scale.setValue(0.82);
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }).start();
  }, [active, reducedMotion, scale]);

  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

export function SpinningIcon({ spinning, children }: { spinning: boolean; children: ReactNode }) {
  const { reducedMotion } = useThemeContext();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!spinning || reducedMotion) {
      spin.setValue(0);
      return;
    }
    const animation = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 780, easing: Easing.linear, useNativeDriver: true }));
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, spin, spinning]);

  return (
    <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
      {children}
    </Animated.View>
  );
}
