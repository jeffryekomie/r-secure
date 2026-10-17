import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { colors } from "../theme/colors";

// Compte : changer le mot de passe du routeur, se déconnecter.
export default function AccountSection({ onChangeRouterPassword, onLogout }) {
  const confirmLogout = () =>
    Alert.alert(
      "Se déconnecter ?",
      "Vous devrez vous reconnecter avec votre numéro et votre mot de passe.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Se déconnecter", style: "destructive", onPress: onLogout },
      ]
    );

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Compte</Text>

      <TouchableOpacity style={styles.row} onPress={onChangeRouterPassword} activeOpacity={0.7}>
        <Text style={styles.rowText}>Mot de passe du routeur</Text>
        <Text style={styles.rowHint}>Modifier</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={confirmLogout} activeOpacity={0.7}>
        <Text style={[styles.rowText, { color: colors.coral }]}>Se déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 24 },
  heading: { color: colors.muted, fontSize: 11, marginBottom: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.cardAlt,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  rowText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  rowHint: { color: colors.muted, fontSize: 12 },
});
