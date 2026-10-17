import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

// ---------------------------------------------------------------------------
// MODE LOCAL : l'app parle directement au routeur (téléphone connecté à son wifi).
// Commandes relevées dans les captures PCAPdroid du 2 octobre (firmware à UUID,
// ex. W304VA PRO). Le mot de passe admin du routeur est lu dans AsyncStorage
// ("routerPassword"), sinon DEFAULT_PASSWORD est utilisé.
// ---------------------------------------------------------------------------
const ROUTER_URL = "http://192.168.1.1/cgi-bin/http.cgi";
const DEFAULT_PASSWORD = "admin"; // <-- à remplacer par le mot de passe admin du routeur
const USERNAME = "admin";

const CMD = {
  PRE_LOGIN: "835e31b3-a45a-4504-80df-586bf8a509aa",
  LOGIN_TOKEN: "3830c61a-620d-47da-ae47-33d8401401c4",
  LOGIN: "d2aa9843-494b-4947-9621-a46ec652ecd9",
  CSRF: "f3b70f2f-8721-48c4-87ec-22d8c92dd3c9",
  INFO: "55f29f9b-20cd-4d72-ab20-63ba0b4d2a7a",
  CLIENTS: "5332f5ee-5be9-4843-b85f-1b251aa5f4ff",
  WIFI_24: "79e44d29-789a-47d5-ab6a-692f43841fc9", // renvoie cmd 2  (2,4 GHz)
  WIFI_5: "bd9f2e03-1fc4-4b7c-bcda-8bfb6550aa88", // renvoie cmd 211 (5 GHz)
  APPLY: "06df6e71-3091-4fd3-98c4-759127d0f366",
};
const CMD_MAC_FILTER = 23;
const CMD_DETECT = {
  INIT: "9f2861ee-baf8-4038-bab6-774ad4e930b0",
  DEVICE_INFO: "ece6b6d4-61c7-4dad-af23-c8249c75c58c",
};
// Anciens firmwares : mêmes commandes, identifiées par un numéro (relevé sur un second routeur).
const CMD_NUMERIC = { PRE_LOGIN: 104, LOGIN_TOKEN: 232, LOGIN: 100, CSRF: 233, INFO: 3, CLIENTS: 223, WIFI_24: 2, WIFI_5: 211, TIME_SYNC: 321, APPLY: 20 };
let numericMode = false;
const commandFor = (name) => numericMode ? CMD_NUMERIC[name] : CMD[name];
const decodeKey = (k) => (numericMode ? String(k || "") : fromBase64(k));
const encodeKey = (p) => (numericMode ? p : toBase64(p));
const wifiFlags = () => (numericMode ? {} : { base64_key: "1" });

const NOT_AVAILABLE =
  "Pas encore disponible : la commande du routeur n'a pas été capturée.";

// ---------- utilitaires ----------
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function toBase64(str) {
  const bytes = unescape(encodeURIComponent(str)).split("").map((c) => c.charCodeAt(0));
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b, c] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? "=" : B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? "=" : B64[c & 63];
  }
  return out;
}

