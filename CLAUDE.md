# Sítio Idle — memória do projeto

Jogo IDLE cooperativo (PWA mobile-first) para um grupo de amigos da igreja cuidar de
um sítio compartilhado — inspirado na **Chácara Coreana / Templo Dae Han**.
Projeto feito a **duas pessoas** (+ Claude). Leia este arquivo inteiro antes de mexer.

## Regras de colaboração (NÃO sobrescrever o trabalho do outro)

1. **Antes de começar qualquer coisa:** `git fetch origin && git status`. Se o branch
   remoto avançou, `git pull --rebase` antes de editar.
2. **Nunca trabalhe direto na `main`.** Um branch por tarefa (`feat/...`, `fix/...`,
   `art/...`), integrado via Pull Request revisado pelo outro.
3. **Nunca `git push --force`** em branch compartilhado. No próprio branch, só
   `--force-with-lease`.
4. **Nunca apagar/reescrever arquivo que você não criou** sem combinar. Em dúvida,
   crie um arquivo novo ou abra uma issue.
5. **Migrações de banco são imutáveis** depois de commitadas: nunca edite
   `db/migrations/NNN_*.sql` existente — crie a próxima (`NNN+1`). Numere olhando a
   `main` mais recente para não colidir com o branch do outro.
6. **Números de balanceamento** vivem só em `src/game/config.ts`; mudou lá, atualize
   `docs/design.md` **no mesmo commit** (os testes conferem as tabelas principais).
7. **Assets de arte** (`public/art/`, `src/art/`) — não substituir sprite de outra pessoa;
   adicione versão nova (`templo-v2`) e troque a referência no PR.
8. Antes de push: `npm run lint && npm test` (e `npm run build` se mexeu em páginas).
9. Commits pequenos e descritivos em português ou inglês; um assunto por commit.

## Convenções

- **Código, nomes de arquivo, tabelas e variáveis em inglês.**
- **Todo texto visível ao jogador em português do Brasil.**
- Toda regra de jogo roda **no servidor** (Server Actions + Postgres). O cliente só
  envia intenções e mostra estimativas. Produção offline = cálculo por timestamp
  (`src/game/rules.ts → computeProduction`), sem simulação contínua.
- Toda ação que altera estado usa `withFarmTx` (trava a linha do sítio `FOR UPDATE`).
- Lógica pura em `src/game/` (sem I/O, com testes Vitest). Acesso a banco em `src/server/`.

## Identidade visual (ver `docs/visual-identity.md`)

- Pixel art com textura suave (sem contornos pretos duros), fonte de pixel **fina**,
  aconchegante — referência de *clima*: jogos de fazenda pixelados. Arte 100% original.
- Paleta derivada da logo da igreja (chama vermelha/rosa + mão vinho) + verdes da mata
  e tijolo do templo.
- Lugar real: templo de tijolo aparente com arcos brancos e telhado cinza, piscina
  cercada, palmeiras e mata densa, casinhas de telhado laranja.

## Next.js 16

APIs mudaram (async `cookies()`/`searchParams`, Turbopack padrão, `proxy.ts` no lugar
de `middleware.ts`). Consulte `node_modules/next/dist/docs/` antes de usar uma API
(ver `AGENTS.md`, gerado pelo `next dev`).

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · Postgres (`postgres`) · Zod · Vitest.
Login por link mágico próprio (`src/server/auth.ts`), e-mail via Resend (opcional em dev).
Deploy na Vercel. Variáveis em `.env.example`.

## Comandos

- `npm run dev` · `npm test` · `npm run lint` · `npm run build`
- `npm run db:migrate` (precisa de `DATABASE_URL`)

## Pendências / próximos passos

- ✅ 20 bonecos pixelados feitos a partir das fotos (`src/art/avatars.ts`, ver `/art`).
  Fotos NÃO vão para o repositório. Diego = "Jondo", o líder (broche de chama).
- Balancear construções para ~20 jogadores (custos pensados para 4–6).
- Arquivo original da logo ainda precisa ser commitado em `public/brand/logo.png`.
- Pós-MVP: Cozinheiro, Comerciante, eventos semanais, push quando o armazém encher.
