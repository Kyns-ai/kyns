const mongoose = require('mongoose');

let maintenanceMode = false;
let maintenanceMessage = 'O sistema esta em manutencao. Voltamos em breve!';
let lastCheck = 0;
const CHECK_INTERVAL_MS = 30_000;

async function refreshMaintenanceFlag() {
  const now = Date.now();
  if (now - lastCheck < CHECK_INTERVAL_MS) return;
  lastCheck = now;
  try {
    const db = mongoose.connection?.db;
    if (!db) return;
    const doc = await db.collection('kyns_config').findOne({ key: 'maintenanceMode' });
    maintenanceMode = doc?.value === true;
    const msgDoc = await db.collection('kyns_config').findOne({ key: 'maintenanceMessage' });
    if (msgDoc?.value) maintenanceMessage = String(msgDoc.value);
  } catch {
    // Fail open — if we can't read the flag, don't block users
  }
}

const checkMaintenance = async (req, res, next) => {
  await refreshMaintenanceFlag();
  if (!maintenanceMode) return next();

  // Allow health check and auth routes even during maintenance
  const path = req.originalUrl || req.url;
  if (path === '/health' || path.startsWith('/api/auth')) return next();

  return res.status(503).json({ message: maintenanceMessage });
};

module.exports = checkMaintenance;
