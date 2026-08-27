import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Alert, StyleSheet, Text, View } from "react-native";
import { AnimatedBar, CountUpText, FadeIn, PressableScale, RadarOrb } from "@/components/motion";
import { ScreenContainer } from "@/components/screen-container";
import { useCleaner } from "@/lib/cleaner-store";
import { useThemeContext } from "@/lib/theme-provider";
import { getPermissionReadinessLabel, getPermissionRefreshAnnouncement, getPermissionSettingsHandoffAnnouncement, getScanControlAnnouncement, getScanControlLabel, getScanPhaseLabel, getScanProgressMilestone, getScanResumeMessage } from "@/lib/scanner-logic";

export default function ScanScreen() {
  const { reducedMotion } = useThemeContext();
  const { isScanning, isScanPaused, scanSessionState, pauseScan, resumeScan, scanProgress, scannerMode, discoveredItemCount, scanCategory, lastScanDiagnostic, permissionReadiness, refreshPermissionReadiness, openPermissionSettings, startScan, retryScan, cancelScan } = useCleaner();
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const mountedRef = useRef(true);
  const recoveryRequestRef = useRef(0);
  const lastAnnouncement = useRef("");
  const previousControlState = useRef<"idle" | "running" | "paused" | "backgrounded" | "cancelled">("idle");
  const handlePermissionRecovery = async () => {
    if (isRecovering || !mountedRef.current) return;
    const requestId = recoveryRequestRef.current + 1;
    recoveryRequestRef.current = requestId;
    setIsRecovering(true);
    setRecoveryMessage(null);
    try {
      if (permissionReadiness === "blocked") {
        const intent = await openPermissionSettings();
        if (mountedRef.current && recoveryRequestRef.current === requestId) setRecoveryMessage(getPermissionSettingsHandoffAnnouncement(intent));
      } else {
        await refreshPermissionReadiness();
        if (mountedRef.current && recoveryRequestRef.current === requestId) setRecoveryMessage(getPermissionRefreshAnnouncement("refreshed"));
      }
    } catch {
      if (mountedRef.current && recoveryRequestRef.current === requestId) setRecoveryMessage(getPermissionRefreshAnnouncement("failed"));
    } finally {
      if (mountedRef.current && recoveryRequestRef.current === requestId) setIsRecovering(false);
    }
  };
  const safeProgress = Number.isFinite(scanProgress) ? Math.max(0, Math.min(100, scanProgress)) : 0;
  const isCancelled = !isScanning && scanCategory === "Scan cancelled";
  const hasDiagnostic = !isScanning && Boolean(lastScanDiagnostic);
  const isAttentionState = hasDiagnostic && scanCategory === "Scan needs attention";
  const phase = getScanPhaseLabel(scanProgress, scanCategory);
  const resumeMessage = getScanResumeMessage(scanSessionState);
  const progressMilestone = getScanProgressMilestone(safeProgress);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  useEffect(() => {
    if (!isScanning && safeProgress === 0 && scanCategory === "Ready to scan") startScan();
    if (!isScanning && safeProgress === 100 && !lastScanDiagnostic) router.replace("/results");
  }, [isScanning, safeProgress, scanCategory, lastScanDiagnostic, startScan]);

  useEffect(() => {
    const controlState = isCancelled ? "cancelled" : isScanning && scanSessionState === "backgrounded" ? "backgrounded" : isScanning && isScanPaused ? "paused" : isScanning && scanSessionState === "running" ? "running" : "idle";
    const previousState = previousControlState.current;
    previousControlState.current = controlState;
    const controlAnnouncement = controlState === "cancelled" && previousState !== "cancelled" ? getScanControlAnnouncement("cancelled") : controlState === "backgrounded" && previousState !== "backgrounded" ? getScanControlAnnouncement("backgrounded") : controlState === "paused" && previousState !== "paused" ? getScanControlAnnouncement("paused") : controlState === "running" && (previousState === "paused" || previousState === "backgrounded") ? getScanControlAnnouncement("resumed") : "";
    const announcement = recoveryMessage || controlAnnouncement || (isAttentionState ? "Scan needs attention. Review the recovery message." : isScanning && progressMilestone > 0 ? `${phase}. ${progressMilestone}% complete.` : !isScanning && safeProgress === 100 ? `Scan complete. ${discoveredItemCount} items ready to review.` : "");
    if (!announcement || announcement === lastAnnouncement.current) return;
    lastAnnouncement.current = announcement;
    try { AccessibilityInfo.announceForAccessibility(announcement); } catch { /* optional accessibility channel */ }
  }, [discoveredItemCount, isAttentionState, isCancelled, isScanPaused, isScanning, phase, progressMilestone, recoveryMessage, safeProgress, scanSessionState]);

  return (
    <ScreenContainer className="px-6" edges={["top", "bottom", "left", "right"]}>
      <View style={styles.center}>
        <FadeIn>
          <View accessible accessibilityRole="text" accessibilityLabel={isAttentionState ? "Action needed. Scan needs attention." : isScanning ? "Scan in progress." : isCancelled ? "Scan stopped." : "Ready to review."} style={[styles.phasePill, isAttentionState && styles.phasePillWarning]}>
            <MaterialIcons name={isAttentionState ? "warning" : isScanning ? "radar" : "check-circle"} size={14} color={isAttentionState ? "#B45309" : isScanning ? "#4F46E5" : "#047857"} />
            <Text style={[styles.phasePillText, isAttentionState && styles.phasePillTextWarning]}>{isAttentionState ? "ACTION NEEDED" : isScanning ? "SCAN IN PROGRESS" : isCancelled ? "SCAN STOPPED" : "READY TO REVIEW"}</Text>
          </View>
        </FadeIn>
        <RadarOrb active={isScanning && !reducedMotion} cancelled={isCancelled}>
          <MaterialIcons name={isScanning ? "radar" : isCancelled ? "pause-circle-outline" : "task-alt"} size={52} color={isScanning ? "#4F46E5" : isCancelled ? "#64748B" : "#10B981"} />
        </RadarOrb>
        <FadeIn delay={80}>
          <Text style={styles.title}>{isScanning ? "Scanning your device" : isCancelled ? "Scan cancelled" : "Scan complete"}</Text>
          <Text style={styles.subtitle}>{isScanning ? "Your data stays local while we build a storage snapshot." : isCancelled ? "No files were changed. You can start a fresh local scan whenever you are ready." : isAttentionState ? lastScanDiagnostic?.message : `We found ${discoveredItemCount} items to review.`}</Text>
        </FadeIn>
        <View accessible accessibilityRole="progressbar" accessibilityLabel="Scan progress" accessibilityValue={{ min: 0, max: 100, now: safeProgress }} style={styles.progressWrap}>
          <AnimatedBar progress={safeProgress} trackStyle={styles.progressTrack} fillStyle={[styles.progressFill, isCancelled && styles.cancelledFill]} />
        </View>
        <Text accessibilityRole="text" accessibilityLiveRegion="polite" accessibilityLabel={isCancelled ? "Scan stopped safely." : isScanPaused ? "Scan paused safely." : `Scan progress: ${safeProgress}% complete.`} style={styles.progressText}>{isCancelled ? "Stopped safely" : isScanPaused ? "Paused safely" : `${safeProgress}% complete`}</Text>
        {resumeMessage ? <View accessible accessibilityRole="text" accessibilityLiveRegion="polite" accessibilityLabel={resumeMessage} style={styles.resumeNotice}><MaterialIcons name={scanSessionState === "backgrounded" ? "info-outline" : "pause-circle-outline"} size={18} color="#4F46E5" /><Text style={styles.resumeText}>{resumeMessage}</Text></View> : null}
        <FadeIn delay={140} style={styles.detail}>
          <View accessible accessibilityRole="text" accessibilityLabel={`Scan status. Phase: ${phase}. Currently checking: ${scanCategory}. Items discovered: ${discoveredItemCount}. Media access: ${getPermissionReadinessLabel(permissionReadiness)}. Session: ${scanSessionState === "backgrounded" ? "Paused safely" : scanSessionState === "paused" ? "Paused by you" : scanSessionState === "running" ? "Active" : "Ready"}.`}>
            {lastScanDiagnostic ? <View style={styles.diagnostic}><MaterialIcons name="info-outline" size={18} color="#B45309" /><Text style={styles.diagnosticText}>{lastScanDiagnostic.message}</Text></View> : null}
            <View style={styles.detailRow}><Text style={styles.detailLabel}>SCAN PHASE</Text><Text style={styles.detailValue}>{phase}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>CURRENTLY CHECKING</Text><Text style={styles.detailValue}>{scanCategory}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>ITEMS DISCOVERED</Text><CountUpText value={discoveredItemCount} format={(count) => `${Math.round(count)}`} style={styles.detailValue} duration={360} /></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>MEDIA ACCESS</Text><Text style={styles.detailValue}>{getPermissionReadinessLabel(permissionReadiness)}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>SESSION</Text><Text style={styles.detailValue}>{scanSessionState === "backgrounded" ? "Paused safely" : scanSessionState === "paused" ? "Paused by you" : scanSessionState === "running" ? "Active" : "Ready"}</Text></View>
            <Text style={styles.mode}>{scannerMode === "native" ? "Native media library scan · analyzed on device" : "Local preview scan"}</Text>
          </View>
        </FadeIn>
        {!isScanning && permissionReadiness !== "granted" && permissionReadiness !== "unsupported" ? <>
          <PressableScale accessibilityRole="button" accessibilityLabel={permissionReadiness === "blocked" ? "Open device Settings for media access" : "Check media access again"} accessibilityState={{ disabled: isRecovering }} disabled={isRecovering} onPress={() => void handlePermissionRecovery()} style={[styles.permissionButton, isRecovering && styles.permissionButtonDisabled]}>
            <MaterialIcons name={permissionReadiness === "blocked" ? "settings" : "refresh"} size={16} color="#B45309" />
            <Text style={styles.permissionText}>{isRecovering ? "Checking media access…" : permissionReadiness === "blocked" ? "Open device Settings" : "Check media access again"}</Text>
          </PressableScale>
          {recoveryMessage ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={recoveryMessage} style={styles.recoveryMessage}>{recoveryMessage}</Text> : null}
        </> : null}
        {isScanning ? (
          <View style={styles.scanControls}>
            {scanSessionState === "backgrounded" ? (
              <PressableScale accessibilityRole="button" accessibilityLabel="Resume scan" accessibilityHint="Continues the paused scan from its current progress" onPress={resumeScan} style={styles.primaryButton}>
                <MaterialIcons name="play-arrow" size={20} color="#FFF" /><Text style={styles.primaryText}>Resume scan</Text>
              </PressableScale>
            ) : (
              <PressableScale accessibilityRole="button" accessibilityLabel={isScanPaused ? "Resume scan" : "Pause scan"} accessibilityHint={isScanPaused ? "Continues the paused scan from its current progress" : "Pauses scanning safely without changing files"} onPress={isScanPaused ? resumeScan : pauseScan} style={styles.secondaryButton}>
                <MaterialIcons name={isScanPaused ? "play-arrow" : "pause"} size={18} color="#64748B" /><Text style={styles.secondaryText}>{getScanControlLabel(true, isScanPaused)}</Text>
              </PressableScale>
            )}
            <PressableScale accessibilityRole="button" accessibilityLabel="Cancel scan" accessibilityHint="Asks for confirmation, then stops scanning safely; no files are changed" onPress={() => Alert.alert("Stop this scan?", "No files will be changed. You can start a new scan anytime.", [{ text: "Keep scanning", style: "cancel" }, { text: "Stop scan", style: "destructive", onPress: cancelScan }])} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Cancel scan</Text>
            </PressableScale>
          </View>
        ) : isAttentionState ? (
          <View style={styles.actionRow}>
            <PressableScale accessibilityRole="button" accessibilityLabel="Try the scan again" onPress={retryScan} style={styles.primaryButton}>
              <Text style={styles.primaryText}>Try scan again</Text><MaterialIcons name="refresh" size={20} color="#FFF" />
            </PressableScale>
            <PressableScale accessibilityRole="button" accessibilityLabel="Return to home" onPress={() => router.replace("/")} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Back to home</Text>
            </PressableScale>
          </View>
        ) : (
          <PressableScale accessibilityRole="button" accessibilityLabel={isCancelled ? "Return to home" : "View scan results"} onPress={() => router.replace(isCancelled ? "/" : "/results")} style={styles.primaryButton}>
            <Text style={styles.primaryText}>{isCancelled ? "Back to home" : "View results"}</Text>
            {isCancelled ? <MaterialIcons name="home" size={20} color="#FFF" /> : <MaterialIcons name="arrow-forward" size={20} color="#FFF" />}
          </PressableScale>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { color: "#111827", fontSize: 27, fontWeight: "800", textAlign: "center" },
  subtitle: { color: "#64748B", fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 300, marginTop: 10 },
  progressWrap: { width: "100%", marginTop: 34 },
  progressTrack: { width: "100%", height: 9, backgroundColor: "#E2E8F0", borderRadius: 6, overflow: "hidden" },
  progressFill: { height: 9, backgroundColor: "#4F46E5", borderRadius: 6 },
  cancelledFill: { backgroundColor: "#94A3B8" },
  progressText: { color: "#4F46E5", fontWeight: "800", marginTop: 10 },
  detail: { backgroundColor: "#F8FAFC", borderRadius: 16, padding: 16, width: "100%", marginTop: 28, gap: 12 },
  diagnostic: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FFFBEB", borderRadius: 12, padding: 10, marginBottom: 2 },
  diagnosticText: { flex: 1, color: "#92400E", fontSize: 12, lineHeight: 17, fontWeight: "700" },
  resumeNotice: { flexDirection: "row", alignItems: "center", gap: 8, width: "100%", backgroundColor: "#EEF2FF", borderRadius: 12, padding: 12, marginTop: 22 },
  resumeText: { flex: 1, color: "#3730A3", fontSize: 12, lineHeight: 17, fontWeight: "700" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailLabel: { color: "#94A3B8", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  detailValue: { color: "#334155", fontSize: 14, fontWeight: "700" },
  mode: { color: "#94A3B8", fontSize: 11, marginTop: 2 },
  scanControls: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 24 },
  actionRow: { alignItems: "center", marginTop: 24 },
  phasePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#EEF2FF", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, marginBottom: 8 },
  phasePillWarning: { backgroundColor: "#FFFBEB" },
  phasePillText: { color: "#3730A3", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  phasePillTextWarning: { color: "#B45309" },
  primaryButton: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#111827", borderRadius: 16, paddingVertical: 16, paddingHorizontal: 26, marginTop: 24 },
  primaryText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
  permissionButton: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16, padding: 10 },
  permissionButtonDisabled: { opacity: 0.55 },
  permissionText: { color: "#B45309", fontWeight: "800", fontSize: 12 },
  recoveryMessage: { color: "#64748B", fontSize: 11, textAlign: "center", marginTop: 2 },
  secondaryButton: { marginTop: 24, padding: 14 },
  secondaryText: { color: "#64748B", fontWeight: "700" },
});