function fromBase64(b64) {
  try {
    const bin = String(b64 || "").replace(/=+$/, "");
    let bits = "", out = "";
    for (const ch of bin) { const i = B64.indexOf(ch); if (i < 0) return ""; bits += i.toString(2).padStart(6, "0"); }
    for (let i = 0; i + 8 <= bits.length; i += 8) out += String.fromCharCode(parseInt(bits.slice(i, i + 8), 2));
    return decodeURIComponent(escape(out));
  } catch (_) { return ""; }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isPrintable = (s) => s.length > 0 && !/[\u0000-\u001F\u007F\uFFFD]/.test(s);
const byteLength = (s) => unescape(encodeURIComponent(String(s))).length;
const normWire = (v) => String(v === undefined || v === null ? "" : v).replace(/=+$/, "");

// Le nom du wifi est normalement en base64. Si le routeur le renvoie en clair, on le lit tel quel
// et on l'écrira aussi en clair (sinon le réseau prendrait comme nom un charabia en base64).
let ssidEncoding = "b64";
function decodeSsid(raw) {
  const v = String(raw === undefined || raw === null ? "" : raw);
  if (!v) return "";
  const d = fromBase64(v);
  if (isPrintable(d)) {
    ssidEncoding = "b64";
    return d;
  }
  ssidEncoding = "plain";
  return v;
}
const encodeSsid = (s) => (ssidEncoding === "plain" ? s : toBase64(s));

function randomHex(n) {
  let s = "";
  while (s.length < n) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

let session = { id: "", token: "" };
let timerHandle = null;

async function rawRequest(body, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(ROUTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=UTF-8" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    const i = text.indexOf("{");
    return i >= 0 ? JSON.parse(text.slice(i)) : {};
  } catch (e) {
    const err = new Error("Routeur injoignable (êtes-vous sur son wifi ?)");
    err.code = "ROUTER_UNREACHABLE";
    throw err;
  } finally {
    clearTimeout(t);
  }
}

async function refreshCsrf() {
  const r = await rawRequest({ cmd: commandFor("CSRF"), method: "GET", sessionId: session.id });
  session.token = r.token || "";
}

async function login() {
  numericMode = false;
  const password = (await AsyncStorage.getItem("routerPassword")) || DEFAULT_PASSWORD;
  try {
    await rawRequest({ cmd: commandFor("PRE_LOGIN"), method: "GET", sessionId: "" }, 6000);
  } catch (_) {}
  let t = await rawRequest({ cmd: commandFor("LOGIN_TOKEN"), method: "GET", sessionId: "" });
  if (!t.token && !numericMode) {
    // Ancien firmware : les commandes sont des numéros.
    // Les commandes numériques restent séparées des commandes UUID.
    numericMode = true;
    t = await rawRequest({ cmd: commandFor("LOGIN_TOKEN"), method: "GET", sessionId: "" });
  }
  if (!t.token) throw new Error("Le routeur n'a pas fourni de jeton de connexion");
  const passwd = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    t.token + password
  );
  const r = await rawRequest({
    username: USERNAME,
    passwd,
    ...(numericMode ? { isAutoUpgrade: "0", subcmd: 0 } : { token: t.token }),
    sessionId: randomHex(64),
    cmd: commandFor("LOGIN"),
    method: "POST",
  });
  if (!r.success || r.login_fail === "fail" || r.login_fail2 === "fail" || !r.sessionId) {
    const busy = r.message === "alreadyLogin";
    const err = new Error(
      busy
        ? "Le routeur a déjà une session admin ouverte (fermez-la ou attendez)"
        : "Mot de passe admin du routeur incorrect"
    );
    err.code = busy ? "ROUTER_BUSY" : "BAD_ROUTER_PASSWORD";
    throw err;
  }
  session.id = r.sessionId;
  await refreshCsrf();
}

async function ensureSession() {
  if (!session.id) await login();
}

async function get(cmd, extra = {}, retry = true) {
  await ensureSession();
  const r = await rawRequest({ ...extra, cmd, method: "GET", sessionId: session.id });
  if (r && r.success === false && retry) {
    session = { id: "", token: "" };
    return get(cmd, extra, false);
  }
  return r;
}

async function post(cmd, extra = {}, retry = true) {
  await ensureSession();
  const r = await rawRequest({
    ...extra,
    cmd,
    method: "POST",
    sessionId: session.id,
    token: session.token,
  });
  if (r && r.success === false) {
    if (retry) {
      session = { id: "", token: "" };
      return post(cmd, extra, false);
    }
    throw new Error(r.message || "Le routeur a refusé la commande");
  }
  await refreshCsrf().catch(() => {});
  return r;
}

// Lit la config d'une bande et prépare le message à envoyer avec les champs modifiés.
async function buildBandBody(cmd, changes, is5g) {
  const cur = await get(cmd, { subcmd: 0, ...wifiFlags() });
  if (!cur || cur.success === false) throw new Error("Lecture du wifi impossible");
  const body = {
    subcmd: 0,
    wifiOpen: cur.wifiOpen,
    broadcast: cur.broadcast,
    ssid: cur.ssid,
    key: cur.key,
    authenticationType: cur.authenticationType,
    ...wifiFlags(),
    ...(is5g ? { wifiSames: cur.wifiSames ?? "0" } : {}),
    ...changes,
  };
  // On ne vérifie que les champs que le routeur nous renvoie réellement (certains cachent le mot de passe).
  const checkable = {};
  for (const [k, v] of Object.entries(changes)) {
    if (normWire(cur[k]) !== "") checkable[k] = v;
  }
  return { body, checkable };
}

async function updateBand(cmd, changes, is5g) {
  const { body, checkable } = await buildBandBody(cmd, changes, is5g);
  const reply = await post(cmd, body);
  if (Object.keys(checkable).length) await confirmBand(cmd, checkable, reply);
  return reply;
}

// Délai entre deux essais quand le routeur redémarre son wifi (réglable pour les tests).
let networkRetryDelayMs = 5000;
export const setNetworkRetryDelay = (ms) => { networkRetryDelayMs = ms; };

// Envoie une commande en réessayant tant que le routeur est injoignable (son wifi redémarre).
async function postWithRetry(cmd, body, attempts = 9) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await post(cmd, body);
    } catch (e) {
      if (!e || e.code !== "ROUTER_UNREACHABLE") throw e;
      lastError = e;
      session = { id: "", token: "" }; // nouvelle connexion au routeur au prochain essai
      await sleep(networkRetryDelayMs);
    }
  }
  throw lastError;
}

