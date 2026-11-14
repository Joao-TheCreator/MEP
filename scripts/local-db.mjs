// Postgres local para testar em qualquer computador, sem instalar nada.
// Uso (uma vez):  npm i --no-save embedded-postgres
// Depois:         node scripts/local-db.mjs   (deixe esta janela aberta; Ctrl+C para parar)
// .env.local:     DATABASE_URL=postgres://postgres:postgres@localhost:54329/sitio
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../.pgdata", import.meta.url));
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port: 54329, persistent: true });

const fresh = !existsSync(dir);
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase("sitio");
console.log("Postgres local rodando em postgres://postgres:postgres@localhost:54329/sitio (Ctrl+C para parar)");

const stop = async () => { await pg.stop(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
