import * as MediaLibrary from "expo-media-library";
import { Linking, Platform } from "react-native";
import { aggregateDeletionResult, type DeletionResult } from "./deletion-logic";
export type { DeletionResult } from "./deletion-logic";

type DeletionItem = { id: string };
export type PermissionRecovery = "granted" | "requested-denied" | "open-settings" | "unsupported";

export async function recoverMediaPermission(): Promise<PermissionRecovery> {
  if (Platform.OS === "web") return "unsupported";
  try {
    const current = await MediaLibrary.getPermissionsAsync();
    if (current.granted) return "granted";
    if (current.canAskAgain) {
      const requested = await MediaLibrary.requestPermissionsAsync();
      return requested.granted ? "granted" : "requested-denied";
    }
    await Linking.openSettings();
    return "open-settings";
  } catch {
    return "unsupported";
  }
}



export async function deleteNativeMedia(items: DeletionItem[]): Promise<DeletionResult> {
  if (Platform.OS === "web") return { mode: "fallback", status: "unsupported", requested: items.length, deleted: 0 };
  if (!items.length) return { mode: "native", status: "deleted", requested: 0, deleted: 0 };
  try {
    const permission = await MediaLibrary.getPermissionsAsync();
    if (!permission.granted) return { mode: "native", status: "permission-denied", requested: items.length, deleted: 0 };
    const deleted = await MediaLibrary.deleteAssetsAsync(items.map((item) => item.id));
    return deleted ? aggregateDeletionResult(items.length, items.length, "native") : { mode: "native", status: "failed", requested: items.length, deleted: 0 };
  } catch {
    return { mode: "native", status: "failed", requested: items.length, deleted: 0 };
  }
}
