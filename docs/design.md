# Sítio Idle — Documento de Design

> Jogo IDLE cooperativo para um grupo de amigos (4 a 30 pessoas) cuidarem
> de um **sítio compartilhado**. Cada pessoa tem uma profissão que produz recursos
> sozinha com o tempo (inclusive offline). As profissões dependem umas das outras
> e todo mundo doa para **construções coletivas** que sobem o nível do sítio.
> Um **ranking semanal** de contribuição mantém a competição saudável.

**Fonte da verdade dos números:** `src/game/config.ts`. Este documento explica
o *porquê*; o código guarda o *quanto*. Se mudar um número em um lugar, mude no
outro no mesmo commit (há um teste que confere as tabelas principais).

---

## 1. Pilares

1. **Cooperação obrigatória, não opcional.** Ninguém evolui sozinho: as melhorias
   de cada profissão custam produtos das outras.
2. **Sessões curtas.** Entrar, coletar, fabricar, doar, sair — em 1 a 2 minutos.
3. **Offline justo.** A produção acumula até um limite (o "armazém"). Quem entra
   2× por dia não fica muito atrás de quem fica com o app aberto.
4. **Servidor manda.** O cliente só mostra estimativas; toda conta acontece no
   servidor, a partir de timestamps. Não existe simulação contínua.

---

## 2. Profissões

| Profissão (chave)          | Produz (passivo) | Fabrica                          | No MVP |
| -------------------------- | ---------------- | -------------------------------- | ------ |
| Agricultor (`farmer`)      | Grãos            | Ração                            | ✅     |
| Pecuarista (`rancher`)     | Leite            | Queijo                           | ✅     |
| Carpinteiro (`carpenter`)  | Madeira          | Tábua                            | ✅     |
| Ferreiro (`blacksmith`)    | Minério          | Barra de ferro, Ferramenta       | ✅     |
| Cozinheiro (`cook`)        | —                | Refeição (Grãos + Leite + Queijo)| ❌ (pós-MVP, liberado pelo Moinho) |
| Comerciante (`merchant`)   | Moedas           | Trocas entre recursos            | ❌ (pós-MVP) |

- A profissão é escolhida ao entrar no sítio e pode ser trocada depois (§2.1).
- Ao entrar, cada pessoa também escolhe o seu **boneco pixelado** (feitos a partir
  das fotos do grupo; um por pessoa em cada sítio). Ver `docs/visual-identity.md`.
- Várias pessoas podem ter a mesma profissão.

### 2.1 Profissões em falta e troca de profissão

**Problema:** a Ferramenta só sai do Ferreiro e é exigida pelo Arado, pela Serraria
e pelo Moinho. Sem nenhum Ferreiro, o sítio empaca. O mesmo vale, em menor grau,
para qualquer profissão sem ninguém.

**Profissões em falta:** o servidor conta quantos moradores têm cada profissão
(`GameState.farm.professionCounts`) e lista as que ninguém tem
(`farm.missingProfessions`). A tela de entrar num sítio pode consultar a mesma
contagem pelo código de convite (`professionCountsAction`) e destacar a que falta.

**Troca de profissão** (meio-termo do brainstorm: um queria livre, o outro com custo):

| Regra | Valor |
| --- | --- |
| Custo | **4 h** da produção base da profissão **atual**, no recurso bruto dela: 240 Grãos, 120 Leite, 240 Madeira ou 120 Minério (= 240 pontos para todos) |
| Espera entre trocas | **24 h** |
| Produção pendente | É liquidada na profissão antiga antes da troca |
| Nível da oficina | Cada profissão guarda o seu. Voltar para uma antiga recupera o nível dela; uma nova começa no 1 |
| Estoque | Fica todo com o jogador |

O custo é pago no recurso da própria profissão, então dá para trocar sem depender de
ninguém (importante justamente quando falta uma profissão). Os números ficam em
`PROFESSION_CHANGE` (`src/game/config.ts`).

---

## 3. Recursos

Cada recurso tem um **valor em pontos**, usado no ranking. Os recursos brutos
foram calibrados para que toda profissão gere **60 pontos/hora** no nível 1.
Recursos fabricados valem ~20% a mais que a soma dos insumos, para premiar quem
fabrica antes de doar.

| Recurso (chave) | Nome           | Origem                  | Pontos |
| --------------- | -------------- | ----------------------- | ------ |
| `grain`         | Grãos 🌾       | Agricultor (passivo)    | 1      |
| `milk`          | Leite 🥛       | Pecuarista (passivo)    | 2      |
| `wood`          | Madeira 🪵     | Carpinteiro (passivo)   | 1      |
| `ore`           | Minério 🪨     | Ferreiro (passivo)      | 2      |
| `feed`          | Ração 🌽       | Receita (Agricultor)    | 6      |
| `cheese`        | Queijo 🧀      | Receita (Pecuarista)    | 10     |
| `plank`         | Tábua 🪚       | Receita (Carpinteiro)   | 4      |
| `iron_bar`      | Barra de ferro 🔩 | Receita (Ferreiro)   | 10     |
| `tool`          | Ferramenta 🛠️  | Receita (Ferreiro)      | 29     |

---

## 4. Produção passiva

```
taxa/h = base × (1 + 0,25 × (nívelOficina − 1)) × (1 + 0,10 × (nívelSítio − 1))
```

