import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useTranslation } from "@/lib/locale-provider";
import { ClearSpaceLogo } from "./ClearSpaceLogo";

type ClearSpaceHeaderProps = {
  title?: string;
  subtitle?: string;
  style?: ViewStyle;
};

export function ClearSpaceHeader({ title, subtitle, style }: ClearSpaceHeaderProps) {
  const { t } = useTranslation();
  return (
    <View style={[styles.wrap, style]}>
      <ClearSpaceLogo />
      <Text style={styles.brandName}>{t("appName")}</Text>
      <Text style={styles.productType}>{subtitle ?? t("appSubtitle")}</Text>
      {title ? <Text style={styles.pageTitle}>{title}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  brandName: { color: "#111827", fontSize: 22, fontWeight: "800", marginTop: 2 },
  productType: { color: "#64748B", fontSize: 13, fontWeight: "700" },
  pageTitle: { color: "#111827", fontSize: 30, lineHeight: 36, fontWeight: "800", marginTop: 8 },
});

