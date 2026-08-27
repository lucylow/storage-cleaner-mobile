import { MaterialIcons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useState } from "react";
import { AccessibilityInfo, Alert, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { LanguagePicker } from "@/components/language-picker";
import { FadeIn, PressableScale } from "@/components/motion";
import { ScreenContainer } from "@/components/screen-container";
import { MARKETING_COPY } from "@/lib/branding";
import { useCleaner } from "@/lib/cleaner-store";
import { useTranslation } from "@/lib/locale-provider";
import { usePremium } from "@/lib/premium-store";
import { formatScanTimeout, shouldShowPermissionNotice } from "@/lib/scanner-logic";
import { useThemeContext } from "@/lib/theme-provider";

export default function SettingsScreen() {
  const pathname = usePathname();
  const showBack = pathname === "/settings";
  const { t, noun } = useTranslation();
  const { protectedCount, largeFileThreshold, setLargeFileThreshold, scanTimeoutMs, cycleScanTimeout, scanDiagnosticCounters, persistenceWarning, permissionAnnouncement, webIntelligenceEnabled, webIntelligenceAvailable, setWebIntelligenceEnabled } = useCleaner();
  const { isPro } = usePremium();
  const { colorScheme, setColorScheme, reducedMotion, setReducedMotion, preferenceWarning } = useThemeContext();
  const [dismissedPermissionMessage, setDismissedPermissionMessage] = useState<string | null>(null);
  const announce = (message: string) => { try { AccessibilityInfo.announceForAccessibility(message); } catch { /* optional accessibility channel */ } };
  const dismissPermissionNotice = () => { setDismissedPermissionMessage(permissionAnnouncement); announce("Permission status notice dismissed."); };
  const cycleThreshold = () => {
    const nextThreshold = largeFileThreshold >= 2000 ? 500 : largeFileThreshold + 500;
    setLargeFileThreshold(nextThreshold);
    announce(`Large file threshold set to ${nextThreshold} megabytes.`);
  };
  const cycleTimeout = () => { cycleScanTimeout(); announce("Long scan timeout updated."); };
  const openPrivacyPolicy = () => {
    Alert.alert("Privacy policy", MARKETING_COPY.privacyDescription, [{ text: "OK" }]);
  };

  return (
    <ScreenContainer className="px-5 pt-3">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {showBack ? (
          <PressableScale haptic={false} accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
            <MaterialIcons name="arrow-back" size={21} color="#111827" />
            <Text style={styles.backText}>{t("back")}</Text>
          </PressableScale>
        ) : null}
        <FadeIn>
          <Text style={styles.eyebrow}>{t("settingsEyebrow")}</Text>
          <Text style={styles.title}>{t("settingsTitle")}</Text>
        </FadeIn>
        {preferenceWarning ? <View accessible accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={preferenceWarning} style={styles.preferenceWarning}><MaterialIcons name="info-outline" size={17} color="#92400E" /><Text style={styles.preferenceWarningText}>{preferenceWarning}</Text></View> : null}
        {shouldShowPermissionNotice(permissionAnnouncement, dismissedPermissionMessage) ? (
          <View accessible accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={permissionAnnouncement ?? "Permission status update"} style={styles.warningCard}>
            <MaterialIcons name="info-outline" size={19} color="#B45309" />
            <Text style={styles.warningText}>{permissionAnnouncement}</Text>
            <PressableScale haptic={false} accessibilityRole="button" accessibilityLabel="Dismiss permission status notice" accessibilityHint="Hides this notice until the next permission status update" onPress={dismissPermissionNotice} style={styles.noticeDismissButton}>
              <MaterialIcons name="close" size={18} color="#92400E" />
            </PressableScale>
          </View>
        ) : null}
        {persistenceWarning ? <View accessible accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={persistenceWarning} style={styles.warningCard}><MaterialIcons name="info-outline" size={19} color="#B45309" /><Text style={styles.warningText}>{persistenceWarning}</Text></View> : null}
        <View accessible accessibilityRole="text" accessibilityLabel={t("localOnlyA11y")} style={styles.localPill}><MaterialIcons name="lock" size={14} color="#047857" /><Text style={styles.localPillText}>{t("localOnlyControls")}</Text><Text style={styles.localPillHint}>{t("noAccountRequired")}</Text></View>
        <Text style={styles.section}>{t("appearance")}</Text>
        <View style={styles.appearancePanel}>
          <View style={styles.appearanceCopy}>
            <Text style={styles.rowTitle}>{t("colorTheme")}</Text>
            <Text style={styles.muted}>{colorScheme === "dark" ? t("midnightContrast") : t("softDaylight")}</Text>
          </View>
          <View style={styles.themeToggle}>
            <PressableScale haptic={false} accessibilityRole="button" accessibilityLabel={t("useLightAppearance")} accessibilityState={{ selected: colorScheme === "light" }} onPress={() => setColorScheme("light")} style={[styles.themeOption, colorScheme === "light" && styles.themeOptionActive]}>
              <MaterialIcons name="light-mode" size={15} color={colorScheme === "light" ? "#FFFFFF" : "#64748B"} />
              <Text style={[styles.themeOptionText, colorScheme === "light" && styles.themeOptionTextActive]}>{t("light")}</Text>
            </PressableScale>
            <PressableScale haptic={false} accessibilityRole="button" accessibilityLabel={t("useDarkAppearance")} accessibilityState={{ selected: colorScheme === "dark" }} onPress={() => setColorScheme("dark")} style={[styles.themeOption, colorScheme === "dark" && styles.themeOptionActive]}>
              <MaterialIcons name="dark-mode" size={15} color={colorScheme === "dark" ? "#FFFFFF" : "#64748B"} />
              <Text style={[styles.themeOptionText, colorScheme === "dark" && styles.themeOptionTextActive]}>{t("dark")}</Text>
            </PressableScale>
          </View>
        </View>
        <View style={styles.motionPanel}>
          <View style={styles.appearanceCopy}>
            <Text style={styles.rowTitle}>{t("reducedMotion")}</Text>
            <Text style={styles.muted}>{reducedMotion ? t("animationsMinimized") : t("gentleTransitions")}</Text>
          </View>
          <Switch accessibilityRole="switch" accessibilityLabel={t("reducedMotion")} accessibilityState={{ checked: reducedMotion }} value={reducedMotion} onValueChange={setReducedMotion} trackColor={{ false: "#CBD5E1", true: "#A5B4FC" }} thumbColor={reducedMotion ? "#4F46E5" : "#FFFFFF"} />
        </View>
        <Text style={styles.section}>{t("language")}</Text>
        <LanguagePicker />
        <View accessible accessibilityRole="text" accessibilityLabel={t("localFirstPrivacyA11y")} style={styles.privacyCard}>
          <View style={styles.privacyIcon}><MaterialIcons name="lock" size={22} color="#10B981" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{t("localFirstPrivacy")}</Text>
            <Text style={styles.muted}>{t("localFirstPrivacyBody")}</Text>
            <Text style={styles.muted}>{t("liveWebTipsAlwaysLocal")}</Text>
            <Text style={styles.muted}>{t("liveWebTipsIfEnabled")}</Text>
          </View>
        </View>
        <View style={styles.webTipsPanel}>
          <View style={styles.appearanceCopy}>
            <Text style={styles.rowTitle}>{t("liveWebTips")}</Text>
            <Text style={styles.muted}>{webIntelligenceAvailable ? t("liveWebTipsDetail") : t("liveWebTipsDisabled")}</Text>
          </View>
          <Switch
            accessibilityRole="switch"
            accessibilityLabel={t("liveWebTips")}
            accessibilityState={{ checked: webIntelligenceEnabled, disabled: !webIntelligenceAvailable }}
            value={webIntelligenceEnabled && webIntelligenceAvailable}
            onValueChange={setWebIntelligenceEnabled}
            disabled={!webIntelligenceAvailable}
            trackColor={{ false: "#CBD5E1", true: "#A5B4FC" }}
            thumbColor={webIntelligenceEnabled && webIntelligenceAvailable ? "#4F46E5" : "#FFFFFF"}
          />
        </View>
        <Text style={styles.section}>{t("scanAndCleanup")}</Text>
        <View style={styles.panel}>
          <SettingRow icon="notifications-none" title={t("cleanupReminders")} detail={t("comingSoon")} control={<Switch accessibilityLabel={t("cleanupReminders")} value={false} disabled trackColor={{ false: "#E2E8F0", true: "#A5B4FC" }} />} />
          <SettingRow icon="tune" title={t("largeFileThreshold")} detail={`${largeFileThreshold} MB · ${t("tapToChange")}`} onPress={cycleThreshold} control={<MaterialIcons name="chevron-right" size={22} color="#94A3B8" />} />
          <SettingRow icon="timer" title={t("longScanTimeout")} detail={`${formatScanTimeout(scanTimeoutMs)} · ${t("tapToChange")}`} onPress={cycleTimeout} control={<MaterialIcons name="chevron-right" size={22} color="#94A3B8" />} />
          <SettingRow icon="history" title={t("scanHistory")} detail={t("scanHistoryDetail")} onPress={() => router.push("/history")} control={<MaterialIcons name="chevron-right" size={22} color="#94A3B8" />} />
          <SettingRow icon="monitor-heart" title={t("diagnostics")} detail={`${scanDiagnosticCounters.timeoutCount} · ${scanDiagnosticCounters.cancellationCount}`} onPress={() => router.push("/diagnostics")} control={<MaterialIcons name="chevron-right" size={22} color="#94A3B8" />} />
          <SettingRow icon="lock" title={t("protectedFiles")} detail={protectedCount ? t("filesKeptSafe", { count: protectedCount, noun: noun(protectedCount, "file", "files") }) : t("noneYet")} onPress={() => router.push("/protected")} control={<MaterialIcons name="chevron-right" size={22} color="#94A3B8" />} />
        </View>
        <Text style={styles.section}>{t("yourPlan")}</Text>
        <PressableScale accessibilityRole="button" accessibilityLabel={isPro ? t("openPremiumActive", { name: t("premiumName") }) : t("openPremium", { name: t("premiumName") })} onPress={() => router.push("/premium")} style={styles.premiumCard}>
          <View style={styles.premiumIcon}><MaterialIcons name="auto-awesome" size={23} color="#7C3AED" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{isPro ? t("premiumActive", { name: t("premiumName") }) : t("unlockPremium", { name: t("premiumName") })}</Text>
            <Text style={styles.muted}>{isPro ? t("premiumManageDetail") : t("premiumSubtitle")}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color="#94A3B8" />
        </PressableScale>
        <Text style={styles.section}>{t("about")}</Text>
        <View style={styles.panel}>
          <SettingRow icon="restore" title={isPro ? t("manageSubscription") : t("restorePurchases")} detail={isPro ? t("openStoreAccount") : t("checkStoreAccount")} onPress={() => router.push("/premium")} control={<MaterialIcons name="chevron-right" size={22} color="#94A3B8" />} />
          <SettingRow icon="shield" title={t("privacyPolicy")} detail={t("localFirstPrivacyBody")} onPress={openPrivacyPolicy} control={<MaterialIcons name="policy" size={18} color="#94A3B8" />} />
        </View>
        <Text style={styles.version}>{t("versionLine", { name: t("appName"), version: "1.0.0" })}</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

function SettingRow({ icon, title, detail, control, onPress }: { icon: string; title: string; detail: string; control: React.ReactNode; onPress?: () => void }) {
  return (
    <PressableScale haptic={Boolean(onPress)} accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={title + (detail ? `, ${detail}` : "")} accessibilityHint={onPress ? `Opens ${title.toLowerCase()}` : "This setting is not available yet"} accessibilityState={{ disabled: !onPress }} disabled={!onPress} onPress={onPress} style={styles.row}>
      <MaterialIcons name={icon as never} size={21} color="#64748B" />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {detail ? <Text style={styles.muted}>{detail}</Text> : null}
      </View>
      {control}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 36 },
  back: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 18 },
  backText: { color: "#475569", fontWeight: "700" },
  preferenceWarning: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#FFFBEB", borderRadius: 12, padding: 10, marginBottom: 14 },
  preferenceWarningText: { flex: 1, color: "#92400E", fontSize: 11, lineHeight: 16, fontWeight: "700" },
  warningCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFBEB", borderRadius: 14, padding: 12, marginBottom: 14 },
  noticeDismissButton: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  warningText: { flex: 1, color: "#92400E", fontSize: 12, lineHeight: 17, fontWeight: "700" },
  eyebrow: { color: "#64748B", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: "#111827", fontSize: 30, fontWeight: "800", marginTop: 6, marginBottom: 22 },
  localPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, backgroundColor: "#ECFDF5", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 12 },
  localPillText: { color: "#047857", fontSize: 11, fontWeight: "800" },
  localPillHint: { color: "#059669", fontSize: 10, marginLeft: 3 },
  motionPanel: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E5E7EB", padding: 13, marginTop: 10 },
  appearancePanel: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E5E7EB", padding: 13 },
  appearanceCopy: { flex: 1, marginRight: 10 },
  themeToggle: { flexDirection: "row", backgroundColor: "#F1F5F9", borderRadius: 12, padding: 3, gap: 3 },
  themeOption: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 7 },
  themeOptionActive: { backgroundColor: "#4F46E5" },
  themeOptionText: { color: "#64748B", fontSize: 11, fontWeight: "800" },
  themeOptionTextActive: { color: "#FFFFFF" },
  privacyCard: { flexDirection: "row", gap: 13, backgroundColor: "#ECFDF5", borderRadius: 18, padding: 16, alignItems: "flex-start" },
  webTipsPanel: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E5E7EB", padding: 13, marginTop: 10 },
  privacyIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  cardTitle: { color: "#111827", fontSize: 15, fontWeight: "800", marginBottom: 3 },
  muted: { color: "#64748B", fontSize: 12, lineHeight: 18 },
  section: { color: "#94A3B8", fontSize: 11, fontWeight: "800", letterSpacing: 1.1, marginTop: 26, marginBottom: 10 },
  panel: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  rowTitle: { color: "#334155", fontSize: 14, fontWeight: "700", marginBottom: 2 },
  premiumCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#F5F3FF", borderRadius: 18, padding: 15 },
  premiumIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", marginRight: 12 },
  version: { color: "#94A3B8", fontSize: 11, textAlign: "center", marginTop: 28 },
});
