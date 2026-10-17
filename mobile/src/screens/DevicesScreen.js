import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Smartphone, Ban } from "lucide-react-native";
import { colors } from "../theme/colors";

export default function DevicesScreen({ devices = [], blocked = [], onKick, onUnblock }) {
  return (
    <View>
      <Text style={styles.title}>Appareils connectés</Text>
      <Text style={styles.subtitle}>
        {devices.length} appareil{devices.length > 1 ? "s" : ""} actif{devices.length > 1 ? "s" : ""} sur votre wifi
      </Text>

      {devices.map((d) => (
        <View key={d.mac} style={styles.row}>
          <View style={styles.rowLeft}>
            <View style={styles.iconCircle}>
              <Smartphone size={17} color={colors.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{d.hostname || d.mac}</Text>
              <Text style={styles.meta}>{d.ip}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => onKick(d.mac)} style={styles.blockButton}>
            <Ban size={14} color={colors.coral} />
            <Text style={styles.blockText}>Bloquer</Text>
          </TouchableOpacity>
        </View>
      ))}

      {devices.length === 0 && <Text style={styles.empty}>Plus aucun appareil connecté.</Text>}

      {blocked.length > 0 && (
        <View>
          <Text style={styles.sectionTitle}>Appareils bloqués</Text>
          <Text style={styles.blockedHint}>
            Si un appareil bloqué semble encore connecté, éteignez puis rallumez son wifi : le routeur refusera sa reconnexion.
          </Text>
          {blocked.map((b) => (
            <View key={b.mac} style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: colors.card }]}>
                  <Ban size={17} color={colors.coral} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{b.name || b.mac}</Text>
                  {b.name ? <Text style={styles.meta}>{b.mac}</Text> : null}
                </View>
              </View>
              <TouchableOpacity onPress={() => onUnblock(b.mac)} style={styles.unblockButton}>
                <Text style={styles.unblockText}>Débloquer</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  blockedHint: { color: colors.muted, fontSize: 11, lineHeight: 16, marginBottom: 10 },
  title: { color: colors.text, fontSize: 20, fontWeight: "700" },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2, marginBottom: 20 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "600", marginTop: 24, marginBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.cardAlt,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.tealDim,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: colors.text, fontSize: 14, fontWeight: "500" },
  meta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  blockButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.coral,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  blockText: { color: colors.coral, fontSize: 12, fontWeight: "600" },
  unblockButton: { backgroundColor: colors.tealDim, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  unblockText: { color: colors.teal, fontSize: 12, fontWeight: "600" },
  empty: { color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 40 },
});
