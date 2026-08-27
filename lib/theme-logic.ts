export type ColorSchemePreference = "light" | "dark";

export type ThemePreferences = {
  colorScheme: ColorSchemePreference;
  reducedMotion: boolean;
};

export function getThemePreferenceRecoveryMessage() {
  return "Appearance preferences could not be saved locally. Your files were not affected.";
}

export function mergeThemePreferences(
  current: ThemePreferences,
  patch: Partial<ThemePreferences>,
): ThemePreferences {
  return {
    colorScheme: patch.colorScheme ?? current.colorScheme,
    reducedMotion: patch.reducedMotion ?? current.reducedMotion,
  };
}

export function resolveThemePreferences(
  value: Partial<ThemePreferences> | null | undefined,
  fallbackScheme: ColorSchemePreference,
): ThemePreferences {
  const colorScheme = value?.colorScheme === "light" || value?.colorScheme === "dark" ? value.colorScheme : fallbackScheme;
  return {
    colorScheme,
    reducedMotion: value?.reducedMotion === true,
  };
}

export function enqueuePreferenceWrite(
  queue: Promise<unknown>,
  value: string,
  write: (value: string) => Promise<void>,
) {
  return queue.catch(() => undefined).then(() => write(value).catch(() => undefined));
}
