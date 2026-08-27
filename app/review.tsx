import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { CountUpText, FadeIn, PressableScale } from "@/components/motion";
import { ScreenContainer } from "@/components/screen-container";
import { useCleaner, formatStorage } from "@/lib/cleaner-store";
import { getCleanupProgressAccessibilityLabel } from "@/lib/deletion-logic";
import { useTranslation } from "@/lib/locale-provider";

export default function ReviewScreen() {
  const { t } = useTranslation();
  const { items, selectedBytes, completeCleanup } = useCleaner();
  const { restored } = useLocalSearchParams<{ restored?: string }>();
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [restoredNoticeVisible, setRestoredNoticeVisible] = useState(false);
  const mountedRef = useRef(true);
  const cleanupRequestRef = useRef(0);
  useEffect(() => () => { mountedRef.current = false; }, []);
  useEffect(() => { if (restored === "1" && mountedRef.current) { setRestoredNoticeVisible(true); try { AccessibilityInfo.announceForAccessibility("Cleanup undone. Selected items are restored for review."); } catch { /* optional accessibility channel */ } } }, [restored]);
  const selected = items.filter((item) => item.selected);

  const handleCleanup = async () => {
    if (isCleaning || !mountedRef.current || selected.length === 0) return;
    const requestId = cleanupRequestRef.current + 1;
    cleanupRequestRef.current = requestId;
    setIsCleaning(true);
    setCleanupError(null);
    try { AccessibilityInfo.announceForAccessibility("Cleanup started safely. Only your selected items are being processed."); } catch { /* optional accessibility channel */ }
    try {
      await completeCleanup();
      if (!mountedRef.current || cleanupRequestRef.current !== requestId) return;
      router.replace("/complete");
    } catch {
      if (mountedRef.current && cleanupRequestRef.current === requestId) setCleanupError("Cleanup could not finish. Your files were left unchanged; you can retry safely.");
    } finally {
      if (mountedRef.current && cleanupRequestRef.current === requestId) setIsCleaning(false);
    }
  };

  const confirmCleanup = () => {
    if (isCleaning || selected.length === 0) return;
    const itemLabel = selected.length === 1 ? "item" : "items";
    Alert.alert(
      `Remove ${selected.length} ${itemLabel}?`,
      `${formatStorage(selectedBytes)} will be cleared. Only the items you selected are affected. You can still cancel.`,
      [
        { text: "Not now", style: "cancel" },
        { text: "Clean now", style: "destructive", onPress: () => { void handleCleanup(); } },
      ],
    );
  };

  return (
    <ScreenContainer className="px-5 pt-3">
      <PressableScale haptic={false} accessibilityRole="button" accessibilityLabel="Back to results" onPress={() => router.replace("/results")} style={styles.back}>
        <MaterialIcons name="arrow-back" size={21} color="#111827" />
        <Text style={styles.backText}>{t("backToResults")}</Text>
      </PressableScale>
      <View accessible accessibilityRole="text" accessibilityLabel={t("finalSafetyReview")} style={styles.stepRow}><View style={styles.stepDone}><MaterialIcons name="check" size={13} color="#FFFFFF" /></View><View style={styles.stepLine} /><View style={styles.stepActive}><Text style={styles.stepNumber}>3</Text></View><Text style={styles.stepLabel}>{t("finalSafetyReview")}</Text></View>
      <FadeIn>
        <Text style={styles.eyebrow}>{t("finalReview")}</Text>
        <View style={styles.titleRow}><Text style={styles.title}>Ready to clear </Text><CountUpText value={selectedBytes} format={formatStorage} style={styles.title} /><Text style={styles.title}>?</Text></View>
        <Text style={styles.subtitle}>{t("onlyItemsBelow")}</Text>
      <View accessible accessibilityRole="text" accessibilityLabel={t("nothingRemovedUntilConfirm")} style={styles.safetyPill}><MaterialIcons name="shield" size={16} color="#047857" /><Text style={styles.safetyPillText}>{t("nothingRemovedUntilConfirm")}</Text></View>
      {restoredNoticeVisible ? <View accessible accessibilityRole="text" accessibilityLiveRegion="polite" accessibilityLabel={t("cleanupUndone")} style={styles.restoredBanner}><MaterialIcons name="undo" size={18} color="#3730A3" /><Text style={styles.restoredText}>{t("itemsRestored")}</Text><PressableScale haptic={false} accessibilityRole="button" accessibilityLabel={t("dismissRestored")} accessibilityHint="Hides this confirmation message" onPress={() => setRestoredNoticeVisible(false)} style={styles.restoredDismiss}><MaterialIcons name="close" size={16} color="#3730A3" /></PressableScale></View> : null}
      <View accessible accessibilityRole="text" accessibilityLabel={`${t("privacyByDesign")}. ${t("scanningCleanupLocal")}`} style={styles.privacy}>
        <MaterialIcons name="verified-user" size={24} color="#10B981" />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.privacyTitle}>{t("privacyByDesign")}</Text>
          <Text style={styles.subtitle}>{t("scanningCleanupLocal")}</Text>
        </View>
      </View>
      <Text accessibilityRole="text" accessibilityLiveRegion="polite" accessibilityLabel={`${selected.length} selected ${selected.length === 1 ? "item" : "items"} ready for cleanup.`} style={styles.section}>SELECTED ITEMS · {selected.length}</Text>
      <ScrollView style={styles.itemList} contentContainerStyle={styles.itemListContent} showsVerticalScrollIndicator={false}>
        {selected.map((item, index) => (
          <FadeIn key={item.id} delay={Math.min(index, 6) * 50}>
            <View accessible accessibilityRole="text" accessibilityLabel={`${item.name}, ${formatStorage(item.size)}, selected for cleanup.`} style={styles.row}>
              <View style={styles.dot}><MaterialIcons name="check" size={14} color="#FFF" /></View>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.itemSize}>{formatStorage(item.size)}</Text>
            </View>
          </FadeIn>
        ))}
      </ScrollView>
      </FadeIn>
      {cleanupError ? <View accessible accessibilityRole="alert" accessibilityLiveRegion="assertive" accessibilityLabel={cleanupError} style={styles.errorBox}><MaterialIcons name="error-outline" size={20} color="#B91C1C" /><Text style={styles.errorText}>{cleanupError}</Text></View> : null}
      {isCleaning ? <Text accessible accessibilityRole="text" accessibilityLiveRegion="polite" accessibilityLabel={getCleanupProgressAccessibilityLabel(true)} style={styles.progressAnnouncement}>Cleaning safely…</Text> : null}
      <PressableScale accessibilityRole="button" accessibilityLabel={isCleaning ? "Cleaning selected items" : selected.length === 0 ? "No items selected for cleanup" : `Review and clean ${formatStorage(selectedBytes)} from ${selected.length} selected ${selected.length === 1 ? "item" : "items"}`} accessibilityHint={selected.length === 0 ? "Return to Results and select at least one safe item" : "Asks for confirmation, then removes only the selected items"} accessibilityState={{ disabled: isCleaning || selected.length === 0 }} disabled={isCleaning || selected.length === 0} onPress={confirmCleanup} style={[styles.button, isCleaning && styles.buttonDisabled]}>
        <MaterialIcons name={isCleaning ? "hourglass-top" : "delete-sweep"} size={21} color="#FFF" />
        <Text style={styles.buttonText}>{isCleaning ? "Cleaning safely…" : selected.length === 0 ? "Select items to continue" : "Clean selected items"}</Text>
      </PressableScale>
      <Text style={styles.note}>You can always review your storage again after cleanup.</Text>
    </ScreenContainer>
  );
}

  const styles = StyleSheet.create({ titleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" }, stepRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 }, stepDone: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#10B981", alignItems: "center", justifyContent: "center" }, stepActive: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#4F46E5", alignItems: "center", justifyContent: "center" }, stepNumber: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" }, stepLine: { width: 22, height: 2, backgroundColor: "#C7D2FE", marginHorizontal: 6 }, stepLabel: { color: "#4F46E5", fontSize: 10, fontWeight: "800", letterSpacing: 1, marginLeft: 9 }, safetyPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, backgroundColor: "#ECFDF5", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, marginTop: 14 }, safetyPillText: { color: "#047857", fontSize: 11, fontWeight: "800" }, restoredBanner: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#EEF2FF", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10 }, restoredText: { flex: 1, color: "#3730A3", fontSize: 12, fontWeight: "800" }, restoredDismiss: { width: 28, height: 28, alignItems: "center", justifyContent: "center" }, back: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 34 }, backText: { color: "#475569", fontWeight: "700" }, eyebrow: { color: "#64748B", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }, title: { color: "#111827", fontSize: 30, lineHeight: 36, fontWeight: "800", marginTop: 8 }, subtitle: { color: "#64748B", fontSize: 14, lineHeight: 21, marginTop: 10 }, privacy: { flexDirection: "row", alignItems: "center", backgroundColor: "#ECFDF5", padding: 15, borderRadius: 17, marginTop: 24 }, privacyTitle: { color: "#047857", fontWeight: "800", marginBottom: 2 }, section: { color: "#94A3B8", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginTop: 28, marginBottom: 10 }, itemList: { flexGrow: 0, flexShrink: 1, maxHeight: 220 }, itemListContent: { paddingBottom: 4 }, row: { flexDirection: "row", alignItems: "center", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }, dot: { width: 23, height: 23, borderRadius: 8, backgroundColor: "#4F46E5", alignItems: "center", justifyContent: "center", marginRight: 11 }, itemName: { flex: 1, color: "#334155", fontSize: 14, fontWeight: "700" }, itemSize: { color: "#64748B", fontSize: 12, fontWeight: "700" }, errorBox: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#FEF2F2", borderRadius: 14, padding: 12, marginBottom: 12 }, errorText: { flex: 1, color: "#991B1B", fontSize: 12, lineHeight: 18 }, progressAnnouncement: { color: "#4F46E5", fontSize: 12, fontWeight: "800", textAlign: "center", marginBottom: 10 }, button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#DC2626", borderRadius: 16, paddingVertical: 16 }, buttonDisabled: { opacity: 0.65 }, buttonText: { color: "#FFF", fontSize: 15, fontWeight: "800" }, note: { color: "#94A3B8", fontSize: 11, textAlign: "center", marginTop: 12, marginBottom: 4 } });
