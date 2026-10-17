import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from "react-native";
import { LifeBuoy, Phone, Mail } from "lucide-react-native";
import { colors } from "../theme/colors";

const SUPPORT_EMAIL = "rosnyekomie756@gmail.com";

// Affichés si le serveur ne fournit aucun contact (l'app pilote le routeur en local, sans serveur).
const DEFAULT_CONTACTS = [
  { label: "Assistance RTL Gabon", value: "202", description: "Numéro à joindre en cas de problème avec votre wifi" },
  { label: "Horaires du service client", value: "Lun–Sam, 8h–18h" },
];

function writeToSupport() {
  Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Assistance R secure")}`).catch(() =>
    Alert.alert("Écrivez-nous", `Aucune application de messagerie trouvée. Écrivez-nous sur ${SUPPORT_EMAIL}`)
  );
}

export default function SupportScreen({ contacts = [] }) {
  return (
    <View>
      <Text style={styles.title}>Assistance</Text>
      <Text style={styles.subtitle}>Besoin d'aide avec votre wifi ?</Text>

      <TouchableOpacity style={styles.card} onPress={writeToSupport} activeOpacity={0.7}>
        <View style={styles.iconCircle}>
          <Mail size={17} color={colors.teal} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Écrivez-nous sur</Text>
          <Text style={styles.value}>{SUPPORT_EMAIL}</Text>
          <Text style={styles.description}>Appuyez pour ouvrir votre messagerie</Text>
        </View>
      </TouchableOpacity>

      {(contacts && contacts.length ? contacts : DEFAULT_CONTACTS).map((c, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.iconCircle}>
            {c.label.toLowerCase().includes("horaire") ? (
              <LifeBuoy size={17} color={colors.teal} />
            ) : (
              <Phone size={17} color={colors.teal} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{c.label}</Text>
            <Text style={styles.value}>{c.value}</Text>
            {c.description && <Text style={styles.description}>{c.description}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 20, fontWeight: "700" },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2, marginBottom: 20 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.cardAlt,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.tealDim,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { color: colors.muted, fontSize: 11 },
  value: { color: colors.text, fontSize: 16, fontWeight: "700", marginTop: 2 },
  description: { color: colors.muted, fontSize: 11, marginTop: 2 },
});
