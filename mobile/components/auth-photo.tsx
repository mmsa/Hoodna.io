import { ImageBackground, StyleSheet, Text, View } from "react-native";
import { BrandWordmark } from "@/components/BrandWordmark";

export function AuthPhoto({
  source,
  title,
  subtitle,
}: {
  source: number;
  title?: string;
  subtitle?: string;
}) {
  return (
    <ImageBackground source={source} style={styles.photo} imageStyle={styles.image}>
      <View style={styles.scrim} />
      <View style={styles.copy}>
        <BrandWordmark tone="light" />
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  photo: { height: 220, justifyContent: "flex-end" },
  image: { resizeMode: "cover" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(16,33,30,0.45)" },
  copy: { padding: 20 },
  title: { color: "#FFFFFF", fontSize: 28, fontWeight: "700", marginTop: 12 },
  subtitle: { color: "rgba(255,255,255,0.88)", fontSize: 15, lineHeight: 22, marginTop: 6 },
});
