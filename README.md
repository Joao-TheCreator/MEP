# Sítio Dae Han 🔥

Jogo **idle cooperativo** (PWA mobile-first) para o grupo cuidar de um sítio
compartilhado. Cada pessoa tem uma profissão que produz recursos com o tempo,
inclusive offline. Todo mundo doa para construções coletivas que sobem o nível do
sítio, e há um ranking semanal de contribuição.

- Design do jogo e números: [`docs/design.md`](docs/design.md)
- Identidade visual: [`docs/visual-identity.md`](docs/visual-identity.md) — guia vivo em `/art`
- Regras de colaboração (leia antes de mexer!): [`CLAUDE.md`](CLAUDE.md)

## Rodando localmente

Requisitos: Node 20+ e um Postgres.

```bash
npm install
cp .env.example .env.local   # ajuste DATABASE_URL
npm run db:migrate
npm run db:seed    # opcional: sítio de demonstração + link de login
npm run dev
```

Abra http://localhost:3000. Sem `RESEND_API_KEY`, o link mágico aparece na
própria tela de login (e no console do servidor).

## Deploy na Vercel

1. Importe o repositório na Vercel.
2. Crie um banco (Neon pela integração da Vercel) e configure `DATABASE_URL`
   (URL *pooled*), `APP_URL`, `RESEND_API_KEY` e `EMAIL_FROM`.
3. Rode as migrações apontando para o banco de produção:
   `DATABASE_URL=... npm run db:migrate`.

## Scripts

| Comando | O quê |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm test` | testes (lógica do jogo, semana do ranking, sprites) |
| `npm run lint` | checagem de tipos |
| `npm run build` | build de produção |
| `npm run db:migrate` | aplica `db/migrations/*.sql` pendentes |
| `npm run db:seed` | sítio de demonstração com os 20 moradores (só banco local) |

## Estrutura

```
src/game/      regras puras + balanceamento (config.ts) — testadas
src/server/    banco, auth (link mágico), ações do jogo com transações
src/app/       páginas (Next.js App Router) e Server Actions
src/art/       paleta, sprites, mapa e bonecos em pixel art
src/components UI do jogo
db/migrations  SQL versionado (nunca editar um já commitado)
docs/          design e identidade visual
```
