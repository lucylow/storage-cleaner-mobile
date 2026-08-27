import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { AnimatedBar, CircularProgress, CountUpText, FadeIn, LiveDot, PressableScale, ShimmerBlock, SpinningIcon } from "@/components/motion";
import { playImpact } from "@/lib/haptics";
import { useCleaner, formatStorage } from "@/lib/cleaner-store";
import { WebInsightCard } from "@/components/web-insight-card";
import { getDeviceStorageInfo, type StorageInfo } from "@/lib/storage-service";
import { canApplyStorageRefresh, formatBytes, getGuidePersistenceFailureMessage } from "@/lib/storage-logic";
import { formatCategoryDetail, formatCategoryReviewHint, summarizeCleanup } from "@/lib/analysis-logic";
import { useTranslation } from "@/lib/locale-provider";

const GUIDE_DISMISSED_KEY = "storage-cleaner.home-guide-dismissed.v1";

const categories = [
  { key: "duplicates" as const, titleKey: "categoryDuplicates" as const, descriptionKey: "categoryDuplicatesDesc" as const, icon: "content-copy", color: "#4F46E5", tint: "#EEF2FF" },
  { key: "large" as const, titleKey: "categoryLarge" as const, descriptionKey: "categoryLargeDesc" as const, icon: "video-library", color: "#D97706", tint: "#FFF7ED" },
  { key: "temporary" as const, titleKey: "categoryTemporary" as const, descriptionKey: "categoryTemporaryDesc" as const, icon: "auto-delete", color: "#059669", tint: "#ECFDF5" },
];

