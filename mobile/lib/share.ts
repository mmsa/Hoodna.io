import { Linking } from "react-native";

export function shareViaWhatsApp({ title, url }: { title: string; url: string }) {
  const text = encodeURIComponent(`${title}\n${url}`);
  return Linking.openURL(`https://wa.me/?text=${text}`);
}
