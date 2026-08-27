import { StyleSheet, Text, View } from "react-native";
import { AnimatedBar, CountUpText } from "@/components/motion";
import { useTranslation } from "@/lib/locale-provider";

type StorageHealthCardProps = {
  score: number;
  usedPercent: number;
  reclaimableText: string;
};

export function StorageHealthCard({ score, usedPercent, reclaimableText }: StorageHealthCardProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.card} accessibilityRole="text" accessibilityLabel={t("healthA11y", { score, value: usedPercent, hint: reclaimableText })}>
      <Text style={styles.label}>{t("healthLabel")}</Text>
      <CountUpText value={score} format={(value) => `${Math.round(value)} / 100`} style={styles.score} />
      <Text style={styles.caption}>{t("phonePercentFull", { value: usedPercent })}</Text>
      <AnimatedBar progress={usedPercent} trackStyle={styles.track} fillStyle={styles.fill} />
      <Text style={styles.hint}>{reclaimableText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#EEF2FF", borderRadius: 16, padding: 14, marginTop: 12 },
  label: { color: "#4F46E5", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  score: { color: "#312E81", fontSize: 26, fontWeight: "800", marginTop: 4 },
  caption: { color: "#3730A3", fontSize: 12, marginTop: 2 },
  hint: { color: "#475569", fontSize: 12, marginTop: 4 },
  track: { height: 6, backgroundColor: "#C7D2FE", borderRadius: 4, marginTop: 10, overflow: "hidden" },
  fill: { height: 6, backgroundColor: "#4F46E5", borderRadius: 4 },
});

