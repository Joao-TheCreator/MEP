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

- A profissão é escolhida ao entrar no sítio e **não muda** no MVP.
- Ao entrar, cada pessoa também escolhe o seu **boneco pixelado** (feitos a partir
  das fotos do grupo; um por pessoa em cada sítio). Ver `docs/visual-identity.md`.
- Várias pessoas podem ter a mesma profissão.

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
