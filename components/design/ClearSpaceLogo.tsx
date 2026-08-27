import { View, Text, StyleSheet } from "react-native";
import { BRAND } from "@/lib/branding";

export function ClearSpaceLogo() {
  return (
    <View style={styles.container} accessibilityRole="image" accessibilityLabel={`${BRAND.name} logo`}>
      <View style={styles.glyphOuter}>
        <View style={styles.glyphInner} />
      </View>
      <Text style={styles.name}>{BRAND.shortName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 8 },
  glyphOuter: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
  },
  glyphInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4F46E5",
  },
  name: { color: "#111827", fontSize: 15, fontWeight: "800" },
});