| Profissão   | Recurso | Base/h | Nível 5 da oficina, sítio nv. 1 | Nível 5, sítio nv. 4 |
| ----------- | ------- | ------ | ------------------------------- | -------------------- |
| Agricultor  | Grãos   | 60     | 120                             | 156                  |
| Pecuarista  | Leite   | 30     | 60                              | 78                   |
| Carpinteiro | Madeira | 60     | 120                             | 156                  |
| Ferreiro    | Minério | 30     | 60                              | 78                   |

### 4.1 Coleta offline (por timestamp)

O servidor guarda `last_collected_at` por jogador. Ao coletar:

```
decorrido   = min(agora − last_collected_at, limiteArmazém)
unidades    = floor(taxa × decorrido / 1h)
```

- Se o tempo decorrido **passou** do limite do armazém, o excedente se perde e
  `last_collected_at = agora`.
- Caso contrário, `last_collected_at` avança **só o tempo "gasto"** nas unidades
  inteiras produzidas — a fração não se perde entre coletas.
- Contas feitas em inteiros (milésimos de unidade/hora, `BigInt`) para não haver
  erro de arredondamento.
- **Armazém:** 8 h de produção no início; o Celeiro (construção 2) aumenta para 12 h.
- Qualquer ação que muda a taxa (subir oficina, subir nível do sítio) **liquida**
  antes a produção pendente com a taxa antiga. Quando o sítio sobe de nível, o
  servidor liquida a produção de **todos** os moradores na mesma transação.

---

## 5. Receitas

Fabricação instantânea, feita por quem tem a profissão. Dá para fabricar em lote
(1, 5, 10, máx.).

| Receita        | Quem faz    | Insumos                       | Resultado | Pontos (insumos → produto) |
| -------------- | ----------- | ----------------------------- | --------- | -------------------------- |
| Ração          | Agricultor  | 5 Grãos                       | 1 Ração   | 5 → 6                      |
| Queijo         | Pecuarista  | 4 Leite                       | 1 Queijo  | 8 → 10                     |
| Tábua          | Carpinteiro | 3 Madeira                     | 1 Tábua   | 3 → 4                      |
| Barra de ferro | Ferreiro    | 3 Minério + 2 Madeira         | 1 Barra   | 8 → 10                     |
| Ferramenta     | Ferreiro    | 2 Barras de ferro + 1 Tábua   | 1 Ferramenta | 24 → 29                 |

Dependências que nascem daqui:
- Ferreiro precisa de **Madeira** e **Tábua** do Carpinteiro.
- As oficinas (seção 6) puxam o resto da rede.

```
 Agricultor ──Ração──────────────▶ Pecuarista
     ▲                                 │
     │ Tábua, Ferramenta               │ Queijo
     │                                 ▼
 Carpinteiro ──Madeira, Tábua──▶ Ferreiro
     ▲                                 │
     └──────Barra, Ferramenta──────────┘
```

---

## 6. Oficinas (melhoria individual)

Cada jogador tem uma oficina (nível 1 a 10). Subir de nível aumenta a produção
em +25% da base. Custo para ir do nível `N` para `N+1`:

```
custo = ceil(custoBase × 1,6^(N − 1))
```

| Oficina   | Profissão   | Custo base (nível 1 → 2)                 |
| --------- | ----------- | ---------------------------------------- |
| Arado     | Agricultor  | 20 Tábuas, 2 Ferramentas, 100 Grãos      |
| Curral    | Pecuarista  | 30 Tábuas, 20 Rações, 60 Leite           |
| Serraria  | Carpinteiro | 5 Barras de ferro, 3 Ferramentas, 100 Madeira |
| Forja     | Ferreiro    | 20 Tábuas, 10 Queijos, 60 Minério        |

Exemplo — Arado 4 → 5: `ceil(20×1,6³)=82` Tábuas, `ceil(2×1,6³)=9` Ferramentas,
`ceil(100×1,6³)=410` Grãos.

Recursos de outras profissões chegam pelo **Enviar** (jogador → jogador, mesmo
sítio). Envios **não** dão pontos de ranking (evita "lavagem" de pontos entre
amigos); só doações ao sítio pontuam.

---

## 7. Construções coletivas (sítio)

O sítio começa no **nível 1**. Sempre existe uma construção em andamento; cada
jogador doa recursos para ela. Não dá para doar mais do que falta. Ao completar,
o sítio sobe de nível (+10% de produção para todos) e a próxima construção abre.

### 7.1 Poço Comunitário — nível 1 → 2
| Recurso  | Quantidade |
| -------- | ---------- |
| Madeira  | 400        |
| Minério  | 200        |
| Grãos    | 300        |
| Tábua    | 60         |

≈ 1.340 pontos — com 4 jogadores no nível 1 (240 pts/h no total), cerca de
**6 h** de produção do grupo: dá para completar no primeiro dia.

> ⚠️ Os custos foram pensados para ~4–6 jogadores. Com o grupo inteiro (~20
> pessoas) as 3 construções saem em 1–2 dias. Próximo passo de balanceamento:
> escalar o custo pelo número de moradores ou adicionar mais construções.
**Efeito:** sítio nível 2 (+10% de produção).

### 7.2 Celeiro — nível 2 → 3
| Recurso        | Quantidade |
| -------------- | ---------- |
| Grãos          | 800        |
| Leite          | 300        |
| Tábua          | 200        |
| Ração          | 120        |
| Barra de ferro | 60         |

≈ 3.520 pontos (~1,5 dia de grupo, já com algumas oficinas melhoradas).
**Efeito:** sítio nível 3 (+10%) e armazém offline de **8 h → 12 h**.

