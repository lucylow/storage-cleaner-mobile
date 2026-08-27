import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { SESSION_TOKEN_KEY, USER_INFO_KEY } from "@/constants/oauth";

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: Date;
};

export async function getSessionToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return null;
    return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setSessionToken(token: string): Promise<void> {
  try {
    if (Platform.OS === "web") return;
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
  } catch {
    throw new Error("Unable to save the local session securely.");
  }
}

export async function removeSessionToken(): Promise<void> {
  try {
    if (Platform.OS === "web") return;
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  } catch {
    // Logout remains best-effort; callers should not receive secure-store internals.
  }
}

export async function getUserInfo(): Promise<User | null> {
  try {
    let info: string | null = null;
    if (Platform.OS === "web") info = window.localStorage.getItem(USER_INFO_KEY);
    else info = await SecureStore.getItemAsync(USER_INFO_KEY);
    if (!info) return null;
    const parsed = JSON.parse(info) as Partial<User>;
    if (typeof parsed.id !== "number" || typeof parsed.openId !== "string") return null;
    return parsed as User;
  } catch {
    return null;
  }
}

export async function setUserInfo(user: User): Promise<void> {
  try {
    const serialized = JSON.stringify(user);
    if (Platform.OS === "web") window.localStorage.setItem(USER_INFO_KEY, serialized);
    else await SecureStore.setItemAsync(USER_INFO_KEY, serialized);
  } catch {
    // Local auth hydration remains safe if storage is unavailable.
  }
}

export async function clearUserInfo(): Promise<void> {
  try {
    if (Platform.OS === "web") window.localStorage.removeItem(USER_INFO_KEY);
    else await SecureStore.deleteItemAsync(USER_INFO_KEY);
  } catch {
    // Clearing local user information is best-effort and privacy-safe.
  }
}
