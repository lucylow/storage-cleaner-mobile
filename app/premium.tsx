import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { billingPlans, canRestorePurchase, canStartPurchase, freeBenefits, getComparisonRows, getFreePlanMessage, getManageSubscriptionMessage, getPlanDetails, getPurchaseButtonLabel, getPurchaseMessage, getPurchaseResult, getRestoreResult, getSavingsLabel, getUpgradeIntentMessage, premiumBenefits, type BillingPlan, type PurchaseState, type UpgradeIntentState } from "@/lib/monetization-logic";
import { usePremium } from "@/lib/premium-store";

export default function PremiumScreen() {
  const { isPro } = usePremium();
  const [plan, setPlan] = useState<BillingPlan>("yearly");
  const [state, setState] = useState<PurchaseState>("idle");
  const [intent, setIntent] = useState<UpgradeIntentState>("idle");
  const [message, setMessage] = useState(getPurchaseMessage(isPro ? "active" : "idle"));
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  useEffect(() => () => { mountedRef.current = false; }, []);
  const displayState: PurchaseState = isPro ? "active" : state;
  const selectedPlan = getPlanDetails(plan);
  const busy = state === "purchasing" || state === "restoring";
  const manageSubscription = () => setMessage(getManageSubscriptionMessage());

  const startPurchase = async () => {
    if (intent === "idle") {
      setIntent("confirming");
      setMessage(getUpgradeIntentMessage("confirming"));
      return;
    }
    if (!canStartPurchase(state)) return;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setIntent("ready");
    setState("purchasing");
    setMessage(getPurchaseMessage("purchasing"));
    try {
      await new Promise((resolve) => setTimeout(resolve, 350));
      const result = getPurchaseResult();
      if (!mountedRef.current || requestRef.current !== requestId) return;
      setState(result.state);
      setMessage(result.message);
    } catch {
      if (!mountedRef.current || requestRef.current !== requestId) return;
      setState("unavailable");
      setMessage("Purchase could not be completed. No charge was confirmed; please try again later.");
    }
  };

  const restore = async () => {
    if (!canRestorePurchase(state) || busy || !mountedRef.current) return;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setState("restoring");
    setMessage(getPurchaseMessage("restoring"));
    try {
      await new Promise((resolve) => setTimeout(resolve, 350));
      const result = getRestoreResult();
      if (!mountedRef.current || requestRef.current !== requestId) return;
      setState(result.state);
      setMessage(result.message);
    } catch {
      if (!mountedRef.current || requestRef.current !== requestId) return;
      setState("unavailable");
      setMessage("Purchases could not be restored. Your current access was not changed.");
    }
  };

  return <ScreenContainer className="px-5 pt-3" edges={["top", "bottom", "left", "right"]}><Pressable accessibilityRole="button" accessibilityLabel="Close ClearSpace Pro" onPress={() => router.back()} style={styles.back}><MaterialIcons name="close" size={24} color="#111827" /></Pressable><View style={styles.hero}><View style={styles.icon}><MaterialIcons name="auto-awesome" size={30} color="#7C3AED" /></View><Text style={styles.eyebrow}>CLEARSPACE PRO</Text>{isPro ? <View accessible accessibilityRole="text" accessibilityLabel="ClearSpace Pro is active." style={styles.activeBadge}><MaterialIcons name="verified" size={15} color="#047857" /><Text style={styles.activeBadgeText}>PRO ACTIVE</Text></View> : null}<Text style={styles.title}>More clarity, without compromising privacy.</Text><Text accessibilityRole="text" accessibilityLabel="Premium speeds up review and removes distractions. Files are still scanned, analyzed, and cleaned locally." style={styles.subtitle}>Premium speeds up review and removes distractions. Your files are still scanned, analyzed, and cleaned locally.</Text></View><View style={styles.compareCard}><Text style={styles.compareTitle}>Compare plans</Text><View style={styles.compareHeader}><Text style={styles.compareHeaderLabel}>Included</Text><Text style={styles.compareHeaderValue}>Free</Text><Text style={styles.compareHeaderValue}>Pro</Text></View>{getComparisonRows().map((row) => <View key={row.label} style={styles.compareRow}><Text style={styles.compareLabel}>{row.label}</Text><MaterialIcons name={row.free ? "check" : "remove"} size={17} color={row.free ? "#10B981" : "#CBD5E1"} /><MaterialIcons name={row.pro ? "check" : "remove"} size={17} color={row.pro ? "#7C3AED" : "#CBD5E1"} /></View>)}</View><View style={styles.freeCard}><View style={styles.sectionHeading}><MaterialIcons name="shield" size={19} color="#047857" /><Text style={styles.sectionTitle}>Included for everyone</Text></View><Text style={styles.sectionSub}>{getFreePlanMessage()}</Text>{freeBenefits.map((benefit) => <Benefit key={benefit} text={benefit} color="#10B981" />)}</View><View style={styles.proCard}><View style={styles.sectionHeading}><MaterialIcons name="auto-awesome" size={19} color="#7C3AED" /><Text style={styles.sectionTitle}>ClearSpace Pro</Text></View>{premiumBenefits.map((benefit) => <Benefit key={benefit} text={benefit} color="#7C3AED" />)}</View><View style={styles.planRow}>{(Object.keys(billingPlans) as BillingPlan[]).map((candidate) => { const details = billingPlans[candidate]; const selected = candidate === plan; return <Pressable key={candidate} accessibilityRole="radio" accessibilityLabel={`${details.label} plan, ${details.price}, ${details.cadence}. ${details.detail}`} accessibilityState={{ selected, disabled: busy }} onPress={() => setPlan(candidate)} disabled={busy} style={[styles.plan, selected && styles.planSelected]}><View><Text style={styles.planTitle}>{details.label}</Text><Text style={styles.planSub}>{details.detail}</Text></View><View style={styles.price}><Text style={styles.priceValue}>{details.price}</Text><Text style={styles.priceSub}>{details.cadence}</Text></View>{candidate === "yearly" ? <Text style={styles.saveBadge}>{getSavingsLabel(candidate)}</Text> : null}</Pressable>; })}</View><Pressable accessibilityRole="button" accessibilityLabel={intent === "confirming" ? `Confirm ${selectedPlan.label} plan` : getPurchaseButtonLabel(displayState, plan)} accessibilityState={{ disabled: busy || displayState === "active", busy }} onPress={startPurchase} disabled={busy || displayState === "active"} style={({ pressed }) => [styles.button, (busy || state === "active") && styles.disabledButton, pressed && !busy && styles.pressed]}><Text style={styles.buttonText}>{intent === "confirming" ? `Confirm ${selectedPlan.label.toLowerCase()} plan` : getPurchaseButtonLabel(displayState, plan)}</Text>{state === "active" ? <MaterialIcons name="check" size={20} color="#FFF" /> : <MaterialIcons name="arrow-forward" size={20} color="#FFF" />}</Pressable><Pressable accessibilityRole="button" accessibilityLabel={state === "restoring" ? "Restoring purchases" : "Restore purchases"} accessibilityState={{ disabled: !canRestorePurchase(state) || busy, busy: state === "restoring" }} onPress={restore} disabled={!canRestorePurchase(state) || busy} style={styles.restoreButton}><MaterialIcons name="restore" size={18} color="#4F46E5" /><Text style={styles.restoreText}>Restore purchases</Text></Pressable>{isPro ? <Pressable accessibilityRole="button" accessibilityLabel="Manage subscription" onPress={manageSubscription} style={styles.manageButton}><MaterialIcons name="open-in-new" size={17} color="#4F46E5" /><Text style={styles.restoreText}>Manage subscription</Text></Pressable> : null}<Text accessibilityRole="text" accessibilityLiveRegion="polite" accessibilityLabel={message} style={styles.status}>{message}</Text><Text style={styles.legal}>Subscriptions are billed by the platform store. Manage or cancel them in your App Store or Google Play account.</Text></ScreenContainer>;
}