const readBand = (cmd) => get(cmd, { subcmd: 0, ...wifiFlags() });

// Vérifie que le routeur a bien retenu la modification. S'il ne l'a pas fait, on envoie la commande
// « appliquer » une fois, puis on revérifie. Si le routeur est injoignable (le wifi redémarre, ou le
// téléphone était connecté à la bande modifiée), on ne peut pas vérifier : on ne signale pas d'erreur.
async function confirmBand(cmd, changes, postReply) {
  let applied = false;
  for (const wait of [1200, 2500, 4000]) {
    await sleep(wait);
    let cur;
    try {
      cur = await readBand(cmd);
    } catch (_) {
      return;
    }
    if (!cur || cur.success === false) return;
    if (Object.entries(changes).every(([k, v]) => normWire(cur[k]) === normWire(v))) return;
    if (!applied) {
      applied = true;
      await post(commandFor("APPLY"), {}).catch(() => {});
    }
  }
  throw new Error(
    `Le routeur n'a pas appliqué la modification. (${describeReply(postReply)})`
  );
}

// La modification d'une bande peut couper le wifi du téléphone. Le réseau principal (2,4 GHz), celui
// où se trouve en général le téléphone, est donc modifié EN DERNIER, après vérification du 5 GHz.
// Les deux lectures sont faites avant toute écriture, et si le routeur redémarre son wifi entre les
// deux, l'envoi du 2,4 GHz est réessayé jusqu'à ce que le routeur réponde de nouveau.
async function updateBothBands(changes5g, changes24g) {
  const cmd24 = commandFor("WIFI_24");
  const cmd5 = commandFor("WIFI_5");
  const b5 = await buildBandBody(cmd5, changes5g, true);
  const b24 = await buildBandBody(cmd24, changes24g, false);

  const r5 = await post(cmd5, b5.body);
  if (Object.keys(b5.checkable).length) await confirmBand(cmd5, b5.checkable, r5);

  try {
    await postWithRetry(cmd24, b24.body);
  } catch (e) {
    if (e && e.code === "ROUTER_UNREACHABLE") {
      throw new Error(
        "Le réseau parental (5 GHz) a été renommé, mais le réseau principal (2,4 GHz) n'a pas pu l'être : le routeur ne répond plus. Reconnectez-vous à son wifi et recommencez."
      );
    }
    throw e;
  }
}

// ---------- blocage d'appareils (filtre MAC) ----------
const sameMac = (a, b) =>
  String(a || "").toLowerCase() === String(b || "").toLowerCase();

// Résume la réponse du routeur (sans données personnelles) pour comprendre un échec.
function describeReply(r) {
  if (!r || typeof r !== "object") return "aucune réponse exploitable";
  const keys = Object.keys(r).slice(0, 8).join(", ") || "vide";
  const msg = typeof r.message === "string" ? `, message « ${r.message.slice(0, 60)} »` : "";
  return `success=${String(r.success)}${msg}, champs : ${keys}, firmware ${numericMode ? "numérique" : "UUID"}`;
}

