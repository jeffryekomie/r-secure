import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:4000"
).replace(/\/$/, "");

const TOKEN_KEY = "rconnect_client_token";
const DEVICE_ID_KEY = "rconnect_installation_id";
const VERIFIED_KEY = "rconnect_last_verified";
const GRACE_MS = 7 * 24 * 60 * 60 * 1000; // serveur injoignable : on tolère 7 jours

export async function getDeviceId() {
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    deviceId = Crypto.randomUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
}

async function request(path, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Erreur serveur (${response.status})`);
  }

  if (!data.token) {
    throw new Error("Le serveur n'a pas renvoyé de jeton.");
  }

  await AsyncStorage.setItem(TOKEN_KEY, data.token);
  await AsyncStorage.setItem(VERIFIED_KEY, String(Date.now()));
  return data;
}

export async function registerClient(
  name,
  phone,
  password,
  licenseCode
) {
  const deviceId = await getDeviceId();

  return request("/auth/register", {
    name,
    phone,
    password,
    licenseCode,
    deviceId,
  });
}

export async function loginClient(phone, password) {
  const deviceId = await getDeviceId();

  return request("/auth/login", {
    phone,
    password,
    deviceId,
  });
}

export async function getClientToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function logoutClient() {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(VERIFIED_KEY);
}

// Revalide la session et la licence auprès du serveur au lancement.
// "invalid" : session expirée, licence révoquée ou liée à un autre téléphone.
// "offline" : serveur injoignable ou ancien serveur : on ne bloque pas (délai de grâce de 7 jours).
export async function verifySession() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return { status: "invalid", message: "Veuillez vous reconnecter." };
  const deviceId = await getDeviceId();

  let response;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    response = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}`, "x-device-id": deviceId, Accept: "application/json" },
      signal: ctrl.signal,
    });
  } catch (_) {
    const last = Number(await AsyncStorage.getItem(VERIFIED_KEY)) || 0;
    if (!last) {
      await AsyncStorage.setItem(VERIFIED_KEY, String(Date.now()));
      return { status: "offline" };
    }
    if (Date.now() - last > GRACE_MS) {
      return {
        status: "invalid",
        message: "Votre licence n'a pas pu être revalidée depuis plus de 7 jours. Connectez-vous à Internet puis reconnectez-vous.",
      };
    }
    return { status: "offline" };
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 || response.status === 403) {
    const data = await response.json().catch(() => ({}));
    return { status: "invalid", message: data.error || "Votre session n'est plus valide. Reconnectez-vous." };
  }
  if (response.ok) {
    await AsyncStorage.setItem(VERIFIED_KEY, String(Date.now()));
    return { status: "ok" };
  }
  return { status: "offline" };
}
