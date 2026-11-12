# Sítio Dae Han — revisão do jogo, mecânicas novas e roadmap

## Contexto

O ciclo do jogo já está definido e jogável no branch `feat/mvp-cycle` (PR #27): **de dia**
o grupo produz, sobe o sítio e se equipa; **toda noite às 20h** a horda ataca a fogueira;
**se apagar, wipa tudo e só os itens ficam**.

O João pediu uma revisão para resolver três coisas:

1. **Rolê solo:** o jogador precisa ter o que fazer e progredir sozinho todo dia.
2. **Papel (role):** cada um precisa ter uma função clara no grupo, que mude o resultado.
3. **Menos dependência:** poder comprar o que falta num **mercado padrão do jogo**, sem
   depender tanto dos outros.

Decisões do João (respondidas agora):

| Pergunta | Decisão |
| --- | --- |
| "Ter role" | As duas coisas: atividades solo **e** papel no grupo |
| Mercado | **Moedas**; vende o que produz, compra na loja **bem mais caro** que trocar com amigo |
| O que a loja vende | **Só materiais** (recursos); equipamento continua sendo feito e refinado |
| Solo | Continua jogo de **grupo**, mas **ninguém trava** se os outros sumirem |

## Revisão: o que está fraco hoje

| # | Problema | Onde aparece |
| --- | --- | --- |
| 1 | **Dependência dura.** Melhorar e refinar equipamento custa só Tábua, Barra e Ferramenta (`GEAR.baseUpgradeCost`, `REFINE.costPerLevel`). Agricultor e Pecuarista não conseguem se equipar sozinhos, e o que eles fabricam (Ração, Queijo) quase só serve para obra. | `src/game/config.ts` |
| 2 | **Sítio trava** se faltar uma profissão (#10). A troca de profissão (#19) ajuda, mas custa caro e tem espera de 24 h. | `src/game/rules.ts` |
| 3 | **Classe da noite é enfeite.** Vôlei e Colchonete só mudam o nome da arma; a defesa é uma soma de números. Não existe "faltou tanque". | `src/game/night.ts → residentPower` |
| 4 | **A ronda não vale nada além de presença.** Jogar bem ou mal dá no mesmo; o resultado do minijogo não vai para o servidor. | `src/prototype/night/`, `patrolAction` |
| 5 | **Pouco rolê de dia.** Coletar, fabricar, doar. Sem meta pessoal, sem motivo para abrir a 2ª vez. | telas Oficina/Sítio |
| 6 | **Temporadas parecidas.** No simulador, grupo dedicado e devagar caem com 2–3 noites de diferença, e só existem 3 obras (sítio no máximo em 1 semana). | `npm run balance`, design §15.5 |
| 7 | **Energia definida e sem uso** (`ENERGY`: 100, +10/h). | `src/game/config.ts` |
| 8 | **Abas demais e em pé** (6 abas); o Rodrigo pediu horizontal (#22). | `src/components/Game.tsx` |

## O desenho novo (6 mudanças)

### A. Moedas e a Vendinha (mercado do jogo)

- **Moeda:** 1 moeda = 1 ponto de valor (os pontos de `RESOURCES` já existem).
- **Vender:** qualquer recurso, a **50%** do valor em pontos.
- **Comprar:** qualquer um dos 9 recursos, a **200%** do valor. Só materiais; nunca
  equipamento.
- Resultado: comprar na Vendinha custa **4× mais** do que trocar com um amigo (troca
  continua 1 por 1 e grátis). Dá para jogar sozinho; cooperar continua valendo muito.
- **Limite diário de compra** por pessoa (em pontos): `150 + 15 × nível`. Evita que
  alguém pule o jogo inteiro comprando.
- **Sem lucro infinito:** teste garante que, para toda receita, vender o produto rende
  menos do que custa comprar os insumos.
- **Wipe:** moedas **zeram** (só os itens ficam).
- Vender **não** dá XP nem conta no ranking; doar continua sendo o que vale.
- Resolve o #10: profissão em falta deixa de travar o sítio.

### B. Rolê solo: tarefas do dia, energia e ronda que rende

- **3 tarefas por dia**, sorteadas de forma fixa por pessoa e data (mesma semente = mesmas
  tarefas), ligadas à profissão e à classe. Exemplos: "Colete 200 Grãos", "Fabrique 10
  Rações", "Doe 50 pontos", "Faça a ronda", "Refine um item", "Venda 100 moedas".
  Recompensa: moedas + XP. Fazer as 3 dá um bônus.
- **Energia** (já existe na config): cada ronda gasta **30**. A 1ª do dia conta para a
  defesa; as outras são **expedições** opcionais, só por loot.
- **A ronda passa a valer:** as estrelas dão moedas e chance de **loot de material**
  (Tábua, Barra, Ferramenta e os outros), mais forte em noites altas. É outra fonte
  solo dos materiais que hoje só vêm de outra profissão.
- **Conferido no servidor:** o servidor sorteia a semente; o celular manda só os
  instantes em que o especial foi usado; o servidor **reexecuta** a simulação (ela já é
  determinística) e calcula estrelas e loot. Sem trapaça, como o resto do jogo.
- Cabe no orçamento do §14 (≤ 5 min/dia): tarefas se cumprem jogando normal; expedição
  é opcional.

### C. Papéis à noite (role de RPG)

As 5 classes já têm nome na config (`NIGHT_WEAPONS`). Cada uma vira um **papel com
efeito no grupo**, contado entre quem fez a ronda:

| Classe | Papel | Efeito na noite (por pessoa na ronda, com teto) |
| --- | --- | --- |
| Jogador de vôlei | Atirador | Maior força individual (dano) |
| Colchonete | Tanque | A fogueira perde **menos** vida do que passou da defesa |
| Violão | Suporte | Aumenta a força de **todos** que fizeram a ronda |
| Cozinheira | Cura | A fogueira **recupera mais** no dia seguinte |
| Lanterna | Batedor | Enfraquece a horda **e** aumenta o loot |

- Cada efeito tem **teto** (ex.: tanques cortam no máximo 40% do dano). Passou do teto,
  mais gente da mesma classe não ajuda: **time misto é melhor que 20 atiradores**. Teste
  trava isso.
- A tela da Noite mostra a **composição** de hoje e o que falta ("Sem tanque: a fogueira
  apanha cheio").
- Trocar de classe é livre de dia; fica travada depois que a pessoa fez a ronda.
- Entra em duas levas: primeiro **Atirador, Tanque e Suporte** (Violão usa o minijogo do
  Vôlei até ter o seu); depois Cozinheira e Lanterna com minijogo próprio.
- De dia o papel continua sendo a **profissão** + o caminho de talentos ("para mim" ou
  "para o grupo"), que já existe.

### D. Equipamento que usa as 4 profissões

Hoje todo item custa Tábua + Barra + Ferramenta. Proposta: **custo por espaço**, para
Ração e Queijo também virarem equipamento:

| Espaço | Custo base (Madeira → Bronze) |
| --- | --- |
| Arma, Ferramenta | Tábua, Barra, Ferramenta (como hoje) |
| Corpo, Pés | Queijo, Tábua |
| Cabeça, Mãos | Ração, Tábua |
| Broche, Pulseira | Barra, Queijo, Ração |

Mesmo valor total em pontos de hoje; muda só a mistura. Refino segue a mesma lógica.
Tudo comprável na Vendinha, pagando caro.

### E. Mais obras (e obras que ajudam à noite)

Hoje o sítio para no nível 4. Novas obras, com o custo já escalando pelo grupo:

| Obra | Efeito |
| --- | --- |
| Vendinha | Abre o mercado melhor: compra cai de 200% para 170% |
| Cerca | +defesa do sítio |
| Torre de vigia | +vida máxima da fogueira |
| Cozinha | +recuperação da fogueira por dia |
| Forja comunitária | Refino 15% mais barato |

O mercado básico existe **desde o início** (para ninguém travar); a Vendinha só melhora
o preço. Isso também dá o que faltava ao balanceamento: temporadas diferentes conforme o
grupo investe.

### F. Jogabilidade e um sítio mais vivo (pedido do João)

O jogo precisa ser gostoso de mexer, e o mapa precisa mostrar o que está acontecendo.

**Jogabilidade**
- **Próximo passo sempre à vista:** uma dica curta no topo ("Colete sua produção",
  "Faltam 2 Tábuas para a arma Bronze", "Faça a ronda antes das 20h").
- **Resposta a cada ação:** recurso voando para o estoque ao coletar, "+XP" e "+moedas"
  subindo, barra enchendo, brilho quando sobe de nível ou de tier.
- **Menos toques:** coletar tocando no próprio local de trabalho no mapa; "Doar o que
  falta"; "Vender o excedente" com um toque.
- **Avisos dentro do jogo:** armazém cheio, tarefa pronta, fogueira em perigo.

**Sítio**
- **Fogueira no mapa**, com a chama do tamanho da vida dela; tocar abre a Noite.
- **O mapa escurece** ao anoitecer (perto das 20h) e clareia de manhã.
- **Cada um no seu canto:** moradores andam perto do local da profissão (lavoura, curral,
  serraria, forja); quem fez a ronda fica em volta da fogueira à noite. Ideia do Rodrigo
  no PR #8.
- **Locais de trabalho desenhados:** lavoura, curral, serraria e forja como lugares do
  mapa (liga com #9, abrir terreno).
- **Obras novas aparecem no mapa** (Vendinha, Cerca, Torre, Cozinha, Forja comunitária),
  cada uma no seu terreno.
- **Depois do wipe**, o mapa volta ao começo: só o templo, a piscina e a mata.

## Metas de balanceamento (travadas em teste)

O simulador (`src/game/balance.ts`) ganha: moedas, mercado, um parâmetro "quanto o grupo
troca entre si" e os papéis. Metas novas, além das que já existem:

| Meta | Como mede |
| --- | --- |
| Solo anda, mas devagar | Quem só usa a Vendinha se equipa a **40–60%** do ritmo de quem troca |
| Solo não trava | Jogador sozinho chega a arma Bronze até o **dia 3** |
| Mercado nunca vence a troca | Nenhuma rota comprando tudo é melhor que cooperar |
| Sem lucro infinito | Comprar insumos → fabricar → vender sempre dá prejuízo |
| Time misto ganha | Composição equilibrada dura mais noites que uma classe só |
| Temporada | Continua em 3–5 semanas; diferença entre grupos sobe para **5+ noites** |

Os números acima (50%, 200%, limites, tetos) são ponto de partida: entram em
`config.ts` e são ajustados com `npm run balance` até as metas passarem.

## Roadmap

Cada fase = 1 PR pequeno, com lint + testes + build, mostrado no localhost. Áreas:
**R** = Rodrigo revisa (regras, servidor, banco), **J** = telas do João.

| Fase | Entrega | Área | Depende de |
| --- | --- | --- | --- |
| **0. Fechar o aberto** | Rodrigo revisa e junta #25 (senha), #26 (horda), #15 (Sítio), #27 (MVP). Grupo decide #22 (horizontal). | R | — |
| **1. Moedas e Vendinha** | Regras `market.ts` + testes; migração 005 (moedas, compras do dia); ações vender/comprar; aba **Vendinha** junto do Estoque. | R + J | 0 |
| **1b. Sítio vivo** | Fogueira no mapa, mapa escurece à noite, moradores perto do local de trabalho, locais das profissões desenhados. | J | 0 |
| **1c. Jogabilidade** | Dica do próximo passo, animações de recompensa, coletar pelo mapa, "doar o que falta" e "vender o excedente". | J | 1 |
| **2. Deploy de teste** | Vercel + Neon + `AUTH_SECRET` (#3). Grupo joga o dia + mercado de verdade. | João cria contas | 1 |
| **3. Tarefas do dia e energia** | `tasks.ts` + testes; contadores diários; painel de tarefas no Sítio; barra de energia. | R + J | 1 |
| **4. Ronda que vale** | Simulação vai para `src/game/patrol.ts`; servidor sorteia semente e reexecuta; estrelas dão moedas e loot; expedições. | R + J | 3 |
| **5. Papéis (leva 1)** | Atirador, Tanque, Suporte em `night.ts`; composição na tela da Noite; simulador com papéis. | R + J | 4 |
| **6. Equipamento por espaço + obras novas** | Custos por espaço; 5 obras; sprites das obras; rebalanceamento completo. | R + J | 5 |
| **7a. Telas deitadas: casca, Sítio e Herói** | Abas na lateral, barra de uma linha, Sítio com painel lateral, Herói com os 8 espaços em volta do boneco. Funciona deitado e em pé. As outras abas ficam em duas colunas, com rolagem. | J | decisão #22 |
| **7b. Telas deitadas: o resto** | Oficina, Noite, Estoque/Vendinha e Ranking cabendo sem rolar (padrão "split": principal à esquerda, abas à direita); pódio no Ranking. Feito no PR #36. | J | 7a |
| **7c. Mochila** | Itens achados na ronda (10% por estrela, tier pela noite), equipar, "Equipar o melhor" e desmontar em materiais; a mochila fica no wipe. Feito no PR #37. | R + J | 7a |
| **8. Papéis (leva 2)** | Cozinheira (Cura: a fogueira recupera vida depois do ataque) e Lanterna (Batedor: horda mais fraca, mais loot) com minijogo próprio; Violão ganha o dele (Acorde deixa a horda lenta). Feito no PR da fase 8. | J + R | 5 |
| **9. Polimento** | Avisos no celular (armazém cheio, horda, fogueira baixa), sons, trailer atualizado, ajuste fino com dados reais do grupo. | J + R | 2 |

Ordem de valor: as fases **1 a 4** já entregam o que o João pediu (mercado, rolê solo,
ronda que rende); **5 e 6** entregam os papéis e a economia mais rica.

## Como cada fase é construída (padrão)

Segue as regras do `CLAUDE.md`:

- **Regra pura primeiro**, em `src/game/` com teste Vitest; números só em
  `src/game/config.ts`, com `docs/design.md` atualizado **no mesmo commit** (seções
  novas §16 Mercado, §17 Tarefas e energia, §18 Papéis, §19 Obras).
- **Servidor** em `src/server/`, sempre dentro de `withFarmTx` (`src/server/game.ts`),
  que já resolve as noites atrasadas antes de qualquer ação.
- **Migração nova** a cada mudança de banco (próxima: `005`), nunca editar as antigas.
- **Tela** em `src/components/screens/`, lendo só o `GameState` e chamando ações de
  `src/app/actions.ts`.
- Branches empilhados a partir de `feat/mvp-cycle` enquanto a Fase 0 não fecha; depois,
  a partir da `main`. PR com o modelo do repositório e revisão do Rodrigo.

### Arquivos principais por fase

| Fase | Novos | Alterados |
| --- | --- | --- |
| 1 | `src/game/market.ts` (+test), `src/server/market.ts`, `db/migrations/005_coins_market.sql`, `src/components/screens/MarketScreen.tsx` | `config.ts` (`MARKET`), `game.ts` (`GameState.me.coins`, `market`), `actions.ts`, `nights.ts` (wipe zera moedas), `Game.tsx` (abas), `balance.ts`, `design.md` |
| 3 | `src/game/tasks.ts` (+test), `src/server/tasks.ts`, migração 006 (contadores, energia) | `config.ts` (`DAILY_TASKS`, uso de `ENERGY`), `game.ts` (contar coleta/fabrico/doação), `FarmScreen.tsx` (painel) |
| 4 | `src/game/patrol.ts` (vem de `src/prototype/night/sim.ts`), migração 007 (`patrol_runs`) | `NightGame.tsx` (recebe semente, devolve instantes do especial), `patrolAction`, `NightScreen.tsx` (recompensa) |
| 5 | — | `night.ts` (`nightComposition`, `resolveNight`), `config.ts` (`NIGHT_ROLES`), `nights.ts`, `NightScreen.tsx`, `HeroScreen.tsx`, `balance.ts` |
| 6 | sprites novos em `src/art/` (arquivos novos) | `config.ts` (`GEAR.costBySlot`, `BUILDINGS`), `character.ts`, `FarmMap.tsx` (lugares das obras, liga com #9) |

Reaproveitar o que já existe: `bagPoints`, `hasEnough`, `buildingCostScale`
(`src/game/rules.ts`); `xpFor`, `gearUpgradeCost`, `refineCost`, `characterBonuses`
(`src/game/character.ts`); `resolveNight`, `nightsFireLasts` (`src/game/night.ts`);
`addItems`/`removeItems`/`addXp` (`src/server/game.ts`); `rng` (`src/art/grid.ts`) para
sorteios com semente; `ResList` e `Res` (`src/components/Res.tsx`).

## Verificação (em toda fase)

1. `npm run lint && npm test && npm run build`.
2. `npm run balance`: as metas da tabela de balanceamento passam e a tabela nova entra no
   `design.md`.
3. Banco local limpo: `npm run db:migrate && npm run db:seed` aplica todas as migrações.
4. Roteiro no navegador (Playwright, 390 px), com prints para o João:
   - Fase 1: vender → moedas sobem; comprar → estoque sobe; passar do limite do dia →
     recusa; wipe → moedas zeram, itens ficam.
   - Fase 3: cumprir uma tarefa jogando → recompensa; energia cai na ronda e volta com o
     tempo.
   - Fase 4: jogar a ronda → estrelas, moedas e loot iguais ao que o servidor calculou;
     mandar instantes falsos → servidor ignora.
   - Fase 5: trocar a composição → defesa e "falta tanque" mudam.
5. João roda no PC dele (`git checkout`, `db:migrate`, `db:seed`, `npm run dev`) e
   aprova antes da fase seguinte.

## Depois da aprovação (feito em 12/11)

1. Gravo este plano no repositório como `docs/ROADMAP.md` e abro uma issue-resumo para
   o Rodrigo e o Hernnane comentarem (é área do Rodrigo e muda regras dele).
2. Começo a **Fase 1 (Moedas e Vendinha)** num branch `feat/market` empilhado sobre
   `feat/mvp-cycle`, e mostro no localhost.

## Pontos para o grupo decidir (não travam a Fase 1)

- Nome da loja ("Vendinha"?) e de quem atende.
- Horizontal (#22): travar deitado ou funcionar dos dois jeitos.
- Se a ronda extra (expedição) deve existir ou se uma por dia basta.
