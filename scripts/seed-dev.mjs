// Development only: creates a demo farm with the whole group so every screen
// has something to show. Each demo person logs in with the password "<avatar-key>123".
//
//   npm run db:seed            (uses DATABASE_URL from the environment / .env.local)
//
// Re-running it resets the demo farm (invite code DEMO01). It refuses to run
// against a non-local database unless SEED_FORCE=1.
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(host) && process.env.SEED_FORCE !== "1") {
  console.error(`Refusing to seed non-local database (${host}). Set SEED_FORCE=1 to override.`);
  process.exit(1);
}

// Same as passwordLookup/authSecret in src/server/password.ts (keep in sync).
const SECRET = process.env.AUTH_SECRET?.length >= 16 ? process.env.AUTH_SECRET : "dev-only-secret-change-me";
const lookup = (password) => createHmac("sha256", SECRET).update(password.normalize("NFC")).digest("hex");
const demoPassword = (key) => `${key}123`;

// People and resource points live in seed-data.json; src/game/seed-data.test.ts
// checks them against AVATARS (src/art/avatars.ts) and RESOURCES (src/game/config.ts).
const DATA = JSON.parse(readFileSync(new URL("./seed-data.json", import.meta.url), "utf8"));
const PEOPLE = DATA.people.map((p) => [p.key, p.name]);
const POINTS = DATA.points;
const PROFESSIONS = ["carpenter", "farmer", "rancher", "blacksmith"];
const STARTER = {
  farmer: { grain: 240, feed: 12 },
  rancher: { milk: 120, cheese: 8 },
  carpenter: { wood: 220, plank: 30 },
  blacksmith: { ore: 110, iron_bar: 10, tool: 3 },
};

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await sql.begin(async (tx) => {
    await tx`DELETE FROM farms WHERE invite_code = 'DEMO01'`;
    await tx`DELETE FROM users WHERE email LIKE '%@demo.local'`;
    const [farm] = await tx`
      INSERT INTO farms (name, invite_code) VALUES ('Sítio Dae Han', 'DEMO01') RETURNING id`;

    for (let i = 0; i < PEOPLE.length; i++) {
      const [key, name] = PEOPLE[i];
      const profession = PROFESSIONS[i % PROFESSIONS.length];
      const [user] = await tx`
        INSERT INTO users (email, password_lookup) VALUES (${key + "@demo.local"}, ${lookup(demoPassword(key))})
        RETURNING id`;
      const hoursAgo = 1 + (i * 37) % 9; // varied pending production, some storages full
      const [player] = await tx`
        INSERT INTO players (user_id, farm_id, display_name, avatar, profession, workshop_level, last_collected_at)
        VALUES (${user.id}, ${farm.id}, ${name}, ${key}, ${profession}, ${1 + (i % 3)},
                now() - make_interval(hours => ${hoursAgo}))
        RETURNING id`;
      for (const [resource, qty] of Object.entries(STARTER[profession])) {
        await tx`INSERT INTO inventory (player_id, resource, qty) VALUES (${player.id}, ${resource}, ${qty})`;
      }
      // a few donations this week toward the well, so the ranking has movement
      const gift = { carpenter: ["wood", 20 + i * 3], farmer: ["grain", 15 + i * 2], rancher: null, blacksmith: ["ore", 8 + i] }[profession];
      if (gift && i % 5 !== 4) {
        const [resource, qty] = gift;
        await tx`
          INSERT INTO donations (farm_id, player_id, resource, qty, points, created_at)
          VALUES (${farm.id}, ${player.id}, ${resource}, ${qty}, ${qty * POINTS[resource]},
                  now() - make_interval(hours => ${i}))`;
        await tx`
          INSERT INTO farm_building_progress (farm_id, resource, qty) VALUES (${farm.id}, ${resource}, ${qty})
          ON CONFLICT (farm_id, resource) DO UPDATE SET qty = farm_building_progress.qty + EXCLUDED.qty`;
      }
    }
  });

  console.log(`Demo farm ready: ${PEOPLE.length} moradores, invite code DEMO01.`);
  console.log("Log in at http://localhost:3000/login with any of these passwords:");
  console.log(PEOPLE.map(([key, name]) => `  ${name.padEnd(15)} ${demoPassword(key)}`).join("\n"));
} finally {
  await sql.end();
}
