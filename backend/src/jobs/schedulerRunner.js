const cron = require("node-cron");
const db = require("../db");
const acs = require("../services/localRouterApi");
const logic = require("./schedulerLogic");

async function runRecurringSchedules(currentDay, currentTime) {
  const schedules = db.prepare("SELECT * FROM schedules WHERE enabled = 1").all();
  for (const s of schedules) {
    const r = db.prepare("SELECT * FROM routers WHERE id = ?").get(s.router_id);
    if (!r) continue;
    try {
      if (logic.scheduleShouldTurnOff(s, currentDay, currentTime)) await acs.setWifiEnabled(r, false);
      else if (logic.scheduleShouldTurnOn(s, currentDay, currentTime)) await acs.setWifiEnabled(r, true);
    } catch (e) {
      console.error(`[scheduler] Créneau "${s.label}" — routeur ${r.id} :`, e.message);
    }
  }
}

async function runOneOffTimers(nowIso) {
  const routers = db.prepare("SELECT * FROM routers WHERE timer_off_at IS NOT NULL").all();
  for (const r of routers) {
    if (!logic.isTimerDue(r.timer_off_at, nowIso)) continue;
    try {
      await acs.setWifiEnabled(r, false);
      db.prepare("UPDATE routers SET timer_off_at = NULL WHERE id = ?").run(r.id);
      console.log(`[scheduler] Minuteur écoulé — wifi coupé, routeur ${r.id}`);
    } catch (e) {
      console.error(`[scheduler] Échec minuteur — routeur ${r.id} :`, e.message);
    }
  }
}

async function resetStaleDailyCounters(today) {
  const all = db.prepare("SELECT * FROM known_devices WHERE usage_date IS NOT NULL").all();
  for (const d of all) {
    if (!logic.isStaleForNewDay(d, today)) continue;

    const shouldUnblock = logic.shouldAutoUnblockOnReset(d); // jamais vrai pour un kick manuel
    db.prepare(
      `UPDATE known_devices SET minutes_used_today = 0, usage_date = ?, blocked = ?, block_reason = ?
       WHERE id = ?`
    ).run(today, shouldUnblock ? 0 : d.blocked, shouldUnblock ? null : d.block_reason, d.id);

    if (shouldUnblock) {
      const r = db.prepare("SELECT * FROM routers WHERE id = ?").get(d.router_id);
      if (r) {
        try {
          await acs.unblockDeviceByMac(r, d.mac);
        } catch (e) {
          console.error(`[scheduler] Déblocage quotidien échoué — routeur ${r.id}, ${d.mac} :`, e.message);
        }
      }
    }
  }
}

async function trackDailyLimits(today) {
  const routersWithLimits = db
    .prepare("SELECT DISTINCT router_id FROM known_devices WHERE daily_limit_minutes IS NOT NULL AND blocked = 0")
    .all();

  for (const { router_id } of routersWithLimits) {
    const r = db.prepare("SELECT * FROM routers WHERE id = ?").get(router_id);
    if (!r) continue;

    let connected;
    try {
      connected = await acs.listConnectedDevices(r);
    } catch (e) {
      console.error(`[scheduler] Lecture appareils échouée — routeur ${r.id} :`, e.message);
      continue;
    }
    const connectedMacs = new Set(connected.map((d) => d.mac));

    const limited = db
      .prepare("SELECT * FROM known_devices WHERE router_id = ? AND daily_limit_minutes IS NOT NULL AND blocked = 0")
      .all(router_id);

    for (const d of limited) {
      if (!connectedMacs.has(d.mac)) continue;
      const { minutesUsed, limitReached } = logic.computeUsageIncrement(d, today);

      if (limitReached) {
        try {
          await acs.blockDeviceByMac(r, d.mac);
          db.prepare(
            "UPDATE known_devices SET minutes_used_today = ?, usage_date = ?, blocked = 1, block_reason = 'limit' WHERE id = ?"
          ).run(minutesUsed, today, d.id);
          console.log(`[scheduler] Limite atteinte pour ${d.mac} — bloqué (routeur ${r.id})`);
        } catch (e) {
          console.error(`[scheduler] Blocage limite échoué — routeur ${r.id}, ${d.mac} :`, e.message);
        }
      } else {
        db.prepare("UPDATE known_devices SET minutes_used_today = ?, usage_date = ? WHERE id = ?").run(
          minutesUsed,
          today,
          d.id
        );
      }
    }
  }
}

function startScheduler() {
  cron.schedule("* * * * *", async () => {
    const now = new Date();
    const currentDay = logic.dayCodeFromDate(now);
    const currentTime = logic.timeStringFromDate(now);
    const today = logic.dateStringFromDate(now);

    await runRecurringSchedules(currentDay, currentTime);
    await runOneOffTimers(now.toISOString());
    await resetStaleDailyCounters(today);
    await trackDailyLimits(today);
  });
}

module.exports = { startScheduler };