### 7.3 Moinho — nível 3 → 4
| Recurso        | Quantidade |
| -------------- | ---------- |
| Tábua          | 300        |
| Ração          | 300        |
| Queijo         | 120        |
| Barra de ferro | 100        |
| Ferramenta     | 40         |

≈ 6.360 pontos (~2–3 dias).
**Efeito:** sítio nível 4 (+10%). Pós-MVP: libera a profissão Cozinheiro.

Depois do Moinho, no MVP o sítio fica no nível 4 ("Em breve: novas construções").

---

## 8. Ranking semanal

- Pontos = soma de `quantidade × pontos do recurso` das **doações ao sítio**.
- Semana: **segunda 00:00 até domingo 23:59, horário de Brasília**
  (`America/Sao_Paulo`).
- Tela mostra: ranking da semana atual, da semana passada e total geral.
- Pontos são gravados no momento da doação (`donations.points`) — mudar a tabela
  de pontos depois não altera o passado.

---

## 9. Regras anti-trapaça

- Cliente nunca envia quantidades produzidas; só intenções ("coletar", "fabricar
  5 Tábuas", "doar 30 Madeira").
- Toda ação roda numa transação que trava a linha do sítio (`FOR UPDATE`) — as
  ações de um mesmo sítio são serializadas; sem condição de corrida.
- Estoque tem `CHECK (qty >= 0)` no banco como última barreira.
- Entradas validadas com `zod` (inteiros positivos, chaves conhecidas, limites).
- Login por senha pessoal, sem e-mail: a pessoa digita só a senha, que a
  identifica. Por isso a senha é única no sítio todo e fica guardada como
  HMAC-SHA256 com `AUTH_SECRET` (não dá para reverter sem o segredo do servidor).
  Mínimo de 6 caracteres, senhas óbvias recusadas, no máximo 10 tentativas
  (entrar ou criar) por IP a cada 15 min. Se a senha escolhida já existe, a
  resposta é a mesma de uma senha fraca, para não confirmar a senha de ninguém.
  Sessão em cookie `httpOnly` por 30 dias. Esqueceu a senha: por enquanto não há
  recuperação (ver pendências).

---

## 10. Escopo

**MVP (este marco):** login por senha pessoal; criar/entrar em sítio por código de
convite; escolha de boneco; 4 profissões; inventário; coleta offline; receitas; oficinas; envio entre
jogadores; doação às 3 construções; ranking semanal; PWA instalável.

**Pós-MVP (ideias):** Cozinheiro e Comerciante; refeições como "buff" temporário;
eventos semanais (ex.: "semana da colheita", 2× Grãos); conquistas; notificações
push quando o armazém encher; histórico de construções com quem mais ajudou.

---

## 11. Personagem (proposta do Rodrigo, em revisão)

Cada morador evolui também **sozinho**, além do sítio coletivo. Tudo o que vem
daqui é somado num único conjunto de bônus pessoais (`characterBonuses` em
`src/game/character.ts`) e tem **teto** (`BONUS_CAPS`), para não estourar a
economia nem a escala de custo das construções (#4).

### 11.1 Nível e experiência

- Nível 1 a **30**. Ir do nível 1 ao 2 custa **100 XP**; cada nível seguinte custa
  **25% mais** (nível 10 → 11: 745 XP). Proposta §15.5; antes era 20%. Mais lento
  para o nível ainda contar quando a horda alcança o grupo, e ele **zera no wipe**.
- XP por ponto de valor movimentado: **doar 1**, **fabricar 0,5** (sobre os pontos do
  que saiu), **coletar 0,1**. **Enviar a um amigo não dá XP** (dois amigos poderiam
  ficar mandando um para o outro sem fim).
- O XP é guardado **com fração** (coletar 1 ponto dá 0,1 XP), para que coletar várias
  vezes pouco renda o mesmo que coletar uma vez muito.
- Ritmo esperado: quem doa metade do que produz chega ao nível 10 em uns 3 dias e ao
  20 em umas 3 semanas.

### 11.2 Atributos

Cada nível dá **1 ponto** para distribuir. Máximo de **20 pontos** por atributo.
Cada atributo vale de dia (sítio) e de noite (ronda, #14):

| Atributo | Por ponto, de dia | Por ponto, à noite |
| --- | --- | --- |
| Força | +1,5% de produção | +3% de dano |
| Resistência | +12 min de armazém | +4% de vida |
| Agilidade | +3% de recuperação de energia | +2% de velocidade de ataque |
| Ofício | +1,5% de chance de fabricar em dobro | +3% de carga do especial |
| Espírito | +2% do que você doa conta na obra (não no ranking) | +4% de cura nos amigos |

**Energia:** 0 a 100, recupera 10 por hora. **Não** limita coletar, fabricar nem
doar (isso brigaria com o idle). Vai ser gasta na ronda da noite e em tarefas
especiais.

### 11.3 Árvore de habilidades (talentos)

Por profissão, **4 níveis de talento**, que abrem nos níveis **5, 10, 15 e 20**.
Em cada um, escolhe-se **1 entre 2**: um caminho "para mim" (produção, armazém) e
outro "para o grupo" (doações rendem mais na obra, fabricar em dobro). Lista completa
em `TALENTS` (`src/game/config.ts`). Exemplo, Agricultor:

| Nível | Para mim | Para o grupo |
| --- | --- | --- |
| 5 | Mão boa: +8% produção | Colheita farta: +60 min armazém |
| 10 | Ração caprichada: +6% fabricar em dobro | Primícias: doações +6% na obra |
| 15 | De sol a sol: +12% produção | Mutirão: doações +10% na obra |
| 20 | Safra recorde: +15% produção, +60 min | Celeiro do povo: doações +15% na obra |

### 11.4 Tetos dos bônus pessoais

| Bônus | Teto |
| --- | --- |
| Produção | +100% |
| Armazém | +360 min (6 h) |
| Fabricar em dobro | 50% |
| Doação rende na obra | +60% |
| Dano (noite) | +600% (proposta §15.5; era +200%) |
| Vida (noite) | +400% (proposta §15.5; era +150%) |

## 12. Equipamento

### 12.1 Espaços e itens

O personagem tem **8 espaços**. Cada item aumenta **um** bônus pessoal:

| Espaço | Item | Bônus | Por ponto de poder |
| --- | --- | --- | --- |
| Cabeça | Chapéu de palha | Armazém | 3 min |
| Corpo | Camiseta do acampamento | Vida (noite) | 1% |
| Mãos | Luvas de trabalho | Fabricar em dobro | 0,25% |
| Pés | Botina | Energia por hora | 0,5% |
| Ferramenta | Enxada, Balde, Machado ou Martelo (da profissão) | Produção | 1% |
| Arma | Bola de vôlei, Colchonete, Violão, Concha ou Lanterna (da classe da noite) | Dano (noite) | 1% |
| Broche | Broche da chama | Doação rende na obra | 0,3% |
| Pulseira | Pulseira de miçangas | Carga do especial | 0,5% |

`bônus do item = por ponto × (poder do tier + refino × passo)`. O passo é 1, e 2 na
Arma. A **ferramenta só funciona na profissão dela** (um Machado na mão de um
Agricultor não faz nada; serve para guardar caso ele troque de profissão, §2.1).

### 12.2 Tiers

| Tier | Poder | Custo para chegar (a partir do anterior) |
| --- | --- | --- |
| Madeira | 0 | — (inicial) |
| Bronze | 4 | 10 Tábuas, 4 Barras de ferro, 1 Ferramenta |
| Ferro | 8 | 19 Tábuas, 8 Barras, 2 Ferramentas |
| Prata | 13 | 37 Tábuas, 15 Barras, 4 Ferramentas |
| Ouro | 19 | 69 Tábuas, 28 Barras, 7 Ferramentas |
| Diamante | 26 | 131 Tábuas, 53 Barras, 14 Ferramentas |
| Brasa (lendária) | 34 | bloqueada: vai custar Brasas do grupo (#17) |

### 12.3 Refino (+1, +2, … sem teto prático)

Proposta §15.5: o refino é o **ralo sem fim** da economia, o que faz o item guardado
no wipe valer a pena. Ir de +r para +(r+1) custa
`⌈2 × (r+1) × 1,18^r⌉` Barras de ferro e `⌈0,5 × (r+1) × 1,18^r⌉` Ferramentas:

| De → para | Barras | Ferramentas |
| --- | --- | --- |
| +0 → +1 | 2 | 1 |
| +5 → +6 | 28 | 7 |
| +9 → +10 | 89 | 23 |
| +20 → +21 | 1.151 | 288 |

Limite técnico +99. Sem chance de falhar e sem perder o item: o jogo é para ser
gostoso, não para frustrar.

### 12.4 Mochila e sugestão automática

- Mochila com páginas de **24 espaços**; as páginas I e II já vêm abertas, a III abre
  no **nível 15**.
- O jogador **não precisa caçar item melhor**: o servidor compara cada espaço com a
  mochila (`gearSuggestions`) e a tela marca o espaço com uma seta "tem melhor na
  mochila". Um botão **Equipar o melhor** (`equipBest`) troca tudo de uma vez e
  guarda os itens antigos na mochila.

Os custos usam Tábua, Barra e Ferramenta de propósito: todo mundo precisa do
Carpinteiro e do Ferreiro para se equipar.

## 13. Caixa do sítio (ideia, ainda não decidida)

Um dinheiro **do grupo**, e o grupo decide como gastar.

- **Entra:** venda de excedente no "mercado da cidade" (preço fixo, abaixo do valor
  em pontos), parte do que o Comerciante ganha, prêmios de eventos e da Noite da Horda.
- **Sai, por votação:** buff temporário para todos (ex.: +10% por 24 h), reparos
  depois de uma horda perdida (#17), adiantar uma obra, festas e eventos.
- **Votação:** qualquer morador propõe (o que, quanto, por quê); fica aberta 24 h;
  passa com maioria de quem votou e pelo menos 30% dos ativos votando. Cada um
  propõe no máximo 1 vez por dia. Tudo fica num **livro-caixa** visível para todos.

## 14. Tempo de jogo (orçamento)

O jogo é para ser **resenha entre amigos**, não um segundo emprego. Toda mecânica
nova precisa caber neste orçamento, por pessoa:

| Momento | Tempo | O que faz |
| --- | --- | --- |
| Entrada rápida (2–3× por dia) | ~1 min | Coletar, fabricar, doar, ver o sítio |
| Ronda da noite (#14, opcional) | 1–2 min | Uma ronda automática; só escolhe a hora do especial. Quem não faz a ronda **não ganha as recompensas da noite**, mas também não é punido |
| Personagem (de vez em quando) | ~1 min | Ponto de atributo, talento, "Equipar o melhor" |
| **Total no dia** | **≤ 5 min** | |

Regras que protegem esse orçamento:
- Faltar um dia **não pune** de forma que obrigue a voltar: o armazém só para de
  encher, e a ameaça (#17) sobe devagar e sempre com aviso.
- Tudo que pode ser automático é automático: equipar o melhor, liquidar produção,
  sugerir o que doar.
- Nenhuma mecânica exige estar online numa hora certa (a Noite da Horda dá 48 h de
  prazo e cada um joga quando puder).
- Avisos no celular só para o que importa (armazém cheio, obra pronta, horda marcada).

## 15. Noites, hordas e o wipe (proposta do João, em revisão)

**De dia o grupo produz e se equipa; toda noite a horda ataca a fogueira e fica mais
forte; se a fogueira apagar, o sítio é wipado e começa uma nova temporada, e só os
itens ficam.** Código: `src/game/night.ts` (regras) e `src/game/balance.ts`
(simulador). Números em `NIGHT`, `COMBAT`, `FIRE` e `NIGHT_REWARDS` no `config.ts`.

> Muda duas decisões anteriores e precisa do OK do Rodrigo:
> - **#14:** a ronda continua **opcional para cada um**, mas quem não joga entra
>   "dormindo na barraca" com metade da força. Ninguém é punido sozinho; o risco é do
>   grupo.
> - **#17 (A Queda):** troca "guarda metade do nível + Brasas" por **só os itens**.

### 15.1 A noite

- Toda noite às **20h** (horário de Brasília) a horda ataca. A força cresce **11,5%
  por noite** (era 10%; subiu com as obras da §20, que deixam o sítio mais forte). O servidor resolve as
  noites atrasadas pelo relógio, como a produção offline: ninguém precisa estar online.
- **Força da horda** = `14 × moradores ativos × 1,115^(noite − 1)`. Ativo = coletou nas
  últimas 72 h; nunca menos de 4 (sítio pequeno não fica fácil demais).

### 15.2 A defesa

- **Força de cada morador** = `(10 + 1 × (nível − 1)) × (1 + dano%) × √(1 + vida%)`.
  Dano vem da Arma, da Força e dos talentos; vida vem da Camiseta e da Resistência.
- Quem **jogou a ronda** antes do ataque entra com **×1,5**; quem não jogou, com **×0,5**.
- **Defesa do sítio** = soma de todos × `(1 + 10% × (nível do sítio − 1))`.

### 15.3 A fogueira (a vida do sítio)

- **Vida máxima** = `30 × moradores ativos × (1 + 25% × (nível do sítio − 1))`.
- Toda noite a fogueira perde `força da horda − defesa` (se for positivo).
- Todo dia ela recupera **35%** da vida máxima.
- **Vida 0 = wipe.** A tela avisa antes: mostra a força da horda de hoje, a defesa
  estimada e quantas noites a fogueira aguenta nesse ritmo.

### 15.4 O wipe

| Fica | Zera |
| --- | --- |
| Todos os itens (equipados e na mochila), com tier e refino | Nível do sítio e construções |
| Ranking geral e histórico de temporadas | Recursos do estoque |
| | Nível das oficinas |
| | Nível, XP, atributos e talentos do personagem |
| | Contador de noites (a horda volta à noite 1) |

Cada temporada fica registrada ("1ª temporada: caiu na noite 28").

**Recompensa da ronda:** quem jogou ganha `30 + 12 × noite` de XP se o sítio aguentou.

### 15.5 Balanceamento (simulado)

`npm run balance` simula temporadas inteiras com as regras reais (produção, XP,
atributos, talentos, custos de oficina, equipamento e obras). Grupos de 20, com três
perfis de jogador:

| Perfil | Entra por dia | Joga a ronda |
| --- | --- | --- |
| Dedicado | 3× | 90% das noites |
| Regular | 2× | 60% |
| Casual | 1× | 25% |

| Grupo | Composição | Cai na noite (temporada 1 → 2 → 3) |
| --- | --- | --- |
| Dedicado | 8 dedicados, 8 regulares, 4 casuais | 33 → 34 → 34 |
| Típico | 4 dedicados, 8 regulares, 8 casuais | 31 → 31 → 32 |
| Devagar | 6 regulares, 14 casuais | 28 → 28 → 29 |
| Pequeno (5) | 2 dedicados, 2 regulares, 1 casual | 32 → 33 → 34 |

O que o simulador mostrou e as mudanças que resultaram:

1. **Com os números antigos, todo grupo caía na mesma noite e os itens guardados não
   mudavam nada:** a arma de diamante saía no dia 4 e o sítio chegava ao nível máximo
   no dia 2. Todo mundo batia nos tetos antes da horda chegar.
2. **Obras escalam com os moradores ativos** (`BUILDING_SCALE`, custo listado vale
   para 5; resolve parte do #4).
3. **Refino sem teto** e mais caro a cada nível (§12.3): é o ralo da economia e o que
   torna o item guardado valioso.
4. **XP 25% por nível** (era 20%) e **tetos de dano/vida maiores** (§11.4).
5. **A ronda pesa:** ×1,5 jogando, ×0,5 dormindo.

Os testes em `src/game/balance.test.ts` travam as metas: a primeira semana é segura
(fogueira nunca abaixo da metade nas noites 1–7), uma temporada dura **3 a 5 semanas**,
grupo que joga mais vai mais longe, e os itens guardados nunca encurtam a temporada
seguinte.

**Limites honestos:** com custos exponenciais, produzir o dobro vira poucas noites a
mais (é normal num idle). Com os papéis da §19 (tabela acima, time misto), a diferença
entre grupos subiu para **até 5 noites**; os itens guardados quase não empurram a
temporada seguinte (0 a +1 noite). Se o grupo quiser que o wipe pese mais, as alavancas
são: mais obras para subir o sítio (hoje só 3, o sítio chega ao nível 4 em uma semana)
e um bônus pequeno por temporada.

### 15.6 MVP do ciclo dia → noite → wipe

O mínimo para o grupo jogar o ciclo inteiro:

| # | O que | Quem |
| --- | --- | --- |
| 1 | Banco do personagem (XP, atributos, talentos, itens e mochila) e ações de equipar, melhorar e refinar (#20 já tem as regras) | Rodrigo |
| 2 | Noites no servidor: temporada, noite, vida da fogueira, "jogou a ronda hoje", resolução pelo relógio e wipe numa transação | Rodrigo |
| 3 | Fogueira na tela do Sítio: vida, horda de hoje × defesa, "aguenta N noites" | João |
| 4 | Tela do Personagem (#22, na horizontal) com Equipar o melhor, atributos e talentos | João |
| 5 | Ronda ligada: o protótipo da noite marca "joguei a ronda" no servidor (o resultado do minijogo ainda não conta) | João + Rodrigo |
| 6 | Tela do wipe ("A fogueira apagou na noite 28") e histórico de temporadas | João |

Fora do MVP: loot da noite, chefes, mistérios, Brasa (tier lendário), caixa do sítio.

## 16. Moedas e a Vendinha (proposta do João, em revisão)

**Cada um pode vender o que produz por moedas e comprar qualquer material na loja do
jogo, pagando 4× mais caro do que trocando com um amigo.** O objetivo é ninguém ficar
travado quando falta uma profissão (#10) ou quando os outros somem, sem tirar o valor da
cooperação. Código: `src/game/market.ts`; números em `MARKET` (`config.ts`).

- **1 moeda = 1 ponto de valor** (os pontos da §3).
- **Vender:** 50% do valor (arredonda para baixo no total). 10 Tábuas = 20 moedas.
- **Comprar:** 200% do valor (arredonda para cima). 10 Tábuas = 80 moedas.
- A loja vende **só os 9 recursos**. Equipamento nunca: continua sendo melhorado e
  refinado pelo jogador (é o que fica no wipe).
- **Limite de compra por dia** (dia de Brasília), em pontos de valor comprado:
  `150 + 15 × nível`. No nível 1 são 165 pontos: cabe **uma** melhoria para Bronze
  (109 pontos, 218 moedas), não duas.
- Vender **não** dá XP nem pontos no ranking. Doar continua sendo o que conta.
- **Wipe:** as moedas zeram.

Garantias travadas em teste (`market.test.ts`):
- comprar custa pelo menos 4× o que vender paga;
- **sem dinheiro infinito:** em toda receita, vender o produto rende menos do que comprar
  os insumos;
- a compra máxima nunca passa das moedas nem do limite do dia.

Referência de ritmo: um Agricultor nível 1 vende um armazém cheio (8 h, 480 Grãos) por
240 moedas, o bastante para uma melhoria Bronze por dia jogando sozinho. Quem troca com
os amigos faz a mesma melhoria com um quarto do esforço.

O plano completo das próximas mecânicas (tarefas do dia, ronda que rende, papéis da
noite, equipamento por espaço, obras novas, sítio vivo) está em `docs/ROADMAP.md`.

## 17. Tarefas do dia e energia (proposta do João, em revisão)

**Todo dia cada morador recebe três tarefas pequenas, que dão moedas e XP, para ter o
que fazer mesmo jogando sozinho.** Código: `src/game/tasks.ts`; números em `DAILY_TASKS`
e `ENERGY` (`config.ts`).

### 17.1 Tarefas

- **Três por dia** (dia de Brasília). A primeira é sempre **coletar** (qualquer um faz
  sozinho); as outras duas são sorteadas entre fabricar, doar, vender, fazer a ronda e
  melhorar ou refinar um item. "Doar" não aparece quando não há obra em andamento.
- O sorteio é **fixo por pessoa e por dia** (semente = morador + data): recarregar a
  página não muda as tarefas. O nível, a profissão e "tem obra?" são os do **começo do
  dia**, para a tarefa não mudar no meio.

| Tarefa | Meta |
| --- | --- |
| Coletar | 3 horas da produção base da profissão, +10% por nível (nível 1: 180 Grãos ou 90 Leite) |
| Fabricar | `5 + nível` itens (máximo 30) |
| Doar | `40 + 10 × nível` pontos para a obra |
| Vender | `30 + 5 × nível` moedas na Vendinha |
| Ronda | fazer a ronda da noite |
| Equipamento | melhorar ou refinar um item |

- **Recompensa de cada tarefa:** `30 + 5 × nível` moedas e `20 + 4 × nível` XP.
- **Bônus por fazer as três:** `60 + 10 × nível` moedas.
- No nível 1, um dia completo rende 175 moedas (3 × 35 + 70): quase uma melhoria Bronze
  na Vendinha (218 moedas).
- As recompensas são recebidas com um toque em **Receber recompensas** (aba Oficina).
- O dia que passou não acumula: tarefa não feita some.

### 17.2 Energia

- 0 a **100**, recupera **10 por hora** (mais com Agilidade e com a Botina), calculada
  pelo relógio como a produção.
- **Cada ronda gasta 30.** Hoje só existe uma ronda por noite, então a energia quase
  nunca falta; ela passa a limitar de verdade quando entrarem as expedições (rondas extras
  por loot, roadmap fase 4): a barra cheia paga três.
- Energia **não** limita coletar, fabricar, doar nem vender.

## 18. Ronda que vale e expedições (proposta do João, em revisão)

**O resultado da ronda agora conta: as estrelas dão moedas e materiais, e é o servidor
que calcula.** Código: `src/game/patrol.ts` (a simulação saiu de `src/prototype/night/`);
números em `PATROL` (`config.ts`).

### 18.1 Conferido no servidor

A ronda é uma simulação **determinística**, em passos fixos de 0,05 s: a mesma semente e
os mesmos instantes do especial dão sempre a mesma noite.

1. **Começar:** o servidor cobra a energia (30), sorteia a **semente** e guarda a ronda
   (`patrol_runs`).
2. **Jogar:** o celular roda a simulação com essa semente e anota em que passo cada
   especial foi usado.
3. **Terminar:** o celular manda só a lista de passos. O servidor **joga a noite de novo**
   (`replayPatrol`) e calcula as estrelas e as recompensas. Especial pedido sem estar
   carregado é ignorado, como no celular.

O celular nunca diz quantas estrelas fez. Uma ronda aberta vale por 30 minutos; começar
outra fecha a anterior sem recompensa (a energia já foi gasta).

### 18.2 Recompensas

- **Moedas:** `estrelas × (10 + 2 × noite)`. Ronda perdida (0 estrelas): 5 moedas.
- **Loot:** um sorteio **por estrela**. Cada sorteio dá um material que vale cerca de
  `12 + 3 × noite` pontos (pelo menos 1 unidade). Pesos do sorteio:

| Material | Peso | Material | Peso |
| --- | --- | --- | --- |
| Tábua | 26 | Madeira | 6 |
| Barra de ferro | 18 | Grãos | 6 |
| Ração | 16 | Minério | 4 |
| Queijo | 14 | Leite | 4 |
| Ferramenta | 6 | | |

- O sorteio usa a semente da ronda: é o servidor que decide, e repetir não muda.
- É a fonte **solo** dos materiais que hoje só vêm de outra profissão.
- O XP da ronda continua vindo na virada da noite, se o sítio aguentar (§15.4).

### 18.3 Ronda do dia e expedições

- A **primeira** ronda da noite é a **ronda do dia**: terminá-la (ganhando ou perdendo)
  é o que coloca o morador na defesa com ×1,5.
- Depois dela, até **3 expedições por dia**: rondas extras só pelas recompensas. Cada
  uma custa 30 de energia, então a barra cheia (100) paga a ronda e duas expedições; a
  terceira pede esperar a energia voltar.
- Teste trava o teto: a ronda mais três expedições com 3 estrelas na noite 1 valem menos
  que meio dia de produção de um nível 1.

## 19. Papéis da noite (proposta do João, em revisão)

**Cada classe da noite tem um papel com efeito no grupo, e time misto rende mais que
todo mundo na mesma classe.** Código: `nightComposition` e `roleEffects` em
`src/game/night.ts`; números em `NIGHT_ROLES` (`config.ts`).

Os efeitos contam só entre quem **fez a ronda** da noite. "Fatia" = moradores daquele
papel na ronda ÷ moradores ativos (mínimo 4, como na horda).

| Classe | Papel | Força própria | Efeito no grupo | Teto |
| --- | --- | --- | --- | --- |
| Jogador de vôlei | Atirador | ×1,3 | — | — |
| Colchonete | Tanque | ×1,0 | A fogueira perde menos do que passou da defesa: corte = 2 × fatia | 40% |
| Violão | Suporte | ×0,8 | Mais força para todos na ronda: bônus = 1,5 × fatia | +30% |

- Os dois tetos chegam com **1 em cada 5 moradores** no papel. Passou disso, mais gente
  do mesmo papel não ajuda.
- Quem não fez a ronda continua com ×0,5 e não dá efeito de papel.
- `dano na fogueira = max(0, horda − defesa) × (1 − corte)`.
- Conta de referência, 20 pessoas do mesmo nível na ronda (força em unidades de um
  morador): 20 atiradores = 26, sem corte; **12 atiradores + 4 tanques + 4 suportes =
  29,6 e 40% menos dano**; 20 tanques = 20 com corte de 40%; 20 suportes = 20,8.
- **Trocar de classe** é livre de dia e fica travado depois de fazer a ronda da noite.
- O Violão usa o minijogo do Vôlei até ter o seu (roadmap, fase 8). Cozinheira (cura) e
  Lanterna (batedor) entram nessa mesma fase.

No simulador (§15.5), o grupo com time misto (3 atiradores, 1 tanque e 1 suporte em cada
5) dura **1 noite a mais** que o mesmo grupo todo de atirador; no grupo pequeno, empata.
Os números da horda não precisaram mudar: as metas de temporada continuam passando.

## 20. Equipamento por espaço e obras novas (proposta do João, em revisão)

### 20.1 Equipamento que usa as quatro profissões

Antes, todo item custava Tábua + Barra + Ferramenta: só Carpinteiro e Ferreiro
equipavam o grupo. Agora **cada espaço é feito de materiais diferentes**, valendo o mesmo
em pontos (109 a 110 para Madeira → Bronze). Substitui a regra única da §12.2 e §12.3;
o crescimento por tier (×1,9) e por refino (×1,18) não muda.

| Espaço | Madeira → Bronze | Refino +0 → +1 |
| --- | --- | --- |
| Arma, Ferramenta | 10 Tábuas, 4 Barras, 1 Ferramenta | 2 Barras, 1 Ferramenta |
| Corpo, Pés | 7 Queijos, 10 Tábuas | 2 Queijos, 4 Tábuas |
| Cabeça, Mãos | 11 Rações, 11 Tábuas | 4 Rações, 4 Tábuas |
| Broche, Pulseira | 4 Barras, 4 Queijos, 5 Rações | 2 Barras, 1 Queijo, 2 Rações |

Ração e Queijo deixam de servir só para obra: Agricultor e Pecuarista passam a fazer
equipamento também. Tudo continua comprável na Vendinha, mais caro.

### 20.2 Cinco obras novas

Depois do Moinho o sítio continua subindo, até o **nível 9**. Cada obra dá o +10% de
produção do nível **e** um efeito próprio. Os custos abaixo são para 5 moradores ativos e
crescem com o grupo (§15.5).

| Obra | Do nível | Efeito | Custo (5 moradores) |
| --- | --- | --- | --- |
| Vendinha | 4 → 5 | A loja vende a 170% do valor (era 200%) | 1.800 Tábuas, 2.400 Madeiras, 3.600 Grãos, 600 Queijos, 90 Ferramentas |
| Cerca | 5 → 6 | +15% de defesa à noite | 5.200 Tábuas, 6.900 Madeiras, 1.050 Barras, 210 Ferramentas |
| Torre de vigia | 6 → 7 | +25% de vida máxima da fogueira | 7.950 Tábuas, 2.400 Barras, 480 Ferramentas, 2.000 Rações, 3.950 Minérios |
| Cozinha | 7 → 8 | A fogueira recupera +15% da vida por dia (50% no total) | 4.100 Queijos, 6.850 Rações, 11.400 Leites, 5.500 Tábuas, 680 Ferramentas |
| Forja comunitária | 8 → 9 | Refinar custa 15% menos | 7.850 Barras, 2.100 Ferramentas, 15.750 Minérios, 7.850 Tábuas, 1.550 Queijos |

- A loja básica existe desde o começo; a obra Vendinha só melhora o preço. Com 170% ainda
  não há lucro infinito (teste).
- Os efeitos somam por cima dos bônus de nível do sítio que já existiam (+10% de defesa e
  +25% de vida da fogueira por nível).
- No mapa: Vendinha a oeste, Torre ao norte, Cozinha a leste, Forja comunitária e Cerca ao
  sul, perto da fogueira. Sprites em `src/art/buildings.ts`.

### 20.3 O que mudou no balanceamento

- As obras agora **duram a temporada**: na primeira, nenhum grupo termina todas. O grupo
  dedicado e o pequeno caem no nível 8; o devagar, no 7.
- **Os itens guardados passaram a contar:** com eles, o grupo dedicado termina a Forja
  comunitária a partir da 2ª temporada, e as temporadas seguintes duram 1 a 2 noites a mais.
- A horda cresce 11,5% por noite (era 10%) para a temporada continuar em 3 a 5 semanas.
- Limite: o simulador ainda **não** modela moedas, Vendinha, tarefas nem loot da ronda;
  ele assume que o grupo troca materiais entre si sem perda.

## 21. Mochila (proposta do João, em revisão)

**Itens prontos são achados na ronda, ficam na mochila, e cada um escolhe equipar ou
desmontar.** Código: `src/game/backpack.ts`; números em `BACKPACK` (`config.ts`). Usa o
que o Rodrigo já tinha deixado no #20: `BAG`, `bagPagesOpen`, `gearSuggestions` e
`equipBest` (§12.4).

- **Achar:** cada estrela da ronda ou de uma expedição tem **10%** de chance de achar um
  item. O servidor sorteia com a semente da ronda (§18.1), então não dá para forçar.
  - Espaço: qualquer um dos 8.
  - Tier pela noite:

| Noites | Tier | Às vezes |
| --- | --- | --- |
| 1 a 7 | Bronze | — |
| 8 a 14 | Ferro | 30% Bronze |
| 15 a 21 | Prata | 30% Ferro |
| 22 em diante | Ouro | 30% Prata |

  - Diamante e Brasa **nunca caem**: só fazendo.
  - Refino: +0 até a noite 9; depois, de +0 até `noite ÷ 10`.
  - Referência: a ronda e três expedições com 3 estrelas dão cerca de 1 item por dia.
- **Capacidade:** 24 itens por página aberta: 48 no começo, 72 a partir do nível 15.
  Mochila cheia: o item achado é **desmontado na hora** e os materiais vão para o estoque.
- **Equipar:** troca com o item do corpo, que volta para a mochila (Madeira +0 some, não
  vale nada). **Equipar o melhor** troca de uma vez todos os espaços em que a mochila tem
  algo melhor.
- **Desmontar:** devolve **50%** dos materiais que o item custaria para chegar ao tier e ao
  refino dele, no espaço dele (§20.1). Ex.: Arma de Bronze = 5 Tábuas e 2 Barras.
- **Wipe:** a mochila **fica**, como o equipamento. Se o nível cair e a 3ª página fechar,
  os itens continuam lá; só não entra item novo até liberar espaço.
- **Limite:** o simulador da §15.5 não modela os itens achados; eles deixam as temporadas
  um pouco mais longas do que a tabela mostra.
