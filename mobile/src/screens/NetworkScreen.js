import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
} from "react-native";
import { Eye, EyeOff, Pencil, Check } from "lucide-react-native";
import { colors } from "../theme/colors";

export default function NetworkScreen({
  ssid = "",
  password = "",
  networkVisible = true,
  onSaveSsid,
  onSavePassword,
  onToggleVisible,
  readError = null,
}) {
  const [editingSsid, setEditingSsid] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [draftSsid, setDraftSsid] = useState(ssid);
  const [draftPassword, setDraftPassword] = useState(password);

  useEffect(() => {
    setDraftSsid(ssid);
  }, [ssid]);

  useEffect(() => {
    setDraftPassword(password);
  }, [password]);

  const saveSsid = () => {
    const value = draftSsid.trim();

    if (value && typeof onSaveSsid === "function") {
      onSaveSsid(value);
    }

    setEditingSsid(false);
  };

  const savePassword = () => {
    const value = draftPassword.trim();

    if (value && typeof onSavePassword === "function") {
      onSavePassword(value);
    }

    setEditingPassword(false);
  };

  const toggleVisible = (value) => {
    if (typeof onToggleVisible === "function") {
      onToggleVisible(value);
    }
  };

  return (
    <View>
      <Text style={styles.title}>Réseau wifi</Text>

      <Text style={styles.subtitle}>
        Le nom est synchronisé sur les deux bandes : le réseau parental reçoit le suffixe 5G. Les mots de passe restent indépendants.
      </Text>

      {readError ? <Text style={styles.readError}>{readError}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.label}>
          Nom du réseau (SSID)
        </Text>

        {editingSsid ? (
          <View style={styles.editRow}>
            <TextInput
              value={draftSsid}
              onChangeText={setDraftSsid}
              maxLength={30}
              autoCapitalize="none"
              style={styles.input}
              placeholder="Nom du réseau"
              placeholderTextColor={colors.muted}
            />

            <TouchableOpacity
              style={styles.iconButton}
              onPress={saveSsid}
              activeOpacity={0.7}
            >
              <Check size={15} color={colors.teal} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.editRow}>
            <Text style={styles.value} numberOfLines={1}>
              {ssid || "SSID inconnu"}
            </Text>

            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                setDraftSsid(ssid);
                setEditingSsid(true);
              }}
              activeOpacity={0.7}
            >
              <Pencil size={14} color={colors.muted} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>
          Mot de passe wifi
        </Text>

        {editingPassword ? (
          <View style={styles.editRow}>
            <TextInput
              value={draftPassword}
              onChangeText={setDraftPassword}
              maxLength={63}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              style={styles.input}
              placeholder="Mot de passe"
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
          <View style={styles.editRow}>
            <Text style={styles.value} numberOfLines={1}>
              {showPassword
                ? password
                : "•".repeat(Math.min(password.length || 0, 14))}
            </Text>

            <View style={styles.passwordActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() =>
                  setShowPassword((value) => !value)
                }
                activeOpacity={0.7}
              >
                {showPassword ? (
                  <EyeOff size={14} color={colors.muted} />
                ) : (
                  <Eye size={14} color={colors.muted} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => {
                  setDraftPassword(password);
                  setEditingPassword(true);
                }}
                activeOpacity={0.7}
              >
                <Pencil size={14} color={colors.muted} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={[styles.card, styles.visibilityRow]}>
        <View style={styles.visibilityText}>
          <Text style={styles.rowTitle}>
            {networkVisible
              ? "Réseau visible"
              : "Réseau masqué"}
          </Text>

          <Text style={styles.rowMeta}>
            {networkVisible
              ? "Visible dans les listes wifi"
              : "Connexion manuelle requise"}
          </Text>
        </View>

        <Switch
          value={!!networkVisible}
          onValueChange={toggleVisible}
          trackColor={{
            false: colors.line,
            true: colors.teal,
          }}
          thumbColor={colors.bg}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readError: { color: colors.coral, fontSize: 11, lineHeight: 16, marginBottom: 12 },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },

  subtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 20,
  },

  card: {
    backgroundColor: colors.cardAlt,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },

  label: {
    color: colors.muted,
    fontSize: 10,
    marginBottom: 6,
  },

  editRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  value: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
  },

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

  iconButton: {
    padding: 6,
  },

  passwordActions: {
    flexDirection: "row",
    alignItems: "center",
  },

  visibilityRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  visibilityText: {
    flex: 1,
  },

  rowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "500",
  },

  rowMeta: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
});