const isTrue = (v) => v === true || v === "true" || v === 1 || v === "1";

async function readMacFilters() {
  const r = await get(CMD_MAC_FILTER, { getfun: true });

  if (r && Array.isArray(r.datas)) return r.datas;

  // Aucune règle enregistrée : certains routeurs répondent « success » sans tableau.
  // On ne l'accepte que si le routeur confirme explicitement le succès.
  if (r && isTrue(r.success) && (r.datas === undefined || r.datas === null || r.datas === "")) {
    return [];
  }

  throw new Error(
    `Réponse de filtrage MAC invalide : les règles n'ont pas été modifiées. (${describeReply(r)})`
  );
}

async function saveMacFilters(list) {
  await post(CMD_MAC_FILTER, { success: true, datas: list });
  await post(commandFor("APPLY"), {});
}

// Le routeur a deux modes (cmd 28 / 30) : acceptAll=true = « tout autoriser sauf la liste »
// (blocage), acceptAll=false = « n'autoriser que la liste » (dangereux : liste vide = tout coupé).
async function ensureBlockMode() {
  const r = await get(28);
  const d = Array.isArray(r.datas) ? r.datas : [];
  if (d.some((x) => x.acceptAll === false || x.acceptAll === "false" || x.acceptAll === "0")) {
    throw new Error(
      "Le routeur est en mode « liste d'autorisation » : bloquer un appareil est impossible sans risque. Repassez-le en mode « liste de blocage » dans l'interface du routeur."
    );
  }
  if (d.length === 0 || d.some((x) => !x.enableRule)) {
    const rules = ["IPV4", "IPV6"].map((ippro) => ({ enableRule: true, acceptAll: true, ippro }));
    await post(30, { success: true, datas: rules });
    await post(28, { success: true, datas: rules });
  }
}

function normalizeMac(rawMac) {
  const value = String(rawMac || "").trim().replace(/-/g, ":");
  if (!/^(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(value)) {
    throw new Error("Adresse MAC invalide : format attendu AA:BB:CC:DD:EE:FF.");
  }
  return value.toUpperCase();
}

async function blockMac(rawMac) {
  const mac = normalizeMac(rawMac);
  await ensureBlockMode();
  const list = (await readMacFilters()).filter((x) => !sameMac(x.mac, mac));
  const base = { enableRule: true, enableLink: false, remark: "", mac };
  for (const ippro of ["IPV4", "IPV6"]) {
    if (!list.some((x) => sameMac(x.mac, mac) && x.ippro === ippro)) {
      list.push({ ...base, ippro });
    }
  }
  await saveMacFilters(list);

  // Vérifie que le routeur a vraiment enregistré la règle (il peut mettre un instant à l'appliquer).
  for (let attempt = 0; attempt < 2; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 800 : 2000));
    const after = await readMacFilters().catch(() => null);
    if (!after || after.some((x) => sameMac(x.mac, mac))) return;
  }
  throw new Error(
    "Le routeur n'a pas enregistré le blocage de cet appareil. Réessayez dans un instant."
  );
}

async function unblockMac(rawMac) {
  const mac = normalizeMac(rawMac);
  const list = await readMacFilters();
  await saveMacFilters(list.filter((x) => !sameMac(x.mac, mac)));
}

// ---------- minuteur (côté app) ----------
async function powerOffNow() {
  await updateBand(commandFor("WIFI_24"), { wifiOpen: "0" }, false);
}

async function clearTimer() {
  if (timerHandle) clearTimeout(timerHandle);
  timerHandle = null;
  await AsyncStorage.removeItem("timerOffAt");
}

// Le minuteur ne peut agir que si l'app tourne et que le téléphone est sur le wifi du routeur.
// Si la coupure échoue, le minuteur est CONSERVÉ et réessayé. Un minuteur dépassé de plus de
// 2 h est abandonné sans couper (sinon le wifi serait coupé au réveil, à l'ouverture de l'app).
const TIMER_MAX_LATE_MS = 2 * 60 * 60 * 1000;
let timerListener = null;
export const setTimerListener = (fn) => { timerListener = fn; };

