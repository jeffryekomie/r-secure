import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Eye, EyeOff, Pencil, Check } from "lucide-react-native";
import { colors } from "../theme/colors";

// Format standard des QR codes Wi-Fi.
const esc = (v) => String(v).replace(/([\\;,:"])/g, "\\$1");

export default function ParentalScreen({
  ssid = "",
  password = "",
  hidden = false,
  onSavePassword,
}) {
  const [show, setShow] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [draftPassword, setDraftPassword] = useState(password);

  useEffect(() => {
    setDraftPassword(password);
  }, [password]);

  const ready = ssid.length > 0 && password.length > 0;
  const payload =
    "WIFI:T:WPA;S:" + esc(ssid) +
    ";P:" + esc(password) +
    ";H:" + (hidden ? "true" : "false") + ";;";

  const savePassword = () => {
    const value = draftPassword.trim();
    if (value && typeof onSavePassword === "function") {
      onSavePassword(value);
    }
    setEditingPassword(false);
  };

  return (
    <View>
      <Text style={styles.title}>Connexion parentale</Text>
      <Text style={styles.subtitle}>Réseau 5 GHz réservé aux parents</Text>

      {ready ? (
        <View style={styles.qrWrap}>
          <View style={styles.qrBox}>
            <QRCode value={payload} size={220} />
          </View>
          <Text style={styles.help}>
            Scannez ce code avec l'appareil photo du téléphone pour vous connecter.
          </Text>
        </View>
      ) : (
        <Text style={styles.empty}>
          Réseau 5 GHz introuvable. Vérifiez la connexion au routeur.
        </Text>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>Nom du réseau parental</Text>
        <Text style={styles.value}>{ssid || "-"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Mot de passe parental</Text>

        {editingPassword ? (
          <View style={styles.row}>
            <TextInput
              value={draftPassword}
              onChangeText={setDraftPassword}
              maxLength={63}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              style={styles.input}
              placeholder="Nouveau mot de passe"
              placeholderTextColor={colors.muted}
            />
            <TouchableOpacity
              style={styles.iconButton}
              onPress={savePassword}
              activeOpacity={0.7}
            >
              <Check size={15} color={colors.teal} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.row}>
            <Text style={styles.value}>
              {show ? password : "•".repeat(Math.min(password.length, 14))}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setShow((s) => !s)}
              >
                {show
                  ? <EyeOff size={14} color={colors.muted} />
                  : <Eye size={14} color={colors.muted} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => {
                  setDraftPassword(password);
                  setEditingPassword(true);
                }}
              >
                <Pencil size={14} color={colors.muted} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <Text style={styles.note}>
        Ce réseau reste actif quand le Wi-Fi principal est coupé. Il{" "}
        {hidden
          ? "est caché : saisissez son nom à la main ou scannez le code."
          : "apparaît dans la liste des réseaux Wi-Fi."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 20, fontWeight: "700" },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2, marginBottom: 20 },
  qrWrap: { alignItems: "center", marginBottom: 20 },
  qrBox: { backgroundColor: "#FFFFFF", padding: 16, borderRadius: 16 },
  help: { color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 12 },
  card: { backgroundColor: colors.cardAlt, borderRadius: 16, padding: 14, marginBottom: 10 },
  label: { color: colors.muted, fontSize: 10, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  value: { color: colors.text, fontSize: 14, flex: 1 },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  actions: { flexDirection: "row", alignItems: "center" },
  iconButton: { padding: 6 },
  note: { color: colors.muted, fontSize: 11, marginTop: 8 },
  empty: { color: colors.muted, fontSize: 12, textAlign: "center", marginVertical: 30 },
});
