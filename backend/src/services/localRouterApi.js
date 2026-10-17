/**
 * Pilotage du routeur via SON INTERFACE LOCALE (192.168.1.1), atteinte à
 * travers le tunnel VPN (confirmé compatible : VPN Client OpenVPN du W154R Plus).
 *
 * ⚠️ CE FICHIER CONTIENT DES PLACEHOLDERS pour les requêtes vers l'interface
 * du routeur (schéma /goform/... courant sur ce type de matériel, mais pas
 * encore confirmé pour le W154R Plus). Capturez les vraies requêtes via les
 * DevTools de votre navigateur (F12 → Network → "Copy as cURL") en utilisant
 * l'interface normalement, puis partagez-les pour ajuster ce fichier.
 */

const axios = require("axios");

function client(router) {
  return axios.create({
    baseURL: `http://${router.vpn_ip}`,
    timeout: 8000,
    withCredentials: true,
  });
}

async function login(router) {
  const http = client(router);
  const res = await http.post(
    "/goform/goform_set_cmd_process",
    new URLSearchParams({ goformId: "LOGIN", password: router.admin_password })
  );
  const cookie = res.headers["set-cookie"]?.[0];
  if (!cookie) throw new Error("Échec de connexion à l'interface du routeur (cookie de session absent)");
  return cookie;
}

async function authedRequest(router, requestFn) {
  const cookie = await login(router);
  const http = client(router);
  return requestFn(http, { headers: { Cookie: cookie } });
}

/** Liste des appareils actuellement connectés au wifi */
async function listConnectedDevices(router) {
  const { data } = await authedRequest(router, (http, cfg) =>
    http.get("/goform/goform_get_cmd_process", { ...cfg, params: { cmd: "station_list" } })
  );
  const list = data?.station_list || []; // PLACEHOLDER — adapter au format réel
  return list.map((s) => ({ mac: s.mac, ip: s.ip, hostname: s.hostname || "Appareil inconnu" }));
}

async function blockDeviceByMac(router, mac) {
  return authedRequest(router, (http, cfg) =>
    http.post("/goform/goform_set_cmd_process", new URLSearchParams({ goformId: "WIFI_MAC_FILTER_ADD", mac }), cfg)
  );
}

async function unblockDeviceByMac(router, mac) {
  return authedRequest(router, (http, cfg) =>
    http.post(
      "/goform/goform_set_cmd_process",
      new URLSearchParams({ goformId: "WIFI_MAC_FILTER_REMOVE", mac }),
      cfg
    )
  );
}

async function setWifiEnabled(router, enabled) {
  return authedRequest(router, (http, cfg) =>
    http.post(
      "/goform/goform_set_cmd_process",
      new URLSearchParams({ goformId: "WIFI_ENABLE", enable: enabled ? "1" : "0" }),
      cfg
    )
  );
}

async function setSsid(router, ssid) {
  return authedRequest(router, (http, cfg) =>
    http.post("/goform/goform_set_cmd_process", new URLSearchParams({ goformId: "WIFI_SSID_SET", ssid }), cfg)
  );
}

async function setPassword(router, password) {
  return authedRequest(router, (http, cfg) =>
    http.post(
      "/goform/goform_set_cmd_process",
      new URLSearchParams({ goformId: "WIFI_WPAPSK_SET", wpapsk_key: password }),
      cfg
    )
  );
}

async function setNetworkVisible(router, visible) {
  return authedRequest(router, (http, cfg) =>
    http.post(
      "/goform/goform_set_cmd_process",
      new URLSearchParams({ goformId: "WIFI_HIDDEN_SET", hidden: visible ? "0" : "1" }),
      cfg
    )
  );
}

module.exports = {
  listConnectedDevices,
  blockDeviceByMac,
  unblockDeviceByMac,
  setWifiEnabled,
  setSsid,
  setPassword,
  setNetworkVisible,
};
