import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (__DEV__) console.error("Storage Cleaner render error", error);
  }

  private reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View accessible accessibilityRole="alert" accessibilityLiveRegion="assertive" accessibilityLabel="This screen needs a refresh. Your local files were not changed. Try loading this screen again." style={styles.container}>
        <View style={styles.icon}><Text style={styles.iconText}>!</Text></View>
        <Text style={styles.title}>This screen needs a refresh</Text>
        <Text style={styles.message}>Your local files were not changed. Try loading this screen again.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Try loading this screen again" accessibilityHint="Reloads the current screen without changing local files" accessibilityState={{ disabled: false }} onPress={this.reset} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#F6F7FB" },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: "#FEF3C7", marginBottom: 18 },
  iconText: { color: "#B45309", fontSize: 28, fontWeight: "800" },
  title: { color: "#111827", fontSize: 22, fontWeight: "800", textAlign: "center" },
  message: { color: "#64748B", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 10, maxWidth: 320 },
  button: { backgroundColor: "#111827", borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14, marginTop: 24 },
  pressed: { opacity: 0.8 },
  buttonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
});
