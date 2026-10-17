import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { colors } from "../theme/colors";
import { getReferralSummary } from "../api/referral";

const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:4000"
).replace(/\/$/, "");

const money = (value) =>
  `${Number(value || 0).toLocaleString("fr-FR")} FCFA`;

export default function ReferralScreen() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const data = await getReferralSummary();
      setSummary(data);
    } catch (e) {
      setError(e.message || "Impossible de charger le parrainage.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shareReferral = async () => {
    if (!summary?.code) {
      Alert.alert("Parrainage", "Aucun code disponible pour le moment.");
      return;
    }

    const link =
      `${API_URL}/payments/buy?ref=${encodeURIComponent(summary.code)}`;

    try {
      await Share.share({
        message:
          `Découvre R Secure avec mon code de parrainage : ${summary.code}\n\n` +
          `Inscription et paiement : ${link}`,
      });
    } catch (e) {
      Alert.alert("Partage impossible", e.message);
    }
  };

  if (loading && !summary) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.teal} />
        <Text style={styles.muted}>Chargement du parrainage...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={colors.teal}
        />
      }
    >
      <Text style={styles.title}>Parrainage</Text>
      <Text style={styles.subtitle}>
        Partage ton code et suis tes commissions.
      </Text>

      {error ? (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={() => load()}>
            <Text style={styles.buttonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {summary ? (
        <>
          <View style={styles.card}>
            <Text style={styles.label}>MON CODE PERSONNEL</Text>
            <Text style={styles.code}>{summary.code}</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={shareReferral}
            >
              <Text style={styles.buttonText}>Partager mon lien</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.grid}>
            <View style={styles.stat}>
              <Text style={styles.label}>Commissions gagnées</Text>
              <Text style={styles.amount}>{money(summary.earned)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.label}>Solde disponible</Text>
              <Text style={styles.amount}>{money(summary.balance)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.label}>Déjà payées</Text>
              <Text style={styles.amount}>{money(summary.paid)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.label}>En attente de retrait</Text>
              <Text style={styles.amount}>{money(summary.reserved)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Ventes attribuées ({summary.referrals?.length || 0})
            </Text>

            {!summary.referrals?.length ? (
              <Text style={styles.muted}>
                Aucune vente attribuée à ce code pour le moment.
              </Text>
            ) : (
              summary.referrals.map((item, index) => (
                <View key={`${item.name || "client"}-${index}`} style={styles.row}>
                  <View style={styles.saleInfo}>
                    <Text style={styles.saleName}>
                      {item.name || "Client"}
                    </Text>
                    <Text style={styles.muted}>
                      {item.activated_at || "Date non renseignée"}
                    </Text>
                  </View>
                  <Text style={styles.saleAmount}>
                    {money(item.commission_amount)}
                  </Text>
                </View>
              ))
            )}
          </View>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => load(true)}
          >
            <Text style={styles.buttonText}>Actualiser les données</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 24, gap: 14 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
    gap: 12,
  },
  title: { color: colors.text, fontSize: 25, fontWeight: "bold" },
  subtitle: { color: colors.muted, fontSize: 14, marginBottom: 4 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
  },
  label: { color: colors.muted, fontSize: 11 },
  code: { color: colors.teal, fontSize: 28, fontWeight: "bold" },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "bold" },
  amount: { color: colors.text, fontSize: 16, fontWeight: "bold", marginTop: 7 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.line,
  },
  button: {
    backgroundColor: colors.tealDim,
    borderRadius: 10,
    padding: 13,
    alignItems: "center",
  },
  refreshButton: {
    backgroundColor: colors.cardAlt,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  buttonText: { color: colors.text, fontWeight: "bold" },
  muted: { color: colors.muted, fontSize: 12 },
  error: { color: colors.coral },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  saleInfo: { flex: 1, gap: 4 },
  saleName: { color: colors.text, fontSize: 14 },
  saleAmount: { color: colors.teal, fontWeight: "bold" },
});
