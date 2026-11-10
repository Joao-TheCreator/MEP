// Development only: creates a demo farm with the whole group so every screen
// has something to show, and prints a one-click login link.
//
//   npm run db:seed            (uses DATABASE_URL from the environment / .env.local)
//
// Re-running it resets the demo farm (invite code DEMO01). It refuses to run
// against a non-local database unless SEED_FORCE=1.
import { createHash, randomBytes } from "node:crypto";
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

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const LOGIN_AS = process.env.SEED_LOGIN ?? "joao-pedro";
const hash = (t) => createHash("sha256").update(t).digest("hex");

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
  const link = await sql.begin(async (tx) => {
    await tx`DELETE FROM farms WHERE invite_code = 'DEMO01'`;
    await tx`DELETE FROM users WHERE email LIKE '%@demo.local'`;
    const [farm] = await tx`
      INSERT INTO farms (name, invite_code) VALUES ('Sítio Dae Han', 'DEMO01') RETURNING id`;

    for (let i = 0; i < PEOPLE.length; i++) {
      const [key, name] = PEOPLE[i];
      const profession = PROFESSIONS[i % PROFESSIONS.length];
      const [user] = await tx`INSERT INTO users (email) VALUES (${key + "@demo.local"}) RETURNING id`;
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

    const token = randomBytes(32).toString("base64url");
    await tx`
      INSERT INTO login_tokens (token_hash, email, expires_at)
      VALUES (${hash(token)}, ${LOGIN_AS + "@demo.local"}, now() + interval '7 days')`;
    return `${APP_URL}/auth/verify?token=${token}`;
  });

  console.log(`Demo farm ready: ${PEOPLE.length} moradores, invite code DEMO01.`);
  console.log(`Login as ${LOGIN_AS} (valid 7 days, single use):\n${link}`);
  console.log(`Other people: SEED_LOGIN=<avatar-key> npm run db:seed`);
} finally {
  await sql.end();
}
