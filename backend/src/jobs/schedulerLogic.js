/**
 * Fonctions pures extraites du scheduler pour pouvoir les tester automatiquement
 * sans dépendre de la base de données, du réseau ou de l'horloge système.
 */

const DAY_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function dayCodeFromDate(date) {
  return DAY_CODES[date.getDay()];
}

function timeStringFromDate(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function dateStringFromDate(date) {
  return date.toISOString().slice(0, 10);
}

/** Un créneau récurrent doit-il couper le wifi à cette minute précise ? */
function scheduleShouldTurnOff(schedule, currentDay, currentTime) {
  if (!schedule.enabled) return false;
  const days = schedule.days.split(",").map((d) => d.trim());
  return days.includes(currentDay) && schedule.start_time === currentTime;
}

/** Un créneau récurrent doit-il rallumer le wifi à cette minute précise ? */
function scheduleShouldTurnOn(schedule, currentDay, currentTime) {
  if (!schedule.enabled) return false;
  const days = schedule.days.split(",").map((d) => d.trim());
  return days.includes(currentDay) && schedule.end_time === currentTime;
}

/** Le minuteur ponctuel d'un routeur est-il arrivé à échéance ? */
function isTimerDue(timerOffAtIso, nowIso) {
  if (!timerOffAtIso) return false;
  return timerOffAtIso <= nowIso;
}

/**
 * Calcule le nouveau compteur de minutes utilisées pour un appareil limité,
 * en tenant compte du changement de jour. Fonction pure : ne touche à rien,
 * se contente de calculer le résultat attendu.
 */
function computeUsageIncrement(device, today) {
  const baseMinutes = device.usage_date === today ? device.minutes_used_today : 0;
  const minutesUsed = baseMinutes + 1;
  const limitReached = minutesUsed >= device.daily_limit_minutes;
  return { minutesUsed, limitReached };
}

/**
 * Un appareil doit-il être remis à zéro / débloqué car on a changé de jour ?
 * IMPORTANT : ne concerne QUE les blocages dus à une limite quotidienne
 * (block_reason === "limit"). Un kick manuel (block_reason === "manual")
 * ne doit JAMAIS être levé automatiquement par ce mécanisme.
 */
function isStaleForNewDay(device, today) {
  return device.usage_date != null && device.usage_date !== today;
}

function shouldAutoUnblockOnReset(device) {
  return !!device.blocked && device.block_reason === "limit";
}

module.exports = {
  DAY_CODES,
  dayCodeFromDate,
  timeStringFromDate,
  dateStringFromDate,
  scheduleShouldTurnOff,
  scheduleShouldTurnOn,
  isTimerDue,
  computeUsageIncrement,
  isStaleForNewDay,
  shouldAutoUnblockOnReset,
};