function Benefit({ text, color }: { text: string; color: string }) { return <View style={styles.feature}><MaterialIcons name="check-circle" size={18} color={color} /><Text style={styles.featureText}>{text}</Text></View>; }

const styles = StyleSheet.create({ back: { alignSelf: "flex-end", padding: 5 }, hero: { alignItems: "center", marginTop: 8 }, icon: { width: 68, height: 68, borderRadius: 22, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center", marginBottom: 16 }, activeBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#D1FAE5", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, marginBottom: 4 }, activeBadgeText: { color: "#047857", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }, eyebrow: { color: "#7C3AED", fontSize: 11, fontWeight: "800", letterSpacing: 1.3 }, title: { color: "#111827", fontSize: 27, fontWeight: "800", lineHeight: 33, textAlign: "center", marginTop: 8 }, subtitle: { color: "#64748B", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 9, maxWidth: 320 }, freeCard: { backgroundColor: "#ECFDF5", borderRadius: 18, padding: 15, marginTop: 20, gap: 9 }, compareCard: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E5E7EB", padding: 14, marginTop: 18 }, compareTitle: { color: "#111827", fontSize: 14, fontWeight: "800", marginBottom: 10 }, compareHeader: { flexDirection: "row", alignItems: "center", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }, compareHeaderLabel: { flex: 1, color: "#94A3B8", fontSize: 10, fontWeight: "800", textTransform: "uppercase" }, compareHeaderValue: { width: 42, color: "#64748B", textAlign: "center", fontSize: 10, fontWeight: "800" }, compareRow: { flexDirection: "row", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#F8FAFC" }, compareLabel: { flex: 1, color: "#334155", fontSize: 11, lineHeight: 15 }, proCard: { backgroundColor: "#F5F3FF", borderRadius: 18, padding: 15, marginTop: 10, gap: 9 }, sectionHeading: { flexDirection: "row", alignItems: "center", gap: 8 }, sectionTitle: { color: "#111827", fontSize: 14, fontWeight: "800" }, sectionSub: { color: "#047857", fontSize: 12, lineHeight: 17 }, feature: { flexDirection: "row", alignItems: "center", gap: 9 }, featureText: { color: "#334155", fontSize: 12, fontWeight: "700", flex: 1 }, planRow: { gap: 9, marginTop: 14 }, plan: { position: "relative", flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 16, padding: 14, backgroundColor: "#FFFFFF" }, planSelected: { borderWidth: 2, borderColor: "#4F46E5", backgroundColor: "#EEF2FF" }, planTitle: { color: "#111827", fontSize: 14, fontWeight: "800" }, planSub: { color: "#4F46E5", fontSize: 11, fontWeight: "700", marginTop: 3 }, price: { alignItems: "flex-end", marginRight: 4 }, priceValue: { color: "#111827", fontSize: 18, fontWeight: "800" }, priceSub: { color: "#64748B", fontSize: 10 }, saveBadge: { position: "absolute", top: -9, right: 12, color: "#FFFFFF", backgroundColor: "#4F46E5", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: "800" }, button: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, backgroundColor: "#111827", borderRadius: 16, paddingVertical: 16, marginTop: 14 }, disabledButton: { backgroundColor: "#94A3B8" }, buttonText: { color: "#FFF", fontSize: 14, fontWeight: "800" }, restoreButton: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7, paddingVertical: 12 }, restoreText: { color: "#4F46E5", fontSize: 13, fontWeight: "800" }, manageButton: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7, paddingVertical: 9 }, status: { color: "#64748B", textAlign: "center", fontSize: 11, lineHeight: 16, marginTop: 4 }, legal: { color: "#94A3B8", textAlign: "center", fontSize: 10, lineHeight: 15, marginTop: 8, marginBottom: 8 }, pressed: { opacity: 0.8 }, } );
