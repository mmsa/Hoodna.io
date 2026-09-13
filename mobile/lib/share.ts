import { Linking } from "react-native";
import { SHARE_UTM, withUtmParams } from "@hoodna/shared";

export function shareViaWhatsApp({ title, url }: { title: string; url: string }) {
  const tracked = withUtmParams(url, SHARE_UTM.whatsappListing);
  const text = encodeURIComponent(`${title}\n${tracked}`);
  return Linking.openURL(`https://wa.me/?text=${text}`);
}
