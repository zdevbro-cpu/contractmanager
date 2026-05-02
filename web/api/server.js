import express from "express";

const app = express();
const port = Number(process.env.API_PORT || 8787);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "account-verify-api" });
});

// Demo verification API.
// Replace this logic with real bank/open-banking integration in production.
app.post("/api/account/verify", (req, res) => {
  const { bankName, accountNo, ownerName } = req.body ?? {};

  if (!bankName || !accountNo || !ownerName) {
    return res.status(400).json({
      exists: false,
      ownerMatch: false,
      message: "bankName, accountNo, ownerName are required."
    });
  }

  const normalizedAccount = String(accountNo).replace(/[^\d]/g, "");
  const normalizedOwner = String(ownerName).trim();

  // Basic "account existence" rule for demo:
  // - At least 10 digits and not all zeros
  const exists =
    normalizedAccount.length >= 10 &&
    !/^0+$/.test(normalizedAccount);

  if (!exists) {
    return res.json({
      exists: false,
      ownerMatch: false,
      message: "실계좌 미존재"
    });
  }

  // Demo owner lookup table by last 2 digits.
  const ownerMap = {
    "00": "김영수",
    "01": "박지민",
    "02": "이서연",
    "03": "정우진",
    "04": "한지훈",
    "05": "최유리",
    "06": "강민호",
    "07": "윤지혜",
    "08": "임재현",
    "09": "송아름"
  };

  const suffix = normalizedAccount.slice(-2);
  const actualOwnerName = ownerMap[suffix] ?? normalizedOwner;
  const ownerMatch = actualOwnerName === normalizedOwner;

  return res.json({
    exists: true,
    ownerMatch,
    ownerName: actualOwnerName,
    message: ownerMatch ? "실명 일치" : "예금주 불일치"
  });
});

app.listen(port, () => {
  console.log(`[account-verify-api] listening on http://127.0.0.1:${port}`);
});