export default function HomeScreen() {
  const { t } = useTranslation();
  const { selectedBytes, lastScanLabel, startScan, items, largeFileThreshold, aiAnalysis, isAnalyzingAI, applySmartSelection, smartSelectedBytes, webIntelligenceEnabled, webIntelligenceAvailable, refreshWebInsight, retryWebInsight, askRelatedWebQuestion, canRefreshWebInsight, canRetryWebInsight, webInsightQuotaRemaining, webInsight } = useCleaner();
  const categorySummaries = summarizeCleanup(items.filter((item) => !item.protected), largeFileThreshold);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [storageLoading, setStorageLoading] = useState(true);
  const [storageError, setStorageError] = useState(false);
  const [storageUpdatedAt, setStorageUpdatedAt] = useState<number | null>(null);
  const mountedRef = useRef(true);
  const storageRequestRef = useRef(0);
  const guideRequestRef = useRef(0);
  const guideOpacity = useRef(new Animated.Value(0)).current;
  const guideTranslateY = useRef(new Animated.Value(8)).current;
  const [showGuide, setShowGuide] = useState(false);
  const [guideHydrated, setGuideHydrated] = useState(false);
  const [guidePersistenceWarning, setGuidePersistenceWarning] = useState<string | null>(null);

  const announceStorage = (message: string) => { try { AccessibilityInfo.announceForAccessibility(message); } catch { /* optional accessibility channel */ } };

  const refreshStorage = useCallback(async () => {
    if (!mountedRef.current) return;
    const requestId = storageRequestRef.current + 1;
    storageRequestRef.current = requestId;
    setStorageLoading(true);
    setStorageError(false);
    announceStorage(t("announcingRefresh"));
    try {
      const result = await getDeviceStorageInfo();
      if (!canApplyStorageRefresh(requestId, storageRequestRef.current, mountedRef.current)) return;
      setStorage(result);
      if (result) { setStorageUpdatedAt(Date.now()); announceStorage(t("announcingRefreshed")); } else { setStorageError(true); announceStorage(t("announcingUnavailable")); }
    } catch {
      if (canApplyStorageRefresh(requestId, storageRequestRef.current, mountedRef.current)) {
        setStorage(null);
        setStorageError(true);
        announceStorage(t("announcingReadFailed"));
      }
    } finally {
      if (canApplyStorageRefresh(requestId, storageRequestRef.current, mountedRef.current)) setStorageLoading(false);
    }
  }, [t]);

  useEffect(() => {
    mountedRef.current = true;
    const hydrationRequestId = guideRequestRef.current + 1;
    guideRequestRef.current = hydrationRequestId;
    void refreshStorage();
    void AsyncStorage.getItem(GUIDE_DISMISSED_KEY).then((value) => {
      if (!mountedRef.current || guideRequestRef.current !== hydrationRequestId) return;
      const dismissed = value === "true";
      setShowGuide(!dismissed);
      setGuideHydrated(true);
      if (!dismissed) {
        Animated.parallel([
          Animated.timing(guideOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.timing(guideTranslateY, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]).start();
      }
    }).catch(() => {
      if (!mountedRef.current || guideRequestRef.current !== hydrationRequestId) return;
      setShowGuide(true);
      setGuideHydrated(true);
    });
    return () => { mountedRef.current = false; guideOpacity.stopAnimation(); guideTranslateY.stopAnimation(); };
  }, [guideOpacity, guideTranslateY, refreshStorage]);

  const dismissGuide = () => {
    const persistenceRequestId = guideRequestRef.current + 1;
    guideRequestRef.current = persistenceRequestId;
    setShowGuide(false);
    setGuidePersistenceWarning(null);
    void AsyncStorage.setItem(GUIDE_DISMISSED_KEY, "true").catch(() => {
      if (mountedRef.current && guideRequestRef.current === persistenceRequestId) setGuidePersistenceWarning(getGuidePersistenceFailureMessage());
    });
  };

  return (
    <ScreenContainer className="px-5 pt-3" containerClassName="bg-background">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl accessibilityLabel={t("refreshDeviceStorage")} refreshing={storageLoading} onRefresh={refreshStorage} tintColor="#4F46E5" colors={["#4F46E5"]} />}
      >
        <FadeIn>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <View style={styles.eyebrowRow}><LiveDot /><Text style={styles.eyebrow}>{t("homeEyebrow")}</Text></View>
              <Text style={styles.title}>{t("homeTitle")}</Text>
              <Text style={styles.subtitle}>{t("homeSubtitle")}</Text>
            </View>
            <PressableScale onPress={() => router.push("/settings")} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={t("openSettings")}>
              <MaterialIcons name="settings" size={21} color="#4F46E5" />
            </PressableScale>
          </View>
        </FadeIn>

        <FadeIn delay={60}>
          <View accessible accessibilityRole="text" accessibilityLabel={webIntelligenceEnabled ? t("privacyA11yOptedIn") : t("privacyA11y")} style={styles.privacyPill}><MaterialIcons name="verified-user" size={16} color="#047857" /><Text style={styles.privacyText}>{t("privacyByDesign")}</Text><View style={styles.privacyDivider} /><Text style={styles.privacyHint}>{webIntelligenceEnabled ? t("privacyFilesStay") : t("privacyNothingLeaves")}</Text></View>
        </FadeIn>

        {guidePersistenceWarning ? <View accessible accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={guidePersistenceWarning} style={styles.guideWarning}><MaterialIcons name="info-outline" size={16} color="#92400E" /><Text style={styles.guideWarningText}>{guidePersistenceWarning}</Text></View> : null}
        {guideHydrated && showGuide ? <Animated.View style={{ opacity: guideOpacity, transform: [{ translateY: guideTranslateY }] }}><View style={styles.guideCard}><View style={styles.guideHeader}><View style={styles.guideIcon}><MaterialIcons name="route" size={18} color="#4F46E5" /></View><View style={styles.guideCopy}><Text style={styles.guideTitle}>{t("guideTitle")}</Text><Text style={styles.guideSubtitle}>{t("guideSubtitle")}</Text></View><PressableScale accessibilityRole="button" accessibilityLabel={t("guideDismiss")} accessibilityHint={t("guideDismissHint")} onPress={dismissGuide} style={styles.guideClose}><MaterialIcons name="close" size={17} color="#6366F1" /></PressableScale></View><View accessible accessibilityRole="text" accessibilityLabel={t("guideA11y")} style={styles.guideSteps}><View style={styles.guideStep}><Text style={styles.guideNumber}>1</Text><Text style={styles.guideStepText}>{t("guideStep1")}</Text></View><MaterialIcons name="chevron-right" size={16} color="#A5B4FC" /><View style={styles.guideStep}><Text style={styles.guideNumber}>2</Text><Text style={styles.guideStepText}>{t("guideStep2")}</Text></View><MaterialIcons name="chevron-right" size={16} color="#A5B4FC" /><View style={styles.guideStep}><Text style={styles.guideNumber}>3</Text><Text style={styles.guideStepText}>{t("guideStep3")}</Text></View></View></View></Animated.View> : null}

        <FadeIn delay={90}>
          <View style={styles.storageCard}>
            <View pointerEvents="none" style={styles.orbLarge} />
            <View pointerEvents="none" style={styles.orbSmall} />
            <View style={styles.storageCardTop}><Text style={styles.cardLabel}>{t("deviceStorage")}</Text><View accessible accessibilityRole="text" accessibilityLabel={t("localDeviceReading")} style={styles.localBadge}><MaterialIcons name="lock" size={12} color="#C7D2FE" /><Text style={styles.localBadgeText}>{t("local")}</Text></View></View>
            <PressableScale onPress={refreshStorage} disabled={storageLoading} style={styles.refreshButton} accessibilityRole="button" accessibilityLabel={storageLoading ? t("refreshingDeviceStorage") : t("refreshDeviceStorage")} accessibilityState={{ disabled: storageLoading }}>
              <SpinningIcon spinning={storageLoading}><MaterialIcons name="refresh" size={17} color="#C7D2FE" /></SpinningIcon><Text style={styles.refreshText}>{storageLoading ? t("refreshing") : t("refresh")}</Text>
            </PressableScale>
            {storageLoading ? <View accessible accessibilityRole="text" accessibilityLiveRegion="polite" style={styles.loadingState}><Text style={styles.storageUnavailable}>{t("readingStorage")}</Text><Text style={styles.cardHint}>{t("checkingCapacity")}</Text><ShimmerBlock style={styles.loadingShimmer} /></View> : storage ? <>
              <View accessible accessibilityRole="text" accessibilityLabel={`${formatBytes(storage.usedBytes)} ${t("usedOnDevice")}. ${storage.percentUsed}% ${t("used")}. ${t("capacityLabel", { size: formatBytes(storage.totalBytes) })}. ${t("freeLabel", { size: formatBytes(storage.freeBytes) })}.`} style={styles.storageTop}><View><CountUpText value={storage.usedBytes} format={(bytes) => formatBytes(bytes).replace(/ (GB|MB|KB)$/, "")} style={styles.storageValue} /><Text style={styles.storageUnitLabel}>{formatBytes(storage.usedBytes).includes("GB") ? "GB" : formatBytes(storage.usedBytes).includes("MB") ? "MB" : ""} {t("usedOnDevice")}</Text></View><CircularProgress progress={storage.percentUsed} trackColor="#3730A3" fillColor="#C7D2FE"><Text style={styles.ringText}>{storage.percentUsed}%</Text><Text style={styles.ringCaption}>{t("used")}</Text></CircularProgress></View>
              <AnimatedBar progress={storage.percentUsed} trackStyle={styles.track} fillStyle={styles.trackFill} /><View style={styles.storageMeta}><Text style={styles.capacityText}>{t("capacityLabel", { size: formatBytes(storage.totalBytes) })}</Text><Text style={styles.freeText}>{t("freeLabel", { size: formatBytes(storage.freeBytes) })}</Text></View>
            </> : <View accessible accessibilityRole="text" accessibilityLiveRegion="polite" style={styles.loadingState}><Text style={styles.storageUnavailable}>{t("storageUnavailable")}</Text><Text style={styles.cardHint}>{storageError ? t("storageRetryHint") : t("storageNativeHint")}</Text></View>}
          </View>
        </FadeIn>

        <FadeIn delay={140}>
          <PressableScale accessibilityRole="button" accessibilityLabel={lastScanLabel === "Never scanned" ? t("scanToFindA11y") : t("reclaimA11y", { size: formatStorage(selectedBytes) })} onPress={() => { if (lastScanLabel === "Never scanned") { void playImpact(); announceStorage(t("scanToFindA11y")); startScan(); router.push("/scan"); return; } router.push("/results"); }} style={styles.opportunityCard}><View style={styles.opportunityIcon}><MaterialIcons name="auto-fix-high" size={20} color="#4F46E5" /></View><View style={styles.opportunityCopy}>{lastScanLabel === "Never scanned" ? <Text style={styles.opportunityTitle}>{t("scanToFindSpace")}</Text> : <CountUpText value={selectedBytes} format={(bytes) => t("readyToReclaim", { size: formatStorage(bytes) })} style={styles.opportunityTitle} />}<Text style={styles.opportunityHint}>{lastScanLabel === "Never scanned" ? t("scanToFindHint") : t("scanFindsMore")}</Text></View><MaterialIcons name="chevron-right" size={20} color="#94A3B8" /></PressableScale>
        </FadeIn>
        <FadeIn delay={180}>
          <View style={styles.aiCard}><View style={styles.aiHeader}><View style={styles.aiEyebrowRow}>{isAnalyzingAI ? <LiveDot color="#6366F1" size={5} /> : null}<Text style={styles.aiEyebrow}>{t("aiStorageHealth")}</Text></View>{aiAnalysis ? <CountUpText value={aiAnalysis.storageHealth.score} format={(score) => `${Math.round(score)}/100`} style={styles.aiScore} /> : <Text style={styles.aiScore}>—</Text>}</View><Text style={styles.aiTitle}>{isAnalyzingAI ? t("aiBuildingReport") : aiAnalysis ? aiAnalysis.storageHealth.label : t("aiRunScan")}</Text><Text style={styles.aiHint}>{aiAnalysis ? aiAnalysis.summary : t("aiFilesStayLocal")}</Text>{aiAnalysis ? <View style={styles.aiStats}><Text style={styles.aiStat}>{t("aiPotential", { size: formatStorage(aiAnalysis.reclaimableBytes) })}</Text><Text style={styles.aiStat}>{t("aiConfidence", { value: Math.round(aiAnalysis.confidence * 100) })}</Text></View> : null}{aiAnalysis ? <PressableScale accessibilityRole="button" accessibilityLabel={t("aiSelectLowRiskA11y", { size: formatStorage(smartSelectedBytes) })} onPress={applySmartSelection} style={styles.aiButton}><MaterialIcons name="auto-awesome" size={16} color="#312E81" /><Text style={styles.aiButtonText}>{t("aiSelectLowRisk", { size: formatStorage(smartSelectedBytes) })}</Text></PressableScale> : null}</View>
          <WebInsightCard insight={webInsight} enabled={webIntelligenceEnabled} available={webIntelligenceAvailable} canRefresh={canRefreshWebInsight} canRetry={canRetryWebInsight} quotaRemaining={webInsightQuotaRemaining} onRefresh={() => { void refreshWebInsight(); }} onRetry={() => { void retryWebInsight(); }} onAskRelated={(question) => { void askRelatedWebQuestion(question); }} onEnable={() => router.push("/settings")} onUpgrade={() => router.push("/premium")} />
        </FadeIn>
        <FadeIn delay={220}>
          <PressableScale accessibilityRole="button" accessibilityLabel={t("smartScanA11y")} onPress={() => { void playImpact(); announceStorage(t("announcingStartScan")); startScan(); router.push("/scan"); }} style={styles.primaryButton}><View style={styles.primaryIcon}><MaterialIcons name="radar" size={19} color="#111827" /></View><View style={styles.primaryCopy}><Text style={styles.primaryText}>{t("smartScan")}</Text><Text style={styles.primaryHint}>{t("smartScanHint")}</Text></View><MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" /></PressableScale>
        </FadeIn>
        <Text accessibilityRole="text" accessibilityLabel={t("lastScanA11y", { label: lastScanLabel })} style={styles.scanStatus}><MaterialIcons name="history" size={13} color="#94A3B8" />  {t("lastScan", { label: lastScanLabel })} <Text style={styles.statusDot}>·</Text> {t("staysOnDevice")}</Text>
        {storageUpdatedAt ? <Text accessibilityRole="text" accessibilityLabel={t("storageRefreshedA11y", { time: new Date(storageUpdatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) })} style={styles.storageUpdated}>{t("storageRefreshed", { time: new Date(storageUpdatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) })}</Text> : null}

        <FadeIn delay={260}>
          <View accessible accessibilityRole="text" accessibilityLabel={t("categoriesA11y")} style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>{t("cleanupCategories")}</Text><Text style={styles.sectionSub}>{t("chooseWhatToReview")}</Text></View><PressableScale accessibilityRole="button" accessibilityLabel={t("seeAllCategories")} onPress={() => router.push("/results")}><Text style={styles.link}>{t("seeAll")}</Text></PressableScale></View>
        </FadeIn>
        <View style={styles.categoryList}>{categories.map((category, index) => { const title = t(category.titleKey); const description = t(category.descriptionKey); return <FadeIn key={category.key} delay={300 + index * 70}><PressableScale accessibilityRole="button" accessibilityLabel={t("reviewCategoryA11y", { title, detail: formatCategoryDetail(categorySummaries.find((summary) => summary.category === category.key) ?? { category: category.key, itemCount: 0, reclaimableBytes: 0, selectedBytes: 0 }) })} accessibilityHint={formatCategoryReviewHint(title)} onPress={() => router.push({ pathname: "/results", params: { category: category.key } })} style={styles.categoryCard}><View style={[styles.categoryIcon, { backgroundColor: category.tint }]}><MaterialIcons name={category.icon as never} size={22} color={category.color} /></View><View style={styles.categoryCopy}><Text style={styles.categoryTitle}>{title}</Text><Text style={styles.categoryDescription}>{description}</Text><Text style={styles.muted}>{formatCategoryDetail(categorySummaries.find((summary) => summary.category === category.key) ?? { category: category.key, itemCount: 0, reclaimableBytes: 0, selectedBytes: 0 })}</Text></View><MaterialIcons name="chevron-right" size={22} color="#94A3B8" /></PressableScale></FadeIn>; })}</View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, gap: 14 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 3 },
  headerCopy: { flex: 1, paddingRight: 12 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  eyebrow: { color: "#64748B", fontSize: 10, fontWeight: "800", letterSpacing: 1.25 },
  title: { color: "#111827", fontSize: 29, lineHeight: 35, fontWeight: "800", marginTop: 7 },
  subtitle: { color: "#64748B", fontSize: 13, lineHeight: 19, marginTop: 7 },
  iconButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  privacyPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: "#ECFDF5", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, gap: 6 },
  privacyText: { color: "#047857", fontSize: 11, fontWeight: "800" },
  privacyDivider: { width: 1, height: 13, backgroundColor: "#A7F3D0", marginHorizontal: 2 },
  privacyHint: { color: "#059669", fontSize: 10, fontWeight: "600" },
  guideWarning: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#FFFBEB", borderRadius: 12, padding: 10, marginBottom: 10 },
  guideWarningText: { flex: 1, color: "#92400E", fontSize: 11, lineHeight: 16, fontWeight: "700" },
  guideCard: { backgroundColor: "#EEF2FF", borderRadius: 18, padding: 14 },
  guideHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  guideIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  guideCopy: { flex: 1 },
  guideClose: { width: 30, height: 30, borderRadius: 10, backgroundColor: "#E0E7FF", alignItems: "center", justifyContent: "center" },
  guideTitle: { color: "#312E81", fontSize: 13, fontWeight: "800" },
  guideSubtitle: { color: "#6366F1", fontSize: 11, marginTop: 2 },
  guideSteps: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 13 },
  guideStep: { flexDirection: "row", alignItems: "center", gap: 5 },
  guideNumber: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#4F46E5", color: "#FFFFFF", fontSize: 11, fontWeight: "800", textAlign: "center", paddingTop: 3 },
  guideStepText: { color: "#3730A3", fontSize: 10, fontWeight: "800" },
  storageCard: { backgroundColor: "#4F46E5", borderRadius: 24, padding: 21, position: "relative", marginTop: 2, elevation: 4, overflow: "hidden" },
  orbLarge: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.08)", top: -70, right: -40 },
  orbSmall: { position: "absolute", width: 90, height: 90, borderRadius: 45, backgroundColor: "rgba(255,255,255,0.07)", bottom: -30, left: -20 },
  storageCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingRight: 95 },
  cardLabel: { color: "#C7D2FE", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  localBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#4338CA", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  localBadgeText: { color: "#C7D2FE", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  refreshButton: { position: "absolute", top: 16, right: 16, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 12, backgroundColor: "#4338CA" },
  refreshText: { color: "#C7D2FE", fontSize: 11, fontWeight: "800" },
  loadingState: { minHeight: 112, justifyContent: "center" },
  loadingShimmer: { height: 8, marginTop: 18 },
  storageUnavailable: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", marginTop: 11 },
  cardHint: { color: "#C7D2FE", fontSize: 12, lineHeight: 18, marginTop: 4, maxWidth: 285 },
  storageTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  storageValue: { color: "#FFFFFF", fontSize: 42, lineHeight: 48, fontWeight: "800" },
  storageUnitLabel: { color: "#C7D2FE", fontSize: 12, marginTop: 2 },
  ringText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
  ringCaption: { color: "#C7D2FE", fontSize: 10 },
  track: { height: 8, backgroundColor: "#3730A3", borderRadius: 4, marginTop: 20, overflow: "hidden" },
  trackFill: { height: 8, backgroundColor: "#FFFFFF", borderRadius: 4 },
  storageMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  muted: { color: "#64748B", fontSize: 12, lineHeight: 17 },
  capacityText: { color: "#C7D2FE", fontSize: 12 },
  freeText: { color: "#C7D2FE", fontSize: 12, fontWeight: "700" },
  opportunityCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#EEF2FF", borderRadius: 17, padding: 12 },
  opportunityIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  opportunityCopy: { flex: 1, marginLeft: 11 },
  opportunityTitle: { color: "#312E81", fontSize: 14, fontWeight: "800" },
  opportunityHint: { color: "#64748B", fontSize: 11, marginTop: 2 },
  aiCard: { backgroundColor: "#F8FAFC", borderRadius: 17, borderWidth: 1, borderColor: "#E2E8F0", padding: 14 },
  aiHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  aiEyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  aiEyebrow: { color: "#64748B", fontSize: 10, fontWeight: "800", letterSpacing: 1.05 },
  aiScore: { color: "#111827", fontSize: 14, fontWeight: "800" },
  aiTitle: { color: "#111827", fontSize: 16, fontWeight: "800", marginTop: 6 },
  aiHint: { color: "#475569", fontSize: 12, lineHeight: 18, marginTop: 5 },
  aiStats: { flexDirection: "row", gap: 14, marginTop: 10 },
  aiStat: { color: "#312E81", fontSize: 11, fontWeight: "700" },
  aiButton: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#E0E7FF", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9, alignSelf: "flex-start" },
  aiButtonText: { color: "#312E81", fontSize: 11, fontWeight: "800" },
  primaryButton: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#111827", borderRadius: 17, paddingVertical: 13, paddingHorizontal: 14, marginTop: 1 },
  primaryIcon: { width: 35, height: 35, borderRadius: 12, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  primaryCopy: { flex: 1 },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  primaryHint: { color: "#CBD5E1", fontSize: 10, marginTop: 2 },
  scanStatus: { flexDirection: "row", alignItems: "center", color: "#64748B", fontSize: 11, textAlign: "center", marginTop: -3 },
  statusDot: { color: "#CBD5E1" },
  storageUpdated: { color: "#94A3B8", fontSize: 10, textAlign: "center", marginTop: -7 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 9 },
  sectionTitle: { color: "#111827", fontSize: 18, fontWeight: "800" },
  sectionSub: { color: "#94A3B8", fontSize: 11, marginTop: 3 },
  link: { color: "#4F46E5", fontWeight: "800", fontSize: 12, paddingBottom: 2 },
  categoryList: { gap: 10 },
  categoryCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 18, padding: 13, elevation: 1 },
  categoryIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  categoryCopy: { flex: 1, marginLeft: 13 },
  categoryTitle: { color: "#111827", fontSize: 15, fontWeight: "800" },
  categoryDescription: { color: "#64748B", fontSize: 11, marginTop: 3, marginBottom: 2 },
});
