#!/usr/bin/env node

/**
 * Remove ban(s) from the rate-limiter / violation system.
 * Bans are stored in MongoDB collection "logs" with key prefix "BANS:".
 *
 * Usage:
 *   node config/unban.js --email user@example.com   # unban by user email
 *   node config/unban.js --user <userId>            # unban by MongoDB user _id
 *   node config/unban.js --ip <ip>                  # unban by IP
 *   node config/unban.js --all                      # remove all bans
 *
 * Requires MONGO_URI in .env (project root).
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const BAN_KEY_PREFIX = 'BANS:';
const LOGS_COLLECTION = 'logs';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { email: null, user: null, ip: null, all: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      out.email = args[i + 1];
      i++;
    } else if (args[i] === '--user' && args[i + 1]) {
      out.user = args[i + 1];
      i++;
    } else if (args[i] === '--ip' && args[i + 1]) {
      out.ip = args[i + 1];
      i++;
    } else if (args[i] === '--all') {
      out.all = true;
    }
  }
  return out;
}

async function main() {
  const { email, user, ip, all } = parseArgs();
  const hasTarget = email || user || ip || all;
  if (!hasTarget) {
    console.error('Usage: node config/unban.js --email <email> | --user <userId> | --ip <ip> | --all');
    process.exit(1);
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not set in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const logs = db.collection(LOGS_COLLECTION);

  let deletedCount = 0;

  try {
    if (all) {
      const result = await logs.deleteMany({ key: new RegExp(`^${BAN_KEY_PREFIX}`) });
      deletedCount = result.deletedCount ?? 0;
      console.log(`Removed ${deletedCount} ban(s) (all BANS:* keys).`);
      return;
    }

    if (user) {
      const key = BAN_KEY_PREFIX + user;
      const result = await logs.deleteMany({ key });
      deletedCount = result.deletedCount ?? 0;
      console.log(`Removed ${deletedCount} ban(s) for user id ${user}.`);
      return;
    }

    if (ip) {
      const key = BAN_KEY_PREFIX + ip;
      const result = await logs.deleteMany({ key });
      deletedCount = result.deletedCount ?? 0;
      console.log(`Removed ${deletedCount} ban(s) for IP ${ip}.`);
      return;
    }

    if (email) {
      const users = db.collection('users');
      const u = await users.findOne({ email: email.trim() }, { projection: { _id: 1 } });
      if (!u) {
        console.error(`No user found with email: ${email}`);
        process.exit(1);
      }
      const userId = u._id.toString();
      const key = BAN_KEY_PREFIX + userId;
      const result = await logs.deleteMany({ key });
      deletedCount = result.deletedCount ?? 0;
      console.log(`Removed ${deletedCount} ban(s) for ${email} (${userId}).`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
