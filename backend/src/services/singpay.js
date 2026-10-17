const axios = require("axios");

const BASE = process.env.SINGPAY_BASE_URL || "https://gateway.singpay.ga";
const headers = () => ({
  "Content-Type": "application/json",
  "x-client-id": process.env.SINGPAY_CLIENT_ID,
  "x-client-secret": process.env.SINGPAY_CLIENT_SECRET,
  "x-wallet": process.env.SINGPAY_WALLET_ID,
});

async function createPaymentLink({ reference, amount, successUrl, errorUrl }) {
  const r = await axios.post(
    `${BASE}/v1/ext`,
    {
      portefeuille: process.env.SINGPAY_WALLET_ID,
      reference,
      amount,
      redirect_success: successUrl,
      redirect_error: errorUrl,
      disbursement: process.env.SINGPAY_DISBURSEMENT_ID || undefined,
      isTransfer: false,
    },
    { headers: headers(), timeout: 15000 }
  );
  return r.data;
}

async function getStatusByReference(reference) {
  const r = await axios.get(
    `${BASE}/v1/transaction/api/search/by-reference/${encodeURIComponent(reference)}`,
    { headers: headers(), timeout: 15000 }
  );
  return r.data;
}

module.exports = { createPaymentLink, getStatusByReference };
