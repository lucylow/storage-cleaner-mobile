import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { AnimatedBar, CountUpText, PressableScale } from "@/components/motion";
import { ScreenContainer } from "@/components/screen-container";
import { formatStorage, useCleaner } from "@/lib/cleaner-store";
import { playSuccess } from "@/lib/haptics";
import { useThemeContext } from "@/lib/theme-provider";
import { getCleanupCompletionAccessibilityLabel, getCleanupCompletionCopy, getUndoCountdownAccessibilityLabel, isCleanupBlocked, isCleanupPreview } from "@/lib/deletion-logic";

export default function CompleteScreen() {
  const { reducedMotion } = useThemeContext();
  const { lastCleanupSummary, lastDeletionResult, recoverPermission, canUndoCleanup, undoExpiresAt, undoCleanup } = useCleaner();
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isRecovering, setIsRecovering] = useState(false);
  const mountedRef = useRef(true);
  const recoveryRequestRef = useRef(0);
  const entrance = useRef(new Animated.Value(0)).current;
  const badgePop = useRef(new Animated.Value(0.72)).current;
  const reclaimed = lastCleanupSummary?.reclaimedBytes ?? 0;
  const itemCount = lastCleanupSummary?.itemCount ?? 0;
  const blocked = isCleanupBlocked(lastDeletionResult?.status);
  const preview = isCleanupPreview(lastDeletionResult?.status);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  useEffect(() => {
    if (!canUndoCleanup || !undoExpiresAt) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [canUndoCleanup, undoExpiresAt]);
  const remainingMs = undoExpiresAt ? Math.max(0, undoExpiresAt - now) : 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const undoAvailable = canUndoCleanup && remainingMs > 0;
  const undoProgress = Math.min(1, remainingMs / 30_000);
  const { title, subtitle } = getCleanupCompletionCopy(lastDeletionResult?.status, itemCount);
  const announcement = getCleanupCompletionAccessibilityLabel(lastDeletionResult?.status, itemCount, formatStorage(reclaimed));
  useEffect(() => {
    if (reducedMotion) {
      entrance.setValue(1);
      badgePop.setValue(1);
    } else {
      Animated.timing(entrance, { toValue: 1, duration: 280, useNativeDriver: true }).start();
      Animated.spring(badgePop, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }).start();
      if (!blocked && !preview && itemCount) void playSuccess();
    }
    try { AccessibilityInfo.announceForAccessibility(announcement); } catch { /* optional accessibility channel */ }
    return () => { entrance.stopAnimation(); badgePop.stopAnimation(); };
  }, [announcement, badgePop, blocked, entrance, itemCount, preview, reducedMotion]);
  useEffect(() => {
    if (remainingSeconds !== 10) return;
    try { AccessibilityInfo.announceForAccessibility(getUndoCountdownAccessibilityLabel(remainingSeconds)); } catch { /* optional accessibility channel */ }
  }, [remainingSeconds]);

  const handleUndo = () => { if (!undoAvailable || !mountedRef.current) return; undoCleanup(); try { AccessibilityInfo.announceForAccessibility("Cleanup undone. Selected items were restored for review."); } catch { /* optional accessibility channel */ } router.replace({ pathname: "/review", params: { restored: "1" } }); };

  const handlePermissionRecovery = async () => {
    if (isRecovering || !mountedRef.current) return;
    const requestId = recoveryRequestRef.current + 1;
    recoveryRequestRef.current = requestId;
    setIsRecovering(true);
    setRecoveryMessage(null);
    try {
      const recovery = await recoverPermission();
      if (!mountedRef.current || recoveryRequestRef.current !== requestId) return;
      if (recovery === "granted") {
        router.replace("/review");
      } else if (recovery === "open-settings") {
        setRecoveryMessage("Device Settings was opened. Return here after granting media access, then try again.");
      } else if (recovery === "requested-denied") {
        setRecoveryMessage("Media access is still unavailable. You can review device permissions and retry safely.");
      } else {
        setRecoveryMessage("Permission recovery is unavailable in this environment. Your files were not changed.");
      }
    } catch {
      if (mountedRef.current && recoveryRequestRef.current === requestId) setRecoveryMessage("Permission recovery could not finish. Your files were not changed; you can retry safely.");
    } finally {
      if (mountedRef.current && recoveryRequestRef.current === requestId) setIsRecovering(false);
    }
  };

  return (
    <ScreenContainer className="px-6" edges={["top", "bottom", "left", "right"]}>
      <Animated.View accessibilityLiveRegion="polite" style={[styles.center, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
        <View accessible accessibilityRole="text" accessibilityLabel={blocked ? "Review required. Cleanup needs attention." : preview ? "Preview only. Files were not deleted." : "Cleanup complete."} style={[styles.stepPill, (blocked || preview) && styles.stepPillWarning]}><MaterialIcons name={blocked || preview ? "info-outline" : "verified-user"} size={14} color={blocked || preview ? "#B45309" : "#047857"} /><Text style={[styles.stepPillText, (blocked || preview) && styles.stepPillTextWarning]}>{blocked ? "REVIEW REQUIRED" : preview ? "PREVIEW ONLY" : "CLEANUP COMPLETE"}</Text></View>
        <Animated.View style={[styles.circle, (blocked || preview) && styles.warningCircle, { transform: [{ scale: badgePop }] }]}><MaterialIcons name={blocked || preview ? "info-outline" : "check"} size={58} color="#FFF" /></Animated.View>
        <View accessible accessibilityRole="text" accessibilityLiveRegion="polite" accessibilityLabel={announcement}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View accessible accessibilityRole="text" accessibilityLabel={blocked || preview ? `No storage was reclaimed. ${itemCount} selected ${itemCount === 1 ? "item remains" : "items remain"} on this device.` : `${formatStorage(reclaimed)} reclaimed from ${itemCount} selected ${itemCount === 1 ? "item" : "items"}.`} style={[styles.summary, preview && styles.summaryPreview]}><Text style={[styles.summaryLabel, preview && styles.summaryLabelPreview]}>{preview ? "NOT DELETED" : "SPACE RECLAIMED"}</Text><CountUpText value={preview || blocked ? 0 : reclaimed} format={formatStorage} style={[styles.summaryValue, preview && styles.summaryValuePreview]} /><Text style={[styles.summaryNote, preview && styles.summaryNotePreview]}>{preview ? "Files stay on this device" : `from ${itemCount} selected ${itemCount === 1 ? "item" : "items"}`}</Text></View>
        {blocked ? <PressableScale accessibilityRole="button" accessibilityLabel="Retry media permission recovery" accessibilityState={{ disabled: isRecovering }} disabled={isRecovering} onPress={handlePermissionRecovery} style={[styles.button, isRecovering && styles.buttonDisabled]}><Text style={styles.buttonText}>{isRecovering ? "Checking permission…" : "Try permission again"}</Text><MaterialIcons name="lock-open" size={20} color="#FFF" /></PressableScale> : <PressableScale accessibilityRole="button" accessibilityLabel="Return to home" onPress={() => router.replace("/")} style={styles.button}><Text style={styles.buttonText}>Back to home</Text><MaterialIcons name="arrow-forward" size={20} color="#FFF" /></PressableScale>}
        {recoveryMessage ? <View accessible accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={recoveryMessage} style={styles.recoveryBox}><MaterialIcons name="info-outline" size={20} color="#B45309" /><Text style={styles.recoveryText}>{recoveryMessage}</Text></View> : null}
        {undoAvailable && !blocked ? <View style={styles.undoPanel}><View style={styles.undoHeader}><View style={styles.undoCopy}><MaterialIcons name="undo" size={19} color="#4F46E5" /><Text style={styles.undoText}>Undo available</Text></View><Text style={styles.undoCountdown}>{remainingSeconds}s</Text></View><View accessible accessibilityRole="progressbar" accessibilityLabel={getUndoCountdownAccessibilityLabel(remainingSeconds)} accessibilityValue={{ min: 0, max: 30, now: remainingSeconds }}><AnimatedBar progress={undoProgress * 100} duration={180} trackStyle={styles.undoTrack} fillStyle={styles.undoFill} /></View><Text style={styles.undoHint}>You have 30 seconds to restore the selected items.</Text><PressableScale accessibilityRole="button" accessibilityLabel={`Undo cleanup. ${getUndoCountdownAccessibilityLabel(remainingSeconds)}`} accessibilityState={{ disabled: !undoAvailable }} disabled={!undoAvailable} onPress={handleUndo} style={[styles.undoButton, !undoAvailable && styles.undoButtonDisabled]}><MaterialIcons name="undo" size={19} color="#4F46E5" /><Text style={styles.undoText}>Undo cleanup</Text></PressableScale></View> : null}
        <PressableScale haptic={false} accessibilityRole="button" accessibilityLabel={blocked ? "Return to cleanup review" : "Review remaining results"} onPress={() => router.replace(blocked ? "/review" : "/results")}><Text style={styles.link}>{blocked ? "Return to cleanup review" : "Review remaining results"}</Text></PressableScale>
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ center: { flex: 1, justifyContent: "center", alignItems: "center" }, stepPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#ECFDF5", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, marginBottom: 18 }, stepPillWarning: { backgroundColor: "#FFFBEB" }, stepPillText: { color: "#047857", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }, stepPillTextWarning: { color: "#B45309" }, circle: { width: 112, height: 112, borderRadius: 56, backgroundColor: "#10B981", alignItems: "center", justifyContent: "center", marginBottom: 26 }, title: { color: "#111827", fontSize: 28, fontWeight: "800", textAlign: "center" }, subtitle: { color: "#64748B", fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 11, maxWidth: 310 }, warningCircle: { backgroundColor: "#F59E0B" }, summary: { alignItems: "center", backgroundColor: "#ECFDF5", borderRadius: 20, padding: 20, width: "100%", marginTop: 26 }, summaryPreview: { backgroundColor: "#FFFBEB" }, summaryLabel: { color: "#047857", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 }, summaryLabelPreview: { color: "#B45309" }, summaryValue: { color: "#065F46", fontSize: 32, fontWeight: "800", marginTop: 3 }, summaryValuePreview: { color: "#92400E" }, summaryNote: { color: "#10B981", fontSize: 12, marginTop: 2 }, summaryNotePreview: { color: "#B45309" }, button: { width: "100%", backgroundColor: "#111827", borderRadius: 16, paddingVertical: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 24 }, buttonDisabled: { opacity: 0.65 }, buttonText: { color: "#FFF", fontSize: 15, fontWeight: "800" }, recoveryBox: { flexDirection: "row", alignItems: "center", gap: 9, width: "100%", backgroundColor: "#FFFBEB", borderRadius: 14, padding: 12, marginTop: 12 }, recoveryText: { flex: 1, color: "#92400E", fontSize: 12, lineHeight: 18 }, undoPanel: { width: "100%", borderRadius: 16, padding: 14, marginTop: 12, backgroundColor: "#EEF2FF", borderWidth: 1, borderColor: "#C7D2FE" }, undoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, undoCopy: { flexDirection: "row", alignItems: "center", gap: 8 }, undoTrack: { height: 6, borderRadius: 4, backgroundColor: "#C7D2FE", overflow: "hidden", marginTop: 12 }, undoFill: { height: 6, borderRadius: 4, backgroundColor: "#4F46E5" }, undoCountdown: { color: "#3730A3", fontSize: 14, fontWeight: "800" }, undoHint: { color: "#64748B", fontSize: 11, lineHeight: 16, marginTop: 8 }, undoButton: { width: "100%", borderRadius: 12, paddingVertical: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C7D2FE" }, undoButtonDisabled: { opacity: 0.5 }, undoText: { color: "#4F46E5", fontSize: 15, fontWeight: "800" }, link: { color: "#4F46E5", fontSize: 13, fontWeight: "700", marginTop: 18 } });
