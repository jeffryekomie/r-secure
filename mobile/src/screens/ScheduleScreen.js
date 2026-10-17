import React from "react";
import { View, Text, TouchableOpacity, Switch, StyleSheet } from "react-native";
import { Clock, Plus } from "lucide-react-native";
import { colors } from "../theme/colors";

export default function ScheduleScreen({ wifiOn, onTogglePower, schedules, onToggleSchedule, onAddSchedule }) {
  return (
    <View>
      <Text style={styles.title}>Planning wifi</Text>
      <Text style={styles.subtitle}>Programmez les coupures automatiques</Text>

      <View style={[styles.card, styles.masterRow]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Wifi maintenant</Text>
          <Text style={styles.rowMeta}>Coupure immédiate, sans planning</Text>
        </View>
        <Switch value={wifiOn} onValueChange={onTogglePower} trackColor={{ false: colors.line, true: colors.teal }} thumbColor={colors.bg} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>Créneaux programmés</Text>
        <TouchableOpacity style={styles.addButton} onPress={onAddSchedule}>
          <Plus size={13} color={colors.teal} />
          <Text style={styles.addButtonText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {schedules.map((s) => (
        <View key={s.id} style={styles.card}>
          <View style={styles.editRow}>
            <View style={styles.rowLeft}>
              <Clock size={14} color={colors.muted} />
              <Text style={styles.rowTitle}>{s.label}</Text>
            </View>
            <Switch value={!!s.enabled} onValueChange={(v) => onToggleSchedule(s.id, v)} trackColor={{ false: colors.line, true: colors.teal }} thumbColor={colors.bg} />
          </View>
          <Text style={styles.time}>{s.start_time} — {s.end_time}</Text>
          <Text style={styles.days}>{s.days}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 20, fontWeight: "700" },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2, marginBottom: 20 },
  card: { backgroundColor: colors.cardAlt, borderRadius: 16, padding: 14, marginBottom: 10 },
  masterRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: "500" },
  rowMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  sectionLabel: { color: colors.muted, fontSize: 12 },
  addButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  addButtonText: { color: colors.teal, fontSize: 12 },
  editRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  time: { color: colors.muted, fontSize: 11, marginTop: 8 },
  days: { color: colors.muted, fontSize: 10, marginTop: 4, letterSpacing: 1 },
});
