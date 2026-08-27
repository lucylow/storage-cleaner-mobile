export type BillingPlan = "monthly" | "yearly";
export type PurchaseState = "idle" | "purchasing" | "restoring" | "active" | "unavailable";

export const billingPlans = {
  monthly: { label: "Monthly", price: "$2.99", cadence: "per month", detail: "Flexible, cancel anytime" },
  yearly: { label: "Yearly", price: "$19.99", cadence: "per year", detail: "Best value · save 44%" },
} as const;

export function getPlanDetails(plan: BillingPlan) {
  return billingPlans[plan];
}

export function getPurchaseButtonLabel(state: PurchaseState, plan: BillingPlan) {
  if (state === "purchasing") return "Opening secure checkout…";
  if (state === "restoring") return "Checking purchases…";
  if (state === "active") return "ClearSpace Pro is active";
  return `Continue with ${billingPlans[plan].label.toLowerCase()}`;
}

export function getPurchaseMessage(state: PurchaseState) {
  if (state === "active") return "Your plan is ready. Core scanning and safety controls remain available locally.";
  if (state === "unavailable") return "Purchases will be available in the native App Store and Google Play release build. No payment was made.";
  return "Payments are handled by the platform store. Your files and scan results never leave this device.";
}

export function canStartPurchase(state: PurchaseState) {
  return state === "idle" || state === "unavailable";
}

export function canRestorePurchase(state: PurchaseState) {
  return state !== "purchasing" && state !== "restoring";
}

export function getSavingsLabel(plan: BillingPlan) {
  return plan === "yearly" ? "Save 44%" : "";
}

export function getPlanFromParam(value: string | string[] | undefined): BillingPlan {
  return value === "monthly" ? "monthly" : "yearly";
}

export function getRestoreResult() {
  return { state: "unavailable" as const, message: "No store connection is configured in this preview build. Your account was not charged." };
}

export function getManageSubscriptionMessage() {
  return "Subscription management will open the App Store or Google Play account page in the native release build.";
}

export function getPurchaseResult() {
  return { state: "unavailable" as const, message: "Secure store checkout will be connected in the native release build. No payment was made." };
}

export type PremiumFeature = "similar-scans" | "smart-selection" | "priority-reports";

export function isPremiumFeatureAvailable(feature: PremiumFeature, isPro: boolean) {
  return isPro || feature === "smart-selection";
}

export function getPremiumPrompt(feature: PremiumFeature) {
  if (feature === "similar-scans") return "Go deeper with similar-image matching";
  if (feature === "priority-reports") return "Keep richer cleanup reports with Pro";
  return "Save time with smarter cleanup suggestions";
}

export function canShowUpgradePrompt(lastShownAt: number | null, dismissed: boolean, now: number, cooldownMs = 7 * 24 * 60 * 60 * 1000) {
  if (dismissed) return false;
  if (lastShownAt === null) return true;
  return now - lastShownAt >= cooldownMs;
}

export function getValueReminder() {
  return "Pro adds deeper review tools and richer reports. Essential scanning, protection, and safe cleanup remain free.";
}

export type UpgradeIntentState = "idle" | "confirming" | "ready";

export function getComparisonRows() {
  return [
    { label: "Local duplicate and large-file scanning", free: true, pro: true },
    { label: "Protected files and safe cleanup review", free: true, pro: true },
    { label: "Similar-image matching", free: false, pro: true },
    { label: "Priority reports and no ads", free: false, pro: true },
    { label: "Live web tips refresh", free: false, pro: true },
  ] as const;
}

export function getUpgradeIntentMessage(state: UpgradeIntentState) {
  if (state === "confirming") return "Review your plan before store checkout";
  if (state === "ready") return "Ready for secure platform checkout";
  return "No charge happens in this preview build";
}

export const premiumBenefits = [
  "Unlimited duplicate and similar-image scans",
  "Smart selection for faster cleanup",
  "No ads, ever",
  "Priority scan history and reports",
  "Live web tips refresh and extra daily searches",
] as const;

export const freeBenefits = [
  "Local duplicate and large-file scanning",
  "Protected files and safe cleanup review",
  "Permission-aware deletion safeguards",
  "One complimentary live web tip after you opt in",
] as const;

export type PremiumBenefit = (typeof premiumBenefits)[number];
export type FreeBenefit = (typeof freeBenefits)[number];

export function getFreePlanMessage() {
  return "Essential scanning, protection, review, and cleanup safety remain free.";
}
