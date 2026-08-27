import { MaterialIcons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { StyleSheet, Text, View } from "react-native";
import type { WebInsight } from "@/lib/ai/ai-types";
import { toPlainInsightText } from "@/lib/integrations/serpapi/web-insight-fusion";
import { isSafeHttpsUrl } from "../shared/web-intelligence-allowlist";
import { LiveDot, PressableScale } from "@/components/motion";
import { useTranslation } from "@/lib/locale-provider";

type WebInsightCardProps = {
  insight?: WebInsight | null;
  enabled: boolean;
  available: boolean;
  canRefresh: boolean;
  canRetry?: boolean;
  quotaRemaining: number;
  onRefresh: () => void;
  onRetry?: () => void;
  onAskRelated?: (question: string) => void;
  onEnable?: () => void;
  onUpgrade?: () => void;
};

export function WebInsightCard({
  insight,
  enabled,
  available,
  canRefresh,
  canRetry,
  quotaRemaining,
  onRefresh,
  onRetry,
  onAskRelated,
  onEnable,
  onUpgrade,
}: WebInsightCardProps) {
  const { t } = useTranslation();
  if (!available) return null;
  const status = insight?.status ?? (enabled ? "loading" : "off");
  const errorKey =
    insight?.errorCode === "quota"
      ? "liveWebTipsErrorQuota"
      : insight?.errorCode === "unavailable"
        ? "liveWebTipsErrorUnavailable"
        : insight?.errorCode === "blocked"
          ? "liveWebTipsErrorBlocked"
          : insight?.errorCode === "empty"
            ? "liveWebTipsErrorEmpty"
            : "liveWebTipsErrorNetwork";
  const body =
    status === "ready"
      ? toPlainInsightText(insight?.markdown ?? "")
      : status === "loading"
        ? t("liveWebTipsLoading")
        : status === "error"
          ? t(errorKey)
          : enabled
            ? t("liveWebTipsIdle")
            : t("liveWebTipsOff");

  const openReference = (url: string) => {
    if (!isSafeHttpsUrl(url)) return;
    void WebBrowser.openBrowserAsync(url).catch(() => undefined);
  };

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={t("liveWebTipsA11y", { body })}
      style={styles.card}
    >
      <View style={styles.header}>
        <View style={styles.eyebrowRow}>
          {status === "loading" || insight?.refreshing ? <LiveDot color="#6366F1" size={5} /> : null}
          <Text style={styles.eyebrow}>{t("liveWebTipsEyebrow")}</Text>
        </View>
        {status === "ready" ? <Text style={styles.badge}>{insight?.fromCache ? t("liveWebTipsCached") : t("liveWebTipsPublic")}</Text> : null}
      </View>
      {status === "ready" && insight?.query ? <Text style={styles.query}>{insight.query}</Text> : null}
      <Text style={styles.body}>{body}</Text>
      {status === "ready" && insight?.references.length ? (
        <View style={styles.sources}>
          {insight.references.map((reference) => (
            <PressableScale
              key={`${reference.index}-${reference.url}`}
              accessibilityRole="link"
              accessibilityLabel={t("liveWebTipsOpenSource", { title: reference.title })}
              onPress={() => openReference(reference.url)}
              style={styles.sourceChip}
            >
              <MaterialIcons name="open-in-new" size={12} color="#4338CA" />
              <Text style={styles.sourceText} numberOfLines={1}>
                {reference.source || reference.title}
              </Text>
            </PressableScale>
          ))}
        </View>
      ) : null}
      {status === "ready" && insight?.relatedQuestions.length && onAskRelated ? (
        <View style={styles.related}>
          {insight.relatedQuestions.map((question) => (
            <PressableScale
              key={question}
              accessibilityRole="button"
              accessibilityLabel={t("liveWebTipsAsk", { question })}
              onPress={() => onAskRelated(question)}
              style={styles.relatedChip}
            >
              <Text style={styles.relatedText}>{question}</Text>
            </PressableScale>
          ))}
        </View>
      ) : null}
      <Text style={styles.footer}>{t("liveWebTipsFooter")}</Text>
      <View style={styles.actions}>
        {!enabled && onEnable ? (
          <PressableScale accessibilityRole="button" accessibilityLabel={t("liveWebTipsEnableA11y")} onPress={onEnable} style={styles.button}>
            <Text style={styles.buttonText}>{t("liveWebTipsEnable")}</Text>
          </PressableScale>
        ) : null}
        {enabled && canRetry && onRetry ? (
          <PressableScale accessibilityRole="button" accessibilityLabel={t("liveWebTipsRetryA11y")} onPress={onRetry} style={styles.button}>
            <MaterialIcons name="replay" size={14} color="#312E81" />
            <Text style={styles.buttonText}>{t("liveWebTipsRetry")}</Text>
          </PressableScale>
        ) : null}
        {enabled && canRefresh ? (
          <PressableScale accessibilityRole="button" accessibilityLabel={t("liveWebTipsRefreshA11y")} onPress={onRefresh} style={styles.button}>
            <MaterialIcons name="refresh" size={14} color="#312E81" />
            <Text style={styles.buttonText}>{t("liveWebTipsRefresh")}</Text>
          </PressableScale>
        ) : null}
        {enabled && !canRefresh && !canRetry && status === "ready" && onUpgrade ? (
          <PressableScale accessibilityRole="button" accessibilityLabel={t("liveWebTipsUnlockA11y")} onPress={onUpgrade} style={styles.button}>
            <MaterialIcons name="auto-awesome" size={14} color="#312E81" />
            <Text style={styles.buttonText}>{t("liveWebTipsUnlock")}</Text>
          </PressableScale>
        ) : null}
      </View>
      {enabled ? <Text style={styles.quota}>{t("liveWebTipsQuotaLeft", { count: quotaRemaining })}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#EEF2FF", borderRadius: 16, padding: 13, borderWidth: 1, borderColor: "#E0E7FF" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  eyebrow: { color: "#4338CA", fontSize: 10, fontWeight: "800", letterSpacing: 1.05 },
  badge: { color: "#4338CA", fontSize: 9, fontWeight: "800", letterSpacing: 0.7, backgroundColor: "#FFFFFF", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  query: { color: "#6366F1", fontSize: 10, fontWeight: "700", marginTop: 8 },
  body: { color: "#312E81", fontSize: 12, lineHeight: 18, marginTop: 7 },
  sources: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  sourceChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFFFFF", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, maxWidth: "100%" },
  sourceText: { color: "#4338CA", fontSize: 10, fontWeight: "700", maxWidth: 160 },
  related: { gap: 6, marginTop: 10 },
  relatedChip: { backgroundColor: "#FFFFFF", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7 },
  relatedText: { color: "#3730A3", fontSize: 11, fontWeight: "700" },
  footer: { color: "#6366F1", fontSize: 10, lineHeight: 14, marginTop: 10 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  button: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FFFFFF", borderRadius: 11, paddingHorizontal: 9, paddingVertical: 7 },
  buttonText: { color: "#312E81", fontSize: 11, fontWeight: "800" },
  quota: { color: "#6366F1", fontSize: 10, marginTop: 8, fontWeight: "600" },
});
