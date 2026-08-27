import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export async function playImpact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS === "web") return;
  try {
    await Haptics.impactAsync(style);
  } catch {
    /* haptics are optional */
  }
}

export async function playSelection() {
  if (Platform.OS === "web") return;
  try {
    await Haptics.selectionAsync();
  } catch {
    /* haptics are optional */
  }
}

export async function playSuccess() {
  if (Platform.OS === "web") return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    /* haptics are optional */
  }
}
