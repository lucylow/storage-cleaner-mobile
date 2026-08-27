import { Platform } from "react-native";
import type { BillingPlan } from "./monetization-logic";

export type PurchaseResult = {
  state: "active" | "unavailable" | "failed";
  message: string;
};

export type RestoreResult = {
  state: "active" | "unavailable" | "failed";
  message: string;
};

export interface BillingProvider {
  purchase(plan: BillingPlan): Promise<PurchaseResult>;
  restore(): Promise<RestoreResult>;
  manageSubscription(): Promise<void>;
}

class UnavailableBillingProvider implements BillingProvider {
  async purchase(plan: BillingPlan): Promise<PurchaseResult> {
    return {
      state: "unavailable",
      message: `Store checkout for ${plan} is unavailable in this preview build. No payment was made.`,
    };
  }

  async restore(): Promise<RestoreResult> {
    return {
      state: "unavailable",
      message: "Store restore is unavailable in this preview build. No account changes were made.",
    };
  }

  async manageSubscription(): Promise<void> {
    return;
  }
}

class DevelopmentBillingProvider extends UnavailableBillingProvider {}

export function createBillingProvider(): BillingProvider {
  if (__DEV__) return new DevelopmentBillingProvider();
  if (Platform.OS === "ios" || Platform.OS === "android") {
    return new UnavailableBillingProvider();
  }
  return new UnavailableBillingProvider();
}
