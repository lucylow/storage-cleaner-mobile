import { router } from "expo-router";
import { AccessibilityInfo, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { useCleaner } from "@/lib/cleaner-store";
import { getPersistenceRetryActionCopy, getPersistenceStatusIcon, getPersistenceStatusTone, getPersistenceStatusValue } from "@/lib/persistence-logic";
import { buildPrivacySafeDiagnosticSummary, canApplyDiagnosticExportResult, canStartDiagnosticExport, formatDiagnosticCount, getDiagnosticActionState, getDiagnosticCopyState, getDiagnosticFeedbackAccessibilityLabel, getDiagnosticStatusRowAccessibilityLabel, getDiagnosticFeedbackPresentation, getDiagnosticPreviewAccessibilityLabel, getDiagnosticPreviewState, getDiagnosticShareCompletionState, getDiagnosticStatusAccessibilityLabel, getDiagnosticStatusPresentation, getDiagnosticShareFailureMessage } from "@/lib/diagnostic-logic";

export default function DiagnosticsScreen() {
  const {
    scanDiagnosticCounters,
    lastScanDiagnostic,
    lastScanLabel,
    scanHistory,
    permissionReadiness,
    persistenceWarning,
    retryPersistence,
    persistenceRetrying,
  } = useCleaner();
  const mountedRef = useRef(true);
  const exportRequestRef = useRef(0);
  const [sharingSummary, setSharingSummary] = useState(false);
  const [copyingSummary, setCopyingSummary] = useState(false);
  const [showSummaryPreview, setShowSummaryPreview] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const persistenceTimedOut = Boolean(persistenceWarning?.startsWith("Local save timed out"));
  const retryCopy = getPersistenceRetryActionCopy(persistenceRetrying, persistenceTimedOut);
  const persistenceStatus = getPersistenceStatusValue(persistenceWarning, persistenceRetrying);
  const persistenceTone = getPersistenceStatusTone(persistenceWarning, persistenceRetrying);
  const persistenceIcon = getPersistenceStatusIcon(persistenceWarning, persistenceRetrying);
  const feedbackPresentation = shareMessage ? getDiagnosticFeedbackPresentation(shareMessage) : { tone: "success" as const, icon: "check-circle-outline" as const };
  const previewState = getDiagnosticPreviewState(showSummaryPreview);
  const diagnosticStatus = getDiagnosticStatusPresentation(Boolean(lastScanDiagnostic));
  const copyAction = getDiagnosticActionState("copy", copyingSummary, sharingSummary);
  const shareAction = getDiagnosticActionState("share", copyingSummary, sharingSummary);
  const diagnosticSummary = buildPrivacySafeDiagnosticSummary({
    timeoutCount: scanDiagnosticCounters.timeoutCount,
    cancellationCount: scanDiagnosticCounters.cancellationCount,
    lastScanLabel,
    permissionReadiness,
    persistenceStatus,
    lastDiagnosticMessage: lastScanDiagnostic?.message,
  });

  const announceExportStart = (action: "copy" | "share") => { try { AccessibilityInfo.announceForAccessibility(action === "copy" ? "Copying privacy-safe diagnostic summary." : "Opening the share sheet for a privacy-safe diagnostic summary."); } catch { /* optional accessibility channel */ } };

  const copyDiagnosticSummary = async () => {
    if (!canStartDiagnosticExport(mountedRef.current, copyingSummary, sharingSummary)) return;
    const requestId = exportRequestRef.current + 1;
    exportRequestRef.current = requestId;
    setCopyingSummary(true);
    setShareMessage(null);
    announceExportStart("copy");
    try {
      const copied = await Clipboard.setStringAsync(diagnosticSummary);
      const nextState = canApplyDiagnosticExportResult(mountedRef.current, requestId, exportRequestRef.current) ? getDiagnosticCopyState(true, copied) : null;
      if (nextState) {
        setCopyingSummary(nextState.copyingSummary);
        setShareMessage(nextState.message);
      }
    } catch {
      const nextState = canApplyDiagnosticExportResult(mountedRef.current, requestId, exportRequestRef.current) ? getDiagnosticCopyState(true, false) : null;
      if (nextState) {
        setCopyingSummary(nextState.copyingSummary);
        setShareMessage(nextState.message);
      }
    } finally {
      if (mountedRef.current) setCopyingSummary(false);
    }
  };

  const shareDiagnosticSummary = async () => {
    if (!canStartDiagnosticExport(mountedRef.current, copyingSummary, sharingSummary)) return;
    const requestId = exportRequestRef.current + 1;
    exportRequestRef.current = requestId;
    setSharingSummary(true);
    setShareMessage(null);
    announceExportStart("share");
    try {
      const result = await Share.share({
        title: "Privacy-safe diagnostic summary",
        message: diagnosticSummary,
      });
      const completion = canApplyDiagnosticExportResult(mountedRef.current, requestId, exportRequestRef.current) ? getDiagnosticShareCompletionState(true, result.action, Share.sharedAction, Share.dismissedAction) : null;
      if (completion) {
        setShareMessage(completion.message);
        setSharingSummary(completion.sharingSummary);
      }
    } catch {
      if (canApplyDiagnosticExportResult(mountedRef.current, requestId, exportRequestRef.current)) setShareMessage(getDiagnosticShareFailureMessage());
    } finally {
      if (mountedRef.current) setSharingSummary(false);
    }
  };

  return (
    <ScreenContainer className="px-5 pt-3">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to settings" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && { opacity: 0.7 }]}>
          <MaterialIcons name="arrow-back" size={21} color="#111827" />
          <Text style={styles.backText}>Back to settings</Text>
        </Pressable>

        <Text style={styles.eyebrow}>LOCAL HEALTH</Text>
        <Text style={styles.title}>Diagnostics</Text>
        <Text accessibilityRole="text" accessibilityLabel="These counters describe scan outcomes only. No file names, paths, media identifiers, or file contents are stored here." style={styles.subtitle}>
          These counters describe scan outcomes only. No file names, paths, media identifiers, or file contents are stored here.
        </Text>
        <View accessible accessibilityRole="text" accessibilityLabel="Privacy-safe diagnostics. Counters only. Stored on this device." style={styles.localPill}><MaterialIcons name="shield" size={15} color="#047857" /><Text style={styles.localPillText}>Privacy-safe diagnostics</Text><Text style={styles.localPillHint}>Counters only</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={previewState.label} accessibilityHint={previewState.hint} accessibilityState={{ expanded: previewState.expanded }} onPress={() => setShowSummaryPreview((visible) => !visible)} style={({ pressed }) => [styles.previewButton, pressed && { opacity: 0.78 }]}> 
          <MaterialIcons name={previewState.icon} size={18} color="#475569" />
          <Text style={styles.previewText}>{previewState.buttonText}</Text>
        </Pressable>
        {showSummaryPreview ? <View accessible accessibilityRole="text" accessibilityLabel={getDiagnosticPreviewAccessibilityLabel(diagnosticSummary)} style={styles.summaryPreview}><Text selectable style={styles.summaryPreviewText}>{diagnosticSummary}</Text></View> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={copyAction.label} accessibilityHint={copyAction.hint} accessibilityState={{ busy: copyAction.busy, disabled: copyAction.disabled }} onPress={copyDiagnosticSummary} disabled={copyAction.disabled} style={({ pressed }) => [styles.copyButton, pressed && !copyingSummary && !sharingSummary && { opacity: 0.78 }, (copyingSummary || sharingSummary) && styles.retryDisabled]}>
          <MaterialIcons name={copyAction.icon} size={18} color="#047857" />
          <Text style={styles.copyText}>{copyAction.buttonText}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={shareAction.label} accessibilityHint={shareAction.hint} accessibilityState={{ busy: shareAction.busy, disabled: shareAction.disabled }} onPress={shareDiagnosticSummary} disabled={shareAction.disabled} style={({ pressed }) => [styles.shareButton, pressed && !sharingSummary && !copyingSummary && { opacity: 0.78 }, (sharingSummary || copyingSummary) && styles.retryDisabled]}>
          <MaterialIcons name={shareAction.icon} size={18} color="#4338CA" />
          <Text style={styles.shareText}>{shareAction.buttonText}</Text>
        </Pressable>
        {shareMessage ? <View accessible accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={getDiagnosticFeedbackAccessibilityLabel(shareMessage)} style={styles.shareFeedback}><MaterialIcons name={feedbackPresentation.icon} size={17} color={feedbackPresentation.tone === "warning" ? "#B45309" : "#047857"} /><Text style={[styles.shareMessage, feedbackPresentation.tone === "warning" && styles.shareMessageWarning]}>{shareMessage}</Text><Pressable accessibilityRole="button" accessibilityLabel="Dismiss export feedback" accessibilityHint="Hides this export result message" onPress={() => setShareMessage(null)} style={styles.feedbackDismiss}><MaterialIcons name="close" size={16} color={feedbackPresentation.tone === "warning" ? "#B45309" : "#047857"} /></Pressable></View> : null}

        <Text style={styles.section}>SCAN OUTCOMES</Text>
        <View style={styles.grid}>
          <MetricCard icon="timer-off" label="Timeouts" value={formatDiagnosticCount(scanDiagnosticCounters.timeoutCount)} tone="amber" />
          <MetricCard icon="cancel" label="Cancellations" value={formatDiagnosticCount(scanDiagnosticCounters.cancellationCount)} tone="slate" />
        </View>

        <Text style={styles.section}>CURRENT STATUS</Text>
        <View style={styles.panel}>
          <StatusRow label="Last scan" value={lastScanLabel} />
          <StatusRow label="Media access" value={permissionReadiness} />
          <StatusRow label="Saved summaries" value={`${scanHistory.length} of 10`} />
          <StatusRow label="Persistence" value={persistenceStatus} warning={Boolean(persistenceWarning)} tone={persistenceTone} icon={persistenceIcon} detail={persistenceWarning ?? undefined} />
        </View>
        {persistenceWarning ? <Pressable accessibilityRole="button" accessibilityLabel={retryCopy.label} accessibilityHint={retryCopy.hint} accessibilityState={{ disabled: persistenceRetrying, busy: persistenceRetrying }} onPress={retryPersistence} disabled={persistenceRetrying} style={({ pressed }) => [styles.retryButton, persistenceRetrying && styles.retryDisabled, pressed && !persistenceRetrying && { opacity: 0.78 }]}><Text style={styles.retryText}>{retryCopy.buttonText}</Text><MaterialIcons name={retryCopy.icon} size={18} color="#4F46E5" /></Pressable> : null}

        <Text style={styles.section}>LAST DIAGNOSTIC</Text>
        <View accessible accessibilityRole="text" accessibilityLiveRegion="polite" accessibilityLabel={getDiagnosticStatusAccessibilityLabel({ title: diagnosticStatus.title, message: lastScanDiagnostic?.message ?? diagnosticStatus.message, tone: diagnosticStatus.tone })} style={[styles.notice, diagnosticStatus.tone === "warning" ? styles.noticeWarning : styles.noticeSuccess]}>
          <MaterialIcons name={diagnosticStatus.icon} size={23} color={diagnosticStatus.tone === "warning" ? "#B45309" : "#047857"} />
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>{diagnosticStatus.title}</Text>
            <Text style={styles.noticeBody}>{lastScanDiagnostic?.message ?? diagnosticStatus.message}</Text>
          </View>
        </View>

        <View accessible accessibilityRole="text" accessibilityLabel="Diagnostics stay on this device and can be cleared only by clearing the app’s local data." style={styles.privacyNote}>
          <MaterialIcons name="shield" size={20} color="#047857" />
          <Text style={styles.privacyText}>Diagnostics stay on this device and can be cleared only by clearing the app’s local data.</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function MetricCard({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: "amber" | "slate" }) {
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={`${label}: ${value}`} style={styles.metricCard}>
      <View style={[styles.metricIcon, tone === "amber" ? styles.metricAmber : styles.metricSlate]}>
        <MaterialIcons name={icon as never} size={20} color={tone === "amber" ? "#B45309" : "#475569"} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function StatusRow({ label, value, warning = false, tone = "default", icon, detail }: { label: string; value: string; warning?: boolean; tone?: "default" | "warning" | "timeout"; icon?: "check-circle-outline" | "warning-amber" | "timer-off" | "hourglass-top"; detail?: string }) {
  const iconColor = tone === "timeout" ? "#9F1239" : tone === "warning" ? "#B45309" : "#64748B";
  const isAnnounceable = warning || tone !== "default";
  return (
    <View accessible accessibilityLiveRegion={isAnnounceable ? "polite" : "none"} accessibilityLabel={getDiagnosticStatusRowAccessibilityLabel(label, value, detail)} style={styles.statusRow}>
      <View style={styles.statusLabelGroup}>{icon ? <MaterialIcons name={icon} size={17} color={iconColor} /> : null}<Text style={styles.statusLabel}>{label}</Text></View>
      <Text style={[styles.statusValue, tone === "warning" && styles.statusWarning, tone === "timeout" && styles.statusTimeout]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 36 },
  back: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 30 },
  backText: { color: "#475569", fontWeight: "700" },
  eyebrow: { color: "#64748B", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: "#111827", fontSize: 30, fontWeight: "800", marginTop: 6 },
  subtitle: { color: "#64748B", fontSize: 14, lineHeight: 21, marginTop: 10 },
  localPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, backgroundColor: "#ECFDF5", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, marginTop: 14 },
  localPillText: { color: "#047857", fontSize: 11, fontWeight: "800" },
  localPillHint: { color: "#059669", fontSize: 10, marginLeft: 3 },
  section: { color: "#94A3B8", fontSize: 11, fontWeight: "800", letterSpacing: 1.1, marginTop: 26, marginBottom: 10 },
  grid: { flexDirection: "row", gap: 10 },
  metricCard: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E5E7EB", padding: 14, elevation: 1 },
  metricIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  metricAmber: { backgroundColor: "#FEF3C7" },
  metricSlate: { backgroundColor: "#F1F5F9" },
  metricValue: { color: "#111827", fontSize: 24, fontWeight: "800" },
  metricLabel: { color: "#64748B", fontSize: 12, marginTop: 2 },
  panel: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 15 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  statusLabelGroup: { flexDirection: "row", alignItems: "center", gap: 7 },
  statusLabel: { color: "#64748B", fontSize: 13 },
  statusValue: { color: "#334155", fontSize: 13, fontWeight: "800", maxWidth: "58%", textAlign: "right" },
  statusWarning: { color: "#B45309" },
  statusTimeout: { color: "#9F1239" },
  previewButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC", paddingVertical: 11 },
  previewText: { color: "#475569", fontSize: 13, fontWeight: "800" },
  summaryPreview: { backgroundColor: "#F8FAFC", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", padding: 12, marginTop: 8 },
  summaryPreviewText: { color: "#334155", fontSize: 12, lineHeight: 18 },
  copyButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: "#A7F3D0", backgroundColor: "#ECFDF5", paddingVertical: 12 },
  copyText: { color: "#047857", fontSize: 13, fontWeight: "800" },
  shareButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: "#C7D2FE", backgroundColor: "#EEF2FF", paddingVertical: 12 },
  shareText: { color: "#4338CA", fontSize: 13, fontWeight: "800" },
  shareFeedback: { flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 8 },
  shareMessage: { flex: 1, color: "#047857", fontSize: 12, lineHeight: 18 },
  shareMessageWarning: { color: "#B45309" },
  feedbackDismiss: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  retryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: "#C7D2FE", backgroundColor: "#EEF2FF", paddingVertical: 12 },
  retryText: { color: "#4338CA", fontSize: 13, fontWeight: "800" },
  retryDisabled: { opacity: 0.58 },
  notice: { flexDirection: "row", alignItems: "flex-start", borderRadius: 18, padding: 15 },
  noticeWarning: { backgroundColor: "#FFFBEB" },
  noticeSuccess: { backgroundColor: "#ECFDF5" },
  noticeCopy: { flex: 1, marginLeft: 11 },
  noticeTitle: { color: "#334155", fontSize: 14, fontWeight: "800", marginBottom: 4 },
  noticeBody: { color: "#64748B", fontSize: 12, lineHeight: 18 },
  privacyNote: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 20, padding: 14, backgroundColor: "#F0FDFA", borderRadius: 16 },
  privacyText: { flex: 1, color: "#0F766E", fontSize: 12, lineHeight: 18 },
});
