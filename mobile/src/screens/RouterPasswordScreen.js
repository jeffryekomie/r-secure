import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { colors } from "../theme/colors";

// Demande le mot de passe d'administration du routeur (celui de son interface 192.168.1.1).
export default function RouterPasswordScreen({ onSubmit, onCancel }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!value) {
      setError("Saisissez le mot de passe admin du routeur.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSubmit(value);
    } catch (e) {
      setError(e?.message || "Impossible de vérifier le mot de passe.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Mot de passe du routeur</Text>
      <Text style={styles.text}>
        Pour piloter votre routeur, l'application a besoin de son mot de passe d'administration
        (celui demandé quand vous ouvrez 192.168.1.1, souvent écrit sous le routeur).
        Votre téléphone doit être connecté au wifi du routeur.
      </Text>

      <TextInput
        value={value}
        onChangeText={setValue}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Mot de passe admin du routeur"
        placeholderTextColor={colors.muted}
        style={styles.input}
        onSubmitEditing={submit}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={submit} disabled={busy} activeOpacity={0.8}>
        {busy ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text style={styles.buttonText}>Valider</Text>
        )}
      </TouchableOpacity>

      {onCancel ? (
        <TouchableOpacity onPress={onCancel} style={styles.cancel}>
          <Text style={styles.cancelText}>Annuler</Text>
        </TouchableOpacity>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 22, fontWeight: "700", marginBottom: 12 },
  text: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 20 },
  input: {
    backgroundColor: colors.cardAlt,
    color: colors.text,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  error: { color: colors.coral, fontSize: 12, marginTop: 10 },
  button: {
    marginTop: 18,
    backgroundColor: colors.teal,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: colors.bg, fontSize: 15, fontWeight: "700" },
  cancel: { marginTop: 14, alignItems: "center" },
  cancelText: { color: colors.muted, fontSize: 13 },
});
