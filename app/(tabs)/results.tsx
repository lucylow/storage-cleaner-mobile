import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { AccessibilityInfo, Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { CountUpText, FadeIn, PopScale, PressableScale } from "@/components/motion";
import { playSelection } from "@/lib/haptics";
import { ScreenContainer } from "@/components/screen-container";
import { summarizeCleanup } from "@/lib/analysis-logic";
import { formatStorage, useCleaner, type CleanupCategory } from "@/lib/cleaner-store";
import { getRecommendation } from "@/lib/cleaner-logic";
import { getPremiumPrompt } from "@/lib/monetization-logic";
import { useTranslation } from "@/lib/locale-provider";
import { usePremium } from "@/lib/premium-store";
import { WebInsightCard } from "@/components/web-insight-card";

export default function ResultsScreen() {
  const { t } = useTranslation();
  const labels: Record<CleanupCategory, string> = { duplicates: t("categoryDuplicates"), large: t("categoryLarge"), temporary: t("categoryTemporary") };
  const { category, scope } = useLocalSearchParams<{ category?: CleanupCategory; scope?: string }>();
  const { items, selectedBytes, toggleItem, toggleProtected, selectCategory, largeFileThreshold, aiAnalysis, applySmartSelection, smartSelectedBytes, getRecommendationByItemId, lastScanLabel, startScan, webIntelligenceEnabled, webIntelligenceAvailable, refreshWebInsight, retryWebInsight, askRelatedWebQuestion, canRefreshWebInsight, canRetryWebInsight, webInsightQuotaRemaining, webInsight } = useCleaner();
  const hasScanned = lastScanLabel !== "Never scanned";
  const { isPro, isHydrated, shouldShowUpgradePrompt, recordUpgradePromptShown, dismissUpgradePrompt } = usePremium();
  const summaries = summarizeCleanup(items, largeFileThreshold);
  const visible = scope === "protected" ? items.filter((item) => item.protected) : category === "large" ? items.filter((item) => item.category === category && item.size >= largeFileThreshold) : category ? items.filter((item) => item.category === category) : items;
  const showUpgradePrompt = isHydrated && !isPro && visible.length > 0 && shouldShowUpgradePrompt();
  useEffect(() => { if (showUpgradePrompt) void recordUpgradePromptShown(); }, [recordUpgradePromptShown, showUpgradePrompt]);
  const announceSelection = (message: string) => { try { AccessibilityInfo.announceForAccessibility(message); } catch { /* optional accessibility channel */ } };
  const setSelection = (selected: boolean) => { if (scope === "protected") return; if (category) selectCategory(category, selected); else (["duplicates", "large", "temporary"] as CleanupCategory[]).forEach((key) => selectCategory(key, selected)); announceSelection(selected ? t("safeItemsSelected") : t("selectionsCleared")); };
  const handleProtectedToggle = (id: string, wasProtected: boolean) => { toggleProtected(id); try { AccessibilityInfo.announceForAccessibility(wasProtected ? t("itemUnprotectedAnnounce") : t("itemProtectedAnnounce")); } catch { /* optional accessibility channel */ } };
  return <ScreenContainer className="px-5 pt-3"><FadeIn><View style={styles.header}><View><Text style={styles.eyebrow}>{t("resultsEyebrow")}</Text><Text style={styles.title}>{t("resultsTitle")}</Text></View><View accessible accessibilityRole="text" accessibilityLiveRegion="polite" accessibilityLabel={t("selectedForCleanup", { size: formatStorage(selectedBytes) })} style={styles.total}><CountUpText value={selectedBytes} format={formatStorage} style={styles.totalValue} duration={420} /><Text style={styles.totalLabel}>{t("selected")}</Text></View></View></FadeIn><Text style={styles.subtitle}>{t("resultsSubtitle")}</Text><View accessible accessibilityRole="text" accessibilityLabel={t("stayInControlA11y")} style={styles.controlPill}><MaterialIcons name="verified-user" size={15} color="#047857" /><Text style={styles.controlText}>{t("stayInControl")}</Text><Text style={styles.controlHint}>{t("reviewEveryItem")}</Text></View>{!hasScanned ? <View style={styles.previewBanner}><MaterialIcons name="info-outline" size={18} color="#B45309" /><View style={styles.previewCopy}><Text style={styles.previewTitle}>Sample items for preview</Text><Text style={styles.previewText}>Run a Smart Scan to replace these examples with files from this device.</Text></View><PressableScale accessibilityRole="button" accessibilityLabel="Start Smart Scan" onPress={() => { startScan(); router.push("/scan"); }} style={styles.previewButton}><Text style={styles.previewButtonText}>Scan</Text></PressableScale></View> : null}<View accessible accessibilityRole="text" accessibilityLabel={`Cleanup opportunities. ${summaries.map((summary) => `${labels[summary.category]}: ${formatStorage(summary.reclaimableBytes)} available`).join(", ")}`} style={styles.summaryPanel}><View style={styles.summaryHeading}><View><Text style={styles.summaryTitle}>{t("cleanupOpportunities")}</Text><Text style={styles.summaryHint}>{t("potentialSpace")}</Text></View><MaterialIcons name="insights" size={19} color="#4F46E5" /></View><View style={styles.summaryGrid}>{summaries.map((summary) => <View key={summary.category} style={styles.summaryItem}><Text style={styles.summaryValue}>{formatStorage(summary.reclaimableBytes)}</Text><Text style={styles.summaryLabel}>{labels[summary.category]}</Text></View>)}</View><View style={styles.summaryActions}><PressableScale accessibilityRole="button" accessibilityLabel={t("selectSafeItemsA11y")} accessibilityHint="Selects every eligible item in this view" accessibilityState={{ disabled: scope === "protected" }} disabled={scope === "protected"} onPress={() => setSelection(true)} style={[styles.actionButton, scope === "protected" && styles.actionDisabled]}><Text style={[styles.actionText, scope === "protected" && styles.actionTextDisabled]}>{t("selectSafeItems")}</Text></PressableScale><PressableScale accessibilityRole="button" accessibilityLabel={t("clearSelectionsA11y")} accessibilityHint="Removes the current cleanup selections in this view" accessibilityState={{ disabled: scope === "protected" }} disabled={scope === "protected"} onPress={() => setSelection(false)} style={[styles.actionButton, scope === "protected" && styles.actionDisabled]}><Text style={[styles.actionText, scope === "protected" && styles.actionTextDisabled]}>{t("clear")}</Text></PressableScale></View></View>{aiAnalysis ? <View style={styles.aiPanel}><Text style={styles.aiPanelTitle}>{t("aiRecommendation")}</Text><Text style={styles.aiPanelText}>{aiAnalysis.summary}</Text><PressableScale accessibilityRole="button" accessibilityLabel={t("aiSelectLowRiskA11y", { size: formatStorage(smartSelectedBytes) })} onPress={applySmartSelection} style={styles.aiSelectButton}><MaterialIcons name="auto-awesome" size={15} color="#312E81" /><Text style={styles.aiSelectText}>{t("aiSelectLowRisk", { size: formatStorage(smartSelectedBytes) })}</Text></PressableScale></View> : null}<View style={styles.webInsightWrap}><WebInsightCard insight={webInsight} enabled={webIntelligenceEnabled} available={webIntelligenceAvailable} canRefresh={canRefreshWebInsight} canRetry={canRetryWebInsight} quotaRemaining={webInsightQuotaRemaining} onRefresh={() => { void refreshWebInsight(); }} onRetry={() => { void retryWebInsight(); }} onAskRelated={(question) => { void askRelatedWebQuestion(question); }} onEnable={() => router.push("/settings")} onUpgrade={() => router.push("/premium")} /></View><View style={styles.chips}>{(["all", "duplicates", "large", "temporary"] as const).map((key) => <PressableScale key={key} haptic={false} accessibilityRole="tab" accessibilityLabel={key === "all" ? t("showAllItems") : t("showCategory", { title: labels[key] })} accessibilityHint="Filters the cleanup list by category" accessibilityState={{ selected: category === key || (!category && !scope && key === "all") }} onPress={() => { void playSelection(); key === "all" ? router.replace("/results") : router.replace({ pathname: "/results", params: { category: key } }); }} style={[styles.chip, (category === key || (!category && !scope && key === "all")) && styles.activeChip]}><Text style={[styles.chipText, (category === key || (!category && !scope && key === "all")) && styles.activeChipText]}>{key === "all" ? t("allItems") : labels[key]}</Text></PressableScale>)}<PressableScale haptic={false} accessibilityRole="tab" accessibilityState={{ selected: scope === "protected" }} accessibilityLabel={t("showProtected")} accessibilityHint="Shows files protected from cleanup" onPress={() => { void playSelection(); router.replace({ pathname: "/results", params: { scope: "protected" } }); }} style={[styles.chip, scope === "protected" && styles.activeChip]}><Text style={[styles.chipText, scope === "protected" && styles.activeChipText]}>{t("protected")}</Text></PressableScale></View>{scope === "protected" ? <View accessible accessibilityRole="text" accessibilityLabel={t("protectedReadOnlyA11y")} style={styles.readOnlyPill}><MaterialIcons name="lock" size={14} color="#0F766E" /><Text style={styles.readOnlyText}>{t("protectedReadOnly")}</Text></View> : null}{showUpgradePrompt ? <FadeIn><View style={styles.proPrompt}><PressableScale accessibilityRole="button" accessibilityLabel="Learn about deeper review tools" onPress={() => router.push("/premium")} style={styles.proPromptMain}><View style={styles.proPromptIcon}><MaterialIcons name="auto-awesome" size={18} color="#7C3AED" /></View><View style={styles.proPromptCopy}><Text style={styles.proPromptTitle}>{getPremiumPrompt("similar-scans")}</Text><Text style={styles.proPromptText}>Unlock deeper review tools while keeping this cleanup flow free.</Text></View><MaterialIcons name="chevron-right" size={20} color="#7C3AED" /></PressableScale><PressableScale accessibilityRole="button" accessibilityLabel="Dismiss Pro suggestion" onPress={() => void dismissUpgradePrompt()} style={styles.proPromptClose}><MaterialIcons name="close" size={16} color="#7C3AED" /></PressableScale></View></FadeIn> : null}<FlatList data={visible} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} renderItem={({ item, index }) => { const aiRecommendation = getRecommendationByItemId(item.id); return <FadeIn delay={Math.min(index, 6) * 45}><PressableScale accessibilityRole="checkbox" accessibilityState={{ checked: item.selected, disabled: item.protected }} accessibilityLabel={item.protected ? `Protected item ${item.name}, ${formatStorage(item.size)}. Not eligible for cleanup selection.` : `${item.selected ? "Deselect" : "Select"} ${item.name}, ${formatStorage(item.size)}`} accessibilityHint={item.protected ? "Protected items cannot be selected for cleanup" : "Toggles whether this item is included in cleanup review"} disabled={item.protected} onPress={item.protected ? undefined : () => { void playSelection(); toggleItem(item.id); }} style={[styles.row, item.protected && styles.protectedRow]}><View style={[styles.fileIcon, { backgroundColor: item.category === "large" ? "#FFF7ED" : item.category === "temporary" ? "#ECFDF5" : "#EEF2FF" }]}><MaterialIcons name={item.category === "large" ? "movie" : item.category === "temporary" ? "delete-sweep" : "content-copy"} size={22} color={item.category === "large" ? "#F59E0B" : item.category === "temporary" ? "#10B981" : "#4F46E5"} /></View><View style={styles.fileCopy}><Text style={styles.fileName} numberOfLines={1}>{item.name}</Text><Text style={styles.fileLocation} numberOfLines={1}>{item.location} · {getRecommendation(item, items, largeFileThreshold)}</Text>{aiRecommendation ? <View style={styles.confidenceRow}><Text style={styles.confidenceBadge}>{Math.round(aiRecommendation.confidence * 100)}% confidence</Text><PressableScale haptic={false} accessibilityRole="button" accessibilityLabel={`Why this recommendation for ${item.name}`} onPress={() => { try { AccessibilityInfo.announceForAccessibility(aiRecommendation.explanation); } catch { /* optional accessibility channel */ } Alert.alert("Why this recommendation", aiRecommendation.explanation); }}><Text style={styles.whyLink}>Why?</Text></PressableScale></View> : null}</View><View style={styles.fileRight}><Text style={styles.fileSize}>{formatStorage(item.size)}</Text><PressableScale haptic={false} accessibilityRole="button" accessibilityLabel={item.protected ? `Unprotect ${item.name}` : `Protect ${item.name}`} accessibilityHint="Changes whether this item is excluded from cleanup" accessibilityState={{ checked: item.protected }} onPress={(event) => { event.stopPropagation(); handleProtectedToggle(item.id, item.protected === true); }} style={[styles.protectButton, item.protected && styles.protectedButton]}><MaterialIcons name={item.protected ? "lock" : "lock-open"} size={16} color={item.protected ? "#0F766E" : "#94A3B8"} /></PressableScale><PopScale active={item.selected}><View style={[styles.checkbox, item.selected && styles.checked]}>{item.selected && <MaterialIcons name="check" size={15} color="#FFFFFF" />}</View></PopScale></View></PressableScale></FadeIn>; }} ListEmptyComponent={<View accessible accessibilityRole="text" accessibilityLabel="Nothing to clean. Run another scan when you want a fresh storage snapshot." style={styles.empty}><MaterialIcons name="task-alt" size={40} color="#10B981" /><Text style={styles.emptyTitle}>Nothing to clean</Text><Text style={styles.subtitle}>Run another scan when you want a fresh storage snapshot.</Text></View>} /><PressableScale accessibilityRole="button" accessibilityLabel={scope === "protected" ? "Protected files only" : `Review ${formatStorage(selectedBytes)} cleanup`} accessibilityHint={scope === "protected" ? "Protected files cannot be cleaned up" : "Opens the final cleanup review"} accessibilityState={{ disabled: scope === "protected" || !selectedBytes }} disabled={scope === "protected" || !selectedBytes} onPress={() => router.push("/review")} style={[styles.bottomButton, (scope === "protected" || !selectedBytes) && styles.disabled]}><Text style={styles.bottomButtonText}>{scope === "protected" ? "Protected files only" : `Review ${formatStorage(selectedBytes)} cleanup`}</Text><MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" /></PressableScale></ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 },
  eyebrow: { color: "#64748B", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: "#111827", fontSize: 30, fontWeight: "800", marginTop: 6 },
  total: { alignItems: "flex-end" },
  totalValue: { color: "#4F46E5", fontSize: 22, fontWeight: "800" },
  totalLabel: { color: "#64748B", fontSize: 11 },
  subtitle: { color: "#64748B", fontSize: 14, lineHeight: 20 },
  summaryPanel: { backgroundColor: "#F8FAFC", borderRadius: 17, padding: 14, marginTop: 16 },
  summaryHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryTitle: { color: "#94A3B8", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  summaryHint: { color: "#64748B", fontSize: 11, marginTop: 3 },
  controlPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, backgroundColor: "#ECFDF5", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, marginTop: 14 },
  controlText: { color: "#047857", fontSize: 11, fontWeight: "800" },
  controlHint: { color: "#059669", fontSize: 10, marginLeft: 3 },
  summaryGrid: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  summaryItem: { flex: 1 },
  summaryValue: { color: "#334155", fontWeight: "800", fontSize: 14 },
  summaryLabel: { color: "#64748B", fontSize: 11, marginTop: 3 },
  summaryActions: { flexDirection: "row", gap: 8, marginTop: 13 },
  actionButton: { backgroundColor: "#FFFFFF", borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  actionText: { color: "#4F46E5", fontSize: 11, fontWeight: "800" },
  actionDisabled: { opacity: 0.55, backgroundColor: "#F1F5F9" },
  actionTextDisabled: { color: "#94A3B8" },
  aiPanel: { backgroundColor: "#EEF2FF", borderRadius: 16, padding: 12, marginTop: 10 },
  aiPanelTitle: { color: "#3730A3", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  aiPanelText: { color: "#3730A3", fontSize: 12, lineHeight: 17, marginTop: 5 },
  aiSelectButton: { alignSelf: "flex-start", marginTop: 10, backgroundColor: "#FFFFFF", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  aiSelectText: { color: "#312E81", fontSize: 11, fontWeight: "800" },
  webInsightWrap: { marginTop: 10 },
  readOnlyPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, backgroundColor: "#CCFBF1", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 10 },
  readOnlyText: { color: "#0F766E", fontSize: 11, fontWeight: "800" },
  chips: { flexDirection: "row", gap: 8, marginVertical: 18, flexWrap: "wrap" },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 20, backgroundColor: "#F1F5F9" },
  activeChip: { backgroundColor: "#4F46E5" },
  chipText: { color: "#64748B", fontWeight: "700", fontSize: 12 },
  activeChipText: { color: "#FFFFFF" },
  list: { gap: 10, paddingBottom: 96 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 17, borderWidth: 1, borderColor: "#E5E7EB", padding: 12 },
  protectedRow: { opacity: 0.72, backgroundColor: "#F8FAFC" },
  fileIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  fileCopy: { flex: 1, marginLeft: 12 },
  fileName: { color: "#111827", fontSize: 14, fontWeight: "800" },
  fileLocation: { color: "#94A3B8", fontSize: 11, marginTop: 4 },
  confidenceRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  confidenceBadge: { color: "#4338CA", fontSize: 10, fontWeight: "800", backgroundColor: "#EEF2FF", paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 },
  whyLink: { color: "#4F46E5", fontSize: 11, fontWeight: "700" },
  fileRight: { alignItems: "flex-end", gap: 8 },
  protectButton: { width: 25, height: 25, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFC" },
  protectedButton: { backgroundColor: "#CCFBF1" },
  fileSize: { color: "#475569", fontSize: 12, fontWeight: "800" },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },
  checked: { backgroundColor: "#4F46E5", borderColor: "#4F46E5" },
  bottomButton: { position: "absolute", left: 20, right: 20, bottom: 16, backgroundColor: "#111827", borderRadius: 16, paddingVertical: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 },
  bottomButtonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.8 },
  proPrompt: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F5F3FF", borderRadius: 16, padding: 8, marginBottom: 10 },
  proPromptMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 4 },
  proPromptClose: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  proPromptIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  proPromptCopy: { flex: 1 },
  proPromptTitle: { color: "#5B21B6", fontSize: 12, fontWeight: "800" },
  proPromptText: { color: "#7C3AED", fontSize: 10, lineHeight: 14, marginTop: 2 },
  empty: { alignItems: "center", marginTop: 80, gap: 10, paddingHorizontal: 16 },
  emptyTitle: { color: "#111827", fontSize: 20, fontWeight: "800" },
  emptyButton: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#111827", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, marginTop: 8 },
  emptyButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  previewBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFFBEB", borderRadius: 14, padding: 12, marginTop: 12 },
  previewCopy: { flex: 1 },
  previewTitle: { color: "#92400E", fontSize: 12, fontWeight: "800" },
  previewText: { color: "#B45309", fontSize: 11, lineHeight: 15, marginTop: 2 },
  previewButton: { backgroundColor: "#FFFFFF", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  previewButtonText: { color: "#B45309", fontSize: 12, fontWeight: "800" },
});