async function processDueTimer() {
  const at = await AsyncStorage.getItem("timerOffAt");
  if (!at) return "none";
  const due = new Date(at).getTime();
  if (Number.isNaN(due)) { await clearTimer(); return "none"; }
  const late = Date.now() - due;
  if (late < -1000) return "pending";
  if (late > TIMER_MAX_LATE_MS) {
    await clearTimer();
    if (timerListener) timerListener("expired");
    return "expired";
  }
  try {
    await powerOffNow();
  } catch (_) {
    return "failed";
  }
  await clearTimer();
  if (timerListener) timerListener("fired");
  return "fired";
}

function scheduleTimerAttempt(delayMs, attempt = 0) {
  timerHandle = setTimeout(async () => {
    timerHandle = null;
    const state = await processDueTimer().catch(() => "failed");
    if (state === "failed" && attempt < 5) scheduleTimerAttempt(30000, attempt + 1);
  }, delayMs);
}

async function saveRouterPassword(password) {
  await AsyncStorage.setItem("routerPassword", String(password));
  session = { id: "", token: "" };
}

async function detectRouter() {
  console.log("=== ROUTER DETECTION ===");
  console.log("numericMode:", numericMode);
  await ensureSession();
  const result = { numericMode, init: {}, device: {}, model: "ZLT", firmware: "", board: "" };
  try { result.init = await get(CMD_DETECT.INIT); } catch (_) {}
  try { result.device = await get(CMD_DETECT.DEVICE_INFO); } catch (_) {}
  const d = result.device || {};
  result.model = d.device_maker || d.board_type || d.idu_dev_type || d.model || "ZLT";
  result.firmware = d.fake_version || d.hwversion || d.hw_version || d.version || "";
  result.board = d.board_type || "";
  return result;
}
// ---------- API (même interface qu'avant) ----------
export const api = {
  login: async () => ({ ok: true }),

  // Enregistre le mot de passe admin du routeur et vérifie qu'il est accepté.
  setRouterPassword: async (password) => {
    if (!password) throw new Error("Saisissez le mot de passe admin du routeur.");
    await saveRouterPassword(password);
    await login();
    return { ok: true };
  },

  checkTimer: async () => processDueTimer(),

  getRouters: async () => {
    await ensureSession();
    const detection = await detectRouter();
    console.log("MODEL:", detection.model);
    console.log("FIRMWARE:", detection.firmware);
    console.log("BOARD:", detection.board);
    console.log("NUMERIC_MODE:", detection.numericMode);
    const info = await get(commandFor("INFO"));
    if (numericMode) { const d = await get(113).catch(() => ({})); info.realDevice5g = d.idu_dev_type || "ZLT"; }
    const w24 = await get(commandFor("WIFI_24"), { subcmd: 0, ...wifiFlags() });
    const w5 = await get(commandFor("WIFI_5"), { subcmd: 0, ...wifiFlags() });

    // Si un minuteur a expiré pendant que l'app était fermée, on coupe maintenant.
    let timerOffAt = await AsyncStorage.getItem("timerOffAt");
    const timerState = await processDueTimer();
    if (timerState === "fired") {
      timerOffAt = null;
      w24.wifiOpen = "0";
    } else if (timerState === "expired" || timerState === "none") {
      timerOffAt = null;
    }

    return [
      {
        id: 1,
        model: detection.model || info.realDevice5g || "ZLT",
        firmware: detection.firmware,
        board: detection.board,
        numeric_mode: detection.numericMode,
        label: info.lanIp || "192.168.1.1",
        timer_off_at: timerOffAt,
        wifi_on: w24.wifiOpen === "1",
        ssid: decodeSsid(w24 && w24.ssid),
        password: decodeKey(w24 && w24.key),
        visible: !w5 || w5.broadcast !== "0",
        parent_ssid: decodeSsid(w5 && w5.ssid),
        parent_password: decodeKey(w5 && w5.key),
        // Renseigné quand le routeur n'a pas fourni la configuration wifi (pour comprendre pourquoi).
        wifi_error:
          !w24 || w24.success === false || (!w24.ssid && !w24.key)
            ? `Configuration wifi non fournie par le routeur (${describeReply(w24)})`
            : null,
      },
    ];
  },

  getDevices: async () => {
    const r = await get(commandFor("CLIENTS"));
    const wlan = Array.isArray(r.wlan24g_wifi_info) ? r.wlan24g_wifi_info : [];
    const wlan5 = Array.isArray(r.wlan5g_wifi_info) ? r.wlan5g_wifi_info : [];
    const radio = [...wlan, ...wlan5];
    const list = Array.isArray(r.dhcp_list_info) ? r.dhcp_list_info : [];
    return list.map((d) => {
      const w = radio.find((x) => (x.mac || "").toLowerCase() === (d.mac || "").toLowerCase());
      const name = d.hostname || (w && w.user) || d.mac;
      return {
        mac: d.mac,
        ip: d.ip,
        name,
        hostname: name,
        label: name,
        interface: d.interface,
        rssi: w ? w.rssi : null,
        daily_limit_minutes: null,
      };
    });
  },

  kickDevice: async (routerId, mac, name) => {
    await blockMac(mac);
    try {
      const names = JSON.parse((await AsyncStorage.getItem("blockedNames")) || "{}");
      names[String(mac).toLowerCase()] = name || "";
      await AsyncStorage.setItem("blockedNames", JSON.stringify(names));
    } catch (_) {}
    return { ok: true };
  },
  unblockDevice: async (routerId, mac) => {
    await unblockMac(mac);
    return { ok: true };
  },
  getBlocked: async () => {
    const list = await readMacFilters();
    let names = {};
    try { names = JSON.parse((await AsyncStorage.getItem("blockedNames")) || "{}"); } catch (_) {}
    const macs = [...new Set(list.map((x) => x.mac))];
    return macs.map((mac) => ({ mac, name: names[String(mac).toLowerCase()] || "" }));
  },
  removeFromList: async () => {
    throw new Error(NOT_AVAILABLE);
  },
  setDeviceLimit: async () => {
    throw new Error(NOT_AVAILABLE);
  },

  setPower: async (routerId, enabled) => {
    // Seul le réseau principal (2,4 GHz) est coupé : le réseau parental (5 GHz) reste actif.
    await updateBand(commandFor("WIFI_24"), { wifiOpen: enabled ? "1" : "0" }, false);
    return { ok: true };
  },

  setSsid: async (routerId, ssid) => {
    if (!ssid || byteLength(ssid) > 30) {
      throw new Error("Le nom doit contenir entre 1 et 30 caractères (les lettres accentuées comptent double) pour réserver la place du suffixe 5G.");
    }
    // Relit le réseau pour savoir si le routeur attend le nom en base64 ou en clair.
    const current = await readBand(commandFor("WIFI_24"));
    if (current && current.ssid) decodeSsid(current.ssid);
    await updateBothBands(
      { ssid: encodeSsid(`${ssid}5G`) },
      { ssid: encodeSsid(ssid) }
    );
    return { ok: true };
  },

  setPassword: async (routerId, password) => {
    await updateBand(commandFor("WIFI_24"), { key: encodeKey(password) }, false);
    return { ok: true };
  },

  setParentPassword: async (routerId, password) => {
    await updateBand(commandFor("WIFI_5"), { key: encodeKey(password) }, true);
    return { ok: true };
  },

  setVisibility: async (routerId, visible) => {
    await updateBand(commandFor("WIFI_5"), { broadcast: visible ? "1" : "0" }, true);
    return { ok: true };
  },

  setTimer: async (routerId, minutes) => {
    await clearTimer();
    const offAt = new Date(Date.now() + minutes * 60000).toISOString();
    await AsyncStorage.setItem("timerOffAt", offAt);
    scheduleTimerAttempt(minutes * 60000);
    return { timer_off_at: offAt };
  },

  cancelTimer: async () => {
    await clearTimer();
    return { ok: true };
  },

  getSchedules: async () => [],
  createSchedule: async () => {
    throw new Error(NOT_AVAILABLE);
  },
  toggleSchedule: async () => {
    throw new Error(NOT_AVAILABLE);
  },

  getSupportContacts: async () => [],
};
