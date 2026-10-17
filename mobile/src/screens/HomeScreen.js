import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Router, Power, Timer, X } from "lucide-react-native";
import { colors } from "../theme/colors";

const TIMER_OPTIONS = [
  { label: "30 min", minutes: 30 },
  { label: "1 h", minutes: 60 },
  { label: "2 h", minutes: 120 },
];

export default function HomeScreen({ routerLabel, wifiOn, deviceCount, timerOffAt, onTogglePower, onSetTimer, onCancelTimer }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <View>
      <Text style={styles.title}>R secure</Text>
      <Text style={styles.subtitle}>{routerLabel}</Text>

      <View style={styles.hero}>
        <View style={styles.iconCircle}>
          <Router size={28} color={colors.teal} />
        </View>
        <Text style={styles.count}>{deviceCount}</Text>
        <Text style={styles.countLabel}>appareils connectés</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>État du wifi</Text>
          <Text style={[styles.statValue, { color: wifiOn ? colors.teal : colors.coral }]}>
            {wifiOn ? "Actif" : "Coupé"}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Signal réseau</Text>
          <Text style={styles.statValue}>Excellent</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.powerButton, { backgroundColor: wifiOn ? colors.coral : colors.teal }]}
        onPress={() => onTogglePower(!wifiOn)}
      >
        <Power size={16} color={colors.bg} />
        <Text style={styles.powerButtonText}>{wifiOn ? "Couper le wifi" : "Rallumer le wifi"}</Text>
      </TouchableOpacity>

      {/* Minuteur */}
      <View style={styles.timerCard}>
        <View style={styles.timerHeader}>
          <View style={styles.timerLeft}>
            <Timer size={15} color={colors.muted} />
            <Text style={styles.timerLabel}>
              {timerOffAt ? `Coupure programmée à ${new Date(timerOffAt).toLocaleTimeString().slice(0, 5)}` : "Minuteur"}
            </Text>
          </View>
          {timerOffAt && (
            <TouchableOpacity onPress={onCancelTimer}>
              <X size={15} color={colors.coral} />
            </TouchableOpacity>
          )}
        </View>

        {!timerOffAt && (
          <View>
            {!pickerOpen ? (
              <TouchableOpacity onPress={() => setPickerOpen(true)}>
                <Text style={styles.timerCta}>Couper le wifi dans…</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.timerOptions}>
                {TIMER_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.minutes}
                    style={styles.timerOption}
                    onPress={() => {
                      onSetTimer(opt.minutes);
                      setPickerOpen(false);
                    }}
                  >
                    <Text style={styles.timerOptionText}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        <Text style={styles.timerHint}>
          Pour que la coupure ait lieu, gardez l'application ouverte et ce téléphone connecté au wifi du routeur.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  timerHint: { color: colors.muted, fontSize: 11, marginTop: 10, lineHeight: 15 },
  title: { color: colors.text, fontSize: 20, fontWeight: "700" },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2, marginBottom: 24 },
  hero: { alignItems: "center", marginVertical: 20 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.tealDim,
    alignItems: "center",
    justifyContent: "center",
  },
  count: { color: colors.text, fontSize: 40, fontWeight: "700", marginTop: 20 },
  countLabel: { color: colors.muted, fontSize: 12, marginTop: 4 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: colors.cardAlt, borderRadius: 16, padding: 12 },
  statLabel: { color: colors.muted, fontSize: 10 },
  statValue: { color: colors.text, fontSize: 14, fontWeight: "600", marginTop: 4 },
  powerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
  },
  powerButtonText: { color: colors.bg, fontSize: 14, fontWeight: "600" },
  timerCard: { backgroundColor: colors.cardAlt, borderRadius: 16, padding: 14, marginTop: 12 },
  timerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  timerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  timerLabel: { color: colors.text, fontSize: 13 },
  timerCta: { color: colors.teal, fontSize: 13, marginTop: 10 },
  timerOptions: { flexDirection: "row", gap: 8, marginTop: 10 },
  timerOption: { flex: 1, backgroundColor: colors.card, borderRadius: 12, paddingVertical: 8, alignItems: "center" },
  timerOptionText: { color: colors.text, fontSize: 12 },
});
