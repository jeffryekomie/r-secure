require("dotenv").config();
require("./config").validateEnv();
const pkg = require("../package.json");
const startedAt = new Date().toISOString();
const express = require("express");
const path = require("path");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const routerRoutes = require("./routes/routers");
const deviceRoutes = require("./routes/devices");
const scheduleRoutes = require("./routes/schedules");
const supportRoutes = require("./routes/support");
const adminRoutes = require("./routes/admin");
const adminReferralReportRoutes = require("./routes/admin-referral-report");
const referralRoutes = require("./routes/referral");
const referralWithdrawalRoutes = require("./routes/referral-withdrawals");
const adminWithdrawalRoutes = require("./routes/admin-withdrawals");
const paymentsRoutes = require("./routes/payments");
const licenseRoutes = require("./routes/license");
const { startScheduler } = require("./jobs/schedulerRunner");

// Met les anciens numéros de téléphone au format normalisé (une seule fois, sans effet ensuite).
require("./services/identity").migrateClientPhones(require("./db"));

const app = express();
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true, version: pkg.version, startedAt }));

app.use("/auth", authRoutes);
app.use("/routers", routerRoutes);
app.use("/routers", deviceRoutes);
app.use("/routers", scheduleRoutes);
app.use("/support", supportRoutes);
app.use("/admin", adminRoutes);
app.use("/admin/referrals", adminReferralReportRoutes);

// Interface d'administration des paiements.
app.get("/admin-ui", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin-ui/index.html"));
});
app.get("/admin-ui/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin-ui/index.html"));
});
app.use("/referral", referralRoutes);
app.use("/referral/withdrawals", referralWithdrawalRoutes);
app.use("/admin/withdrawals", adminWithdrawalRoutes);
app.use("/payments", paymentsRoutes);
app.use("/license", licenseRoutes);
app.use("/aide", express.static(path.join(__dirname, "../public/aide")));
app.get("/buy", (req, res) => res.redirect("/payments/buy" + req.url.slice(4)));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`RTL Connect API démarrée sur le port ${PORT}`);
  startScheduler();
});
