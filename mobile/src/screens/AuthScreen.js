import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { colors } from "../theme/colors";
import { loginClient, registerClient } from "../api/auth";

export default function AuthScreen({ onAuthenticated }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [licenseCode, setLicenseCode] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!phone.trim() || !password) {
      Alert.alert("Champs requis", "Saisis ton numéro et ton mot de passe.");
      return;
    }

    if (isRegister && !name.trim()) {
      Alert.alert("Nom requis", "Saisis ton nom pour créer ton compte.");
      return;
    }

    if (isRegister && !licenseCode.trim()) {
      Alert.alert("Code requis", "Saisis ton code d’activation.");
      return;
    }

    if (isRegister && password.length < 8) {
      Alert.alert("Mot de passe trop court", "Choisis un mot de passe d’au moins 8 caractères.");
      return;
    }

    if (isRegister && phone.replace(/\D/g, "").length < 7) {
      Alert.alert("Numéro invalide", "Vérifie ton numéro de téléphone.");
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        await registerClient(
          name.trim(), phone.trim(), password, licenseCode.trim()
        );
      } else {
        await loginClient(phone.trim(), password);
      }

      onAuthenticated?.();
    } catch (error) {
      Alert.alert(
        isRegister ? "Inscription impossible" : "Connexion impossible",
        error?.message || "Vérifie les informations et le serveur."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logo}>
          <Text style={styles.logoText}>R</Text>
        </View>

        <Text style={styles.title}>R Secure</Text>
        <Text style={styles.subtitle}>
          {isRegister
            ? "Crée ton compte avec ton code d’activation"
            : "Connecte-toi à ton compte"}
        </Text>

        <View style={styles.card}>
          {isRegister && (
            <>
              <Text style={styles.label}>Nom complet</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ton nom"
                placeholderTextColor={colors.muted}
                autoCapitalize="words"
                style={styles.input}
              />
            </>
          )}

          {isRegister && (
            <>
              <Text style={styles.label}>Code d’activation</Text>
              <TextInput
                value={licenseCode}
                onChangeText={setLicenseCode}
                placeholder="Saisis ton code"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.input}
              />
            </>
          )}

          <Text style={styles.label}>Numéro de téléphone</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Ex. : 077..."
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Ton mot de passe"
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />
          {isRegister && <Text style={styles.hint}>8 caractères minimum.</Text>}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={submit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.buttonText}>
                {isRegister ? "Créer mon compte" : "Se connecter"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setIsRegister(!isRegister)}
            disabled={loading}
          >
            <Text style={styles.switchText}>
              {isRegister
                ? "J’ai déjà un compte — Se connecter"
                : "Nouveau sur R Secure ? Créer un compte"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>R Secure · Gestion de connexion</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  logo: {
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoText: {
    fontSize: 44,
    fontWeight: "900",
    color: colors.bg,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 28,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 20,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 8,
  },
  hint: { color: colors.muted, fontSize: 11, marginBottom: 10, marginTop: -4 },
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    marginBottom: 10,
  },
  button: {
    backgroundColor: colors.teal,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 14,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: colors.bg,
    fontWeight: "800",
    fontSize: 16,
  },
  switchButton: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 4,
  },
  switchText: {
    color: colors.teal,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
  },
  footer: {
    color: colors.muted,
    textAlign: "center",
    marginTop: 24,
    fontSize: 12,
  },
});
