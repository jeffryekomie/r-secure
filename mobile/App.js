import './macFix';
import React, { useEffect, useState, useCallback } from "react";
import { SafeAreaView, View, ScrollView, TouchableOpacity, Text, StyleSheet, Alert, AppState } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Home, List, QrCode, Settings, LifeBuoy } from "lucide-react-native";

import { colors } from "./src/theme/colors";
import { api, setTimerListener } from "./src/api/client";
import HomeScreen from "./src/screens/HomeScreen";
import DevicesScreen from "./src/screens/DevicesScreen";
import NetworkScreen from "./src/screens/NetworkScreen";
import ParentalScreen from "./src/screens/ParentalScreen";
import SupportScreen from "./src/screens/SupportScreen";
import ReferralScreen from "./src/screens/ReferralScreen";
import AuthScreen from "./src/screens/AuthScreen";
import RouterPasswordScreen from "./src/screens/RouterPasswordScreen";
import AccountSection from "./src/screens/AccountSection";
import { getClientToken, logoutClient, verifySession } from "./src/api/auth";

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [tab, setTab] = useState("home");
  const [router, setRouter] = useState(null);
  const [devices, setDevices] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [supportContacts, setSupportContacts] = useState([]);
  const [wifiOn, setWifiOn] = useState(true);
  const [timerOffAt, setTimerOffAt] = useState(null);
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [networkVisible, setNetworkVisible] = useState(true);
  const [parentSsid, setParentSsid] = useState("");
  const [parentPassword, setParentPassword] = useState("");
  const [blocked, setBlocked] = useState([]);
  const [needRouterPassword, setNeedRouterPassword] = useState(false);

  useEffect(() => {
    let active = true;

    getClientToken()
      .then(async (token) => {
        if (!token) {
          if (active) setAuthenticated(false);
          return;
        }
        // Revalide la licence et la session auprès du serveur (révocation, expiration, autre téléphone).
        const check = await verifySession();
        if (check.status === "invalid") {
          await logoutClient();
          if (active) {
            setAuthenticated(false);
            Alert.alert("Reconnexion nécessaire", check.message);
          }
          return;
        }
        if (active) setAuthenticated(true);
      })
      .catch(() => {
        if (active) setAuthenticated(false);
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const routers = await api.getRouters();
      const r = routers[0];
      if (r) {
        setRouter(r);
        setTimerOffAt(r.timer_off_at);
        setWifiOn(r.wifi_on !== false);
        setSsid(r.ssid || "");
        setPassword(r.password || "");
        setNetworkVisible(r.visible !== false);
        setParentSsid(r.parent_ssid || "");
        setParentPassword(r.parent_password || "");
        const [devs, scheds] = await Promise.all([api.getDevices(r.id), api.getSchedules(r.id)]);
        setDevices(devs);
        setSchedules(scheds);
        api.getBlocked().then(setBlocked).catch(() => {});
      }
      setSupportContacts(await api.getSupportContacts());
    } catch (e) {
      if (e && e.code === "BAD_ROUTER_PASSWORD") {
        setNeedRouterPassword(true);
        return;
      }
      Alert.alert("Connexion impossible", e.message);
    }
  }, []);

  const submitRouterPassword = async (value) => {
    await api.setRouterPassword(value);
    setNeedRouterPassword(false);
    await loadAll();
  };

  const doLogout = async () => {
    await logoutClient();
    setRouter(null);
    setDevices([]);
    setSchedules([]);
    setBlocked([]);
    setSsid("");
    setPassword("");
    setParentSsid("");
    setParentPassword("");
    setTimerOffAt(null);
    setNeedRouterPassword(false);
    setTab("home");
    setAuthenticated(false);
  };

  // Le minuteur du wifi : vérifié au retour dans l'app, et mis à jour à l'écran quand il se déclenche.
  useEffect(() => {
    if (!authenticated) return undefined;
    setTimerListener((state) => {
      if (state === "fired") {
        setWifiOn(false);
        setTimerOffAt(null);
      } else if (state === "expired") {
        setTimerOffAt(null);
      }
    });
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") api.checkTimer().catch(() => {});
    });
    return () => {
      sub.remove();
      setTimerListener(null);
    };
  }, [authenticated]);

  useEffect(() => {
    if (authenticated) {
      loadAll();
    }
  }, [loadAll, authenticated]);

  const handleTogglePower = (enabled) => {
    if (enabled) return doTogglePower(true);
    Alert.alert("Couper le réseau principal ?", "Le wifi 2,4 GHz sera coupé. Le réseau parental (5 GHz) reste actif : gardez ce téléphone connecté dessus pour pouvoir rallumer le wifi.", [
      { text: "Annuler", style: "cancel" },
      { text: "Couper", style: "destructive", onPress: () => doTogglePower(false) },
    ]);
  };
  const doTogglePower = async (enabled) => {
    setWifiOn(enabled);
    try {
      await api.setPower(router.id, enabled);
    } catch (e) {
      setWifiOn(!enabled);
      Alert.alert("Erreur", e.message);
    }
  };

  const handleSetTimer = async (minutes) => {
    try {
      const res = await api.setTimer(router.id, minutes);
      setTimerOffAt(res.timer_off_at);
    } catch (e) {
      Alert.alert("Erreur", e.message);
    }
  };

  const handleCancelTimer = async () => {
    setTimerOffAt(null);
    try {
      await api.cancelTimer(router.id);
    } catch (e) {
      Alert.alert("Erreur", e.message);
      loadAll();
    }
  };

  const handleKick = (mac) => Alert.alert("Bloquer cet appareil ?", "Il sera déconnecté du wifi et ne pourra plus se reconnecter tant qu'il n'est pas débloqué. Ne bloquez pas le téléphone que vous utilisez en ce moment.", [{ text: "Annuler", style: "cancel" }, { text: "Bloquer", style: "destructive", onPress: () => doKick(mac) }]);
  const doKick = async (mac) => {
    const dev = devices.find((x) => x.mac === mac);
    setDevices((d) => d.filter((x) => x.mac !== mac));
    try {
      await api.kickDevice(router.id, mac, dev && dev.hostname);
      setBlocked((b) => [...b.filter((x) => x.mac.toLowerCase() !== mac.toLowerCase()), { mac, name: (dev && dev.hostname) || "" }]);
    } catch (e) {
      Alert.alert("Erreur", e.message);
      loadAll();
    }
  };

  const handleRemoveFromList = async (mac) => {
    setDevices((d) => d.filter((x) => x.mac !== mac));
    try {
      await api.removeFromList(router.id, mac);
    } catch (e) {
      Alert.alert("Erreur", e.message);
      loadAll();
    }
  };

  const handleSetLimit = async (mac, minutes) => {
    setDevices((d) => d.map((x) => (x.mac === mac ? { ...x, daily_limit_minutes: minutes } : x)));
    try {
      await api.setDeviceLimit(router.id, mac, minutes);
    } catch (e) {
      Alert.alert("Erreur", e.message);
      loadAll();
    }
  };

  const handleSaveSsid = (newSsid) => {
    if (!newSsid || newSsid === ssid) return;
    Alert.alert("Changer le nom du wifi ?", "Tous les appareils seront déconnectés et devront se reconnecter avec le nouveau nom.", [
      { text: "Annuler", style: "cancel" },
      { text: "Changer", onPress: () => doSaveSsid(newSsid) },
    ]);
  };
  const doSaveSsid = async (newSsid) => {
    try {
      await api.setSsid(router.id, newSsid);
      setSsid(newSsid);
      setParentSsid(`${newSsid}5G`);
    } catch (e) {
      Alert.alert("Erreur", e.message);
    }
  };

  const handleSavePassword = (newPassword) => {
    if (!newPassword || newPassword === password) return;
    if (newPassword.length < 8) {
      Alert.alert("Mot de passe trop court", "Le mot de passe wifi doit contenir au moins 8 caractères.");
      return;
    }
    Alert.alert("Changer le mot de passe ?", "Tous les appareils seront déconnectés et devront saisir le nouveau mot de passe.", [
      { text: "Annuler", style: "cancel" },
      { text: "Changer", onPress: () => doSavePassword(newPassword) },
    ]);
  };
  // L'écran n'affiche le nouveau mot de passe qu'une fois le changement confirmé par le routeur.
  const doSavePassword = async (newPassword) => {
    try {
      await api.setPassword(router.id, newPassword);
      setPassword(newPassword);
    } catch (e) {
      Alert.alert("Erreur", e.message);
    }
  };

  const handleSaveParentPassword = (newPassword) => {
    if (!newPassword || newPassword === parentPassword) return;
    if (newPassword.length < 8) {
      Alert.alert("Mot de passe trop court", "Le mot de passe parental doit contenir au moins 8 caractères.");
      return;
    }
    Alert.alert(
      "Changer le mot de passe parental ?",
      "Les appareils connectés au réseau 5 GHz devront utiliser le nouveau mot de passe.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Changer", onPress: () => doSaveParentPassword(newPassword) },
      ]
    );
  };

  const doSaveParentPassword = async (newPassword) => {
    try {
      await api.setParentPassword(router.id, newPassword);
      setParentPassword(newPassword);
    } catch (e) {
      Alert.alert("Erreur", e.message);
    }
  };

  const handleToggleVisible = async (visible) => {
    setNetworkVisible(visible);
    try {
      await api.setVisibility(router.id, visible);
    } catch (e) {
      setNetworkVisible(!visible);
      Alert.alert("Erreur", e.message);
    }
  };

  const handleToggleSchedule = async (id, enabled) => {
    setSchedules((s) => s.map((x) => (x.id === id ? { ...x, enabled } : x)));
    try {
      await api.toggleSchedule(router.id, id, enabled);
    } catch (e) {
      Alert.alert("Erreur", e.message);
      loadAll();
    }
  };

  const handleUnblock = async (mac) => {
    try {
      await api.unblockDevice(router.id, mac);
      setBlocked((b) => b.filter((x) => x.mac.toLowerCase() !== mac.toLowerCase()));
    } catch (e) {
      Alert.alert("Erreur", e.message);
    }
  };

  if (!authReady) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  if (!authenticated) {
    return (
      <>
        <StatusBar style="light" />
        <AuthScreen onAuthenticated={() => setAuthenticated(true)} />
      </>
    );
  }

  if (needRouterPassword) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <RouterPasswordScreen
          onSubmit={submitRouterPassword}
          onCancel={router ? () => setNeedRouterPassword(false) : undefined}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {tab === "home" && (
          <HomeScreen
            routerLabel={router ? `${router.model} · ${router.label}` : "Chargement..."}
            wifiOn={wifiOn}
            deviceCount={devices.length}
            timerOffAt={timerOffAt}
            onTogglePower={handleTogglePower}
            onSetTimer={handleSetTimer}
            onCancelTimer={handleCancelTimer}
          />
        )}
        {tab === "devices" && (
          <DevicesScreen
            devices={devices.filter((d) => !blocked.some((b) => String(b.mac || "").toLowerCase() === String(d.mac || "").toLowerCase()))}
            onKick={handleKick}
            blocked={blocked}
            onUnblock={handleUnblock}
          />
        )}
        {tab === "parental" && <ParentalScreen ssid={parentSsid} password={parentPassword} hidden={!networkVisible} onSavePassword={handleSaveParentPassword} />}
        {tab === "network" && (
          <NetworkScreen
            ssid={ssid}
            password={password}
            networkVisible={networkVisible}
            onSaveSsid={handleSaveSsid}
            onSavePassword={handleSavePassword}
            onToggleVisible={handleToggleVisible}
            readError={router && router.wifi_error}
          />
        )}
        {tab === "support" && (
          <>
            <SupportScreen contacts={supportContacts} />
            <AccountSection
              onChangeRouterPassword={() => setNeedRouterPassword(true)}
              onLogout={doLogout}
            />
          </>
        )}
        {tab === "referral" && <ReferralScreen />}
      </ScrollView>

      <View style={styles.nav}>
        <NavButton icon={Home} label="Accueil" active={tab === "home"} onPress={() => setTab("home")} />
        <NavButton icon={List} label="Appareils" active={tab === "devices"} onPress={() => setTab("devices")} />
        <NavButton icon={QrCode} label="Parents" active={tab === "parental"} onPress={() => setTab("parental")} />
        <NavButton icon={Settings} label="Réseau" active={tab === "network"} onPress={() => setTab("network")} />
        <NavButton icon={LifeBuoy} label="Aide" active={tab === "support"} onPress={() => setTab("support")} />
        <NavButton icon={QrCode} label="Parrainage" active={tab === "referral"} onPress={() => setTab("referral")} />
      </View>
    </SafeAreaView>
  );
}

function NavButton({ icon: Icon, label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.navButton}>
      <Icon size={18} color={active ? colors.teal : colors.muted} />
      <Text style={[styles.navLabel, { color: active ? colors.teal : colors.muted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 100 },
  nav: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.card,
  },
  navButton: { alignItems: "center", gap: 4 },
  navLabel: { fontSize: 9 },
});
