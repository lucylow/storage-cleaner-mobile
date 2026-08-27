import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useTranslation } from "@/lib/locale-provider";
export default function TabLayout() { const colors = useColors(); const { t } = useTranslation(); const insets = useSafeAreaInsets(); const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8); return <Tabs screenOptions={{ tabBarActiveTintColor: colors.tint, headerShown: false, tabBarButton: HapticTab, tabBarStyle: { paddingTop: 8, paddingBottom: bottomPadding, height: 58 + bottomPadding, backgroundColor: colors.background, borderTopColor: colors.border, borderTopWidth: 0.5, elevation: 8, shadowColor: "#0F172A", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } }, tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 2 } }}><Tabs.Screen name="index" options={{ title: t("tabHome"), tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} /> }} /><Tabs.Screen name="results" options={{ title: t("tabResults"), tabBarIcon: ({ color }) => <IconSymbol size={26} name="chart.bar.fill" color={color} /> }} /><Tabs.Screen name="settings" options={{ title: t("tabSettings"), tabBarIcon: ({ color }) => <IconSymbol size={26} name="gearshape.fill" color={color} /> }} /></Tabs>; }
