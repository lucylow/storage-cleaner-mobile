import { Href, Link } from "expo-router";
import { openBrowserAsync, WebBrowserPresentationStyle } from "expo-web-browser";
import { Alert } from "react-native";
import { type ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: Href & string };

export function ExternalLink({ href, ...rest }: Props) {
  return (
    <Link
      target="_blank"
      accessibilityRole="link"
      accessibilityHint="Opens this link in a browser"
      {...rest}
      href={href}
      onPress={async (event) => {
        if (process.env.EXPO_OS !== "web") {
          // Prevent the default behavior of linking to the default browser on native.
          event.preventDefault();
          // Open the link in an in-app browser.
          try {
            await openBrowserAsync(href, {
              presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
            });
          } catch {
            Alert.alert("Could not open link", "The link could not be opened right now. Please try again later.");
          }
        }
      }}
    />
  );
}
