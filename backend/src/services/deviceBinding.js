// Décide quoi faire quand un client connecté présente un identifiant de téléphone.
//  - licence sans téléphone lié      -> "bind"   (premier téléphone)
//  - même téléphone                  -> "ok"
//  - autre téléphone, quota restant  -> "rebind" (le client a réinstallé l'app / changé de téléphone)
//  - autre téléphone, quota épuisé   -> "deny"
// Le quota ne limite que le changement en libre-service : « reset-device » côté admin reste possible.
function decideDeviceBinding({ boundDeviceId, deviceId, changesInWindow = 0, max = 0 }) {
  const dev = String(deviceId || "");
  if (!dev) return { action: "deny", reason: "NO_DEVICE" };
  if (!boundDeviceId) return { action: "bind" };
  if (boundDeviceId === dev) return { action: "ok" };
  if (max > 0 && changesInWindow < max) return { action: "rebind" };
  return { action: "deny", reason: max > 0 ? "REBIND_LIMIT" : "DEVICE_MISMATCH" };
}

module.exports = { decideDeviceBinding };
