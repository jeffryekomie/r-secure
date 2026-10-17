import { getClientToken, getDeviceId } from "./auth";

const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:4000"
).replace(/\/$/, "");

export async function getReferralSummary() {
  const token = await getClientToken();
  const deviceId = await getDeviceId();

  if (!token) {
    throw new Error("Connecte-toi pour consulter ton parrainage.");
  }

  const response = await fetch(`${API_URL}/referral/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-device-id": deviceId,
      Accept: "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Erreur serveur (${response.status})`);
  }

  return data;
}
