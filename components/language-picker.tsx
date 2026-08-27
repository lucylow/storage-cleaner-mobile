import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LOCALE_META, SUPPORTED_LOCALES, useTranslation } from "@/lib/locale-provider";
import type { LocalePreference } from "@/lib/i18n/locale-logic";

const OPTIONS: LocalePreference[] = ["system", ...SUPPORTED_LOCALES];

export function LanguagePicker() {
  const { t, locale, preference, setPreference } = useTranslation();
  const currentName = LOCALE_META[locale].nativeName;

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={t("currentLanguageA11y", { name: currentName })}
      style={styles.panel}
    >
      <View style={styles.header}>
        <MaterialIcons name="translate" size={20} color="#4F46E5" />
        <View style={styles.copy}>
          <Text style={styles.title}>{t("languageTitle")}</Text>
          <Text style={styles.hint}>{t("languageHint")}</Text>
        </View>
      </View>
      <View style={styles.options}>
        {OPTIONS.map((option) => {
          const selected = preference === option;
          const label = option === "system" ? t("languageSystem") : LOCALE_META[option].nativeName;
          const detail = option === "system" ? t("languageSystemDetail") : LOCALE_META[option].englishName;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={`${label}, ${detail}`}
              accessibilityState={{ selected }}
              onPress={() => setPreference(option)}
              style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
            >
              <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
              <Text style={[styles.optionDetail, selected && styles.optionDetailSelected]}>{detail}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 13,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  copy: { flex: 1 },
  title: { color: "#111827", fontSize: 14, fontWeight: "800" },
  hint: { color: "#64748B", fontSize: 11, lineHeight: 16, marginTop: 3 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    minWidth: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  optionSelected: { backgroundColor: "#EEF2FF", borderColor: "#4F46E5" },
  optionLabel: { color: "#334155", fontSize: 12, fontWeight: "800" },
  optionLabelSelected: { color: "#312E81" },
  optionDetail: { color: "#94A3B8", fontSize: 10, marginTop: 2 },
  optionDetailSelected: { color: "#6366F1" },
  pressed: { opacity: 0.78 },
});
