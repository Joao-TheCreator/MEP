// Development only: creates a demo farm with the whole group so every screen
// has something to show. Each demo person logs in with the name "<avatar-key>" and the password "<avatar-key>123".
//
//   npm run db:seed            (uses DATABASE_URL from the environment / .env.local)
//
// Re-running it resets the demo farm (invite code DEMO01). It refuses to run
// against a non-local database unless SEED_FORCE=1.
import { randomBytes, scryptSync } from "node:crypto";
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

// Same format as hashPassword in src/server/password.ts (keep in sync).
const hashPassword = (password) => {
  const salt = randomBytes(16);
  const key = scryptSync(password.normalize("NFC"), salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", 16384, 8, 1, salt.toString("base64url"), key.toString("base64url")].join("$");
};
const demoPassword = (key) => `${key}123`;

// People and resource points live in seed-data.json; src/game/seed-data.test.ts
// checks them against AVATARS (src/art/avatars.ts) and RESOURCES (src/game/config.ts).
const DATA = JSON.parse(readFileSync(new URL("./seed-data.json", import.meta.url), "utf8"));
const PEOPLE = DATA.people.map((p) => [p.key, p.name]);
const POINTS = DATA.points;
const PROFESSIONS = ["carpenter", "farmer", "rancher", "blacksmith"];
// Some variety for the hero and night screens (design §15): XP and gear kept from "earlier seasons".
const XP = [120, 900, 2400, 400, 5200, 60, 1500, 3100];
const GEAR = [
  {},
  { weapon: { tier: "bronze", refine: 0 } },
  { weapon: { tier: "iron", refine: 2 }, body: { tier: "bronze", refine: 0 } },
  { weapon: { tier: "silver", refine: 1 }, body: { tier: "iron", refine: 0 }, tool: { tier: "bronze", refine: 0 } },
];
// A few found items in some backpacks (design §21), to try equipping and dismantling.
const BAGS = [
  [{ slot: "hat", tier: "bronze", refine: 0 }, { slot: "weapon", tier: "iron", refine: 1 }, { slot: "body", tier: "bronze", refine: 0 }],
  [],
  [{ slot: "feet", tier: "bronze", refine: 0 }, { slot: "pin", tier: "iron", refine: 0 }],
  [{ slot: "weapon", tier: "bronze", refine: 0 }],
];
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
        INSERT INTO users (email, username, password_hash) VALUES (${key + "@demo.local"}, ${key}, ${hashPassword(demoPassword(key))})
        RETURNING id`;
      const hoursAgo = 1 + (i * 37) % 9; // varied pending production, some storages full
      const [player] = await tx`
        INSERT INTO players (user_id, farm_id, display_name, avatar, profession, workshop_level, last_collected_at,
                             xp, gear, night_class, bag)
        VALUES (${user.id}, ${farm.id}, ${name}, ${key}, ${profession}, ${1 + (i % 3)},
                now() - make_interval(hours => ${hoursAgo}),
                ${XP[i % XP.length]}, ${tx.json(GEAR[i % GEAR.length])}, ${["volley", "volley", "volley", "mattress", "guitar", "cook", "lantern"][i % 7]},
                ${tx.json(BAGS[i % BAGS.length].map((it, j) => ({ id: `seed-${i}-${j}`, ...it })))})
        RETURNING id`;
      // everyone gets some planks, bars and tools too, to try the gear upgrades
      const bag = { ...STARTER[profession], plank: (STARTER[profession].plank ?? 0) + 25, iron_bar: (STARTER[profession].iron_bar ?? 0) + 12, tool: (STARTER[profession].tool ?? 0) + 2 };
      for (const [resource, qty] of Object.entries(bag)) {
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
  console.log("Log in at http://localhost:3000/login with any of these names and passwords:");
  console.log(PEOPLE.map(([key, name]) => `  ${name.padEnd(15)} nome ${key.padEnd(15)} senha ${demoPassword(key)}`).join("\n"));
} finally {
  await sql.end();
}
