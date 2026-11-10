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
- Link mágico: token aleatório de 32 bytes, guardado só o hash SHA-256, expira em
  15 min, uso único, no máximo 3 pedidos por e-mail a cada 15 min. A página do
  link pede um clique em "Entrar" (POST) para que leitores de e-mail não
  consumam o token.

---

## 10. Escopo

**MVP (este marco):** login por link mágico; criar/entrar em sítio por código de
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
  **20% mais** (nível 10 → 11: 516 XP).
- XP por ponto de valor movimentado: **doar 1**, **fabricar 0,5** (sobre os pontos do
  que saiu), **coletar 0,1**. **Enviar a um amigo não dá XP** (dois amigos poderiam
  ficar mandando um para o outro sem fim).
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

### 12.3 Refino (+1 a +10)

Cada item pode ser refinado até **+10**. Ir de +r para +(r+1) custa
`2 × (r+1)` Barras de ferro e `⌈(r+1) ÷ 2⌉` Ferramentas (de +0 para +1: 2 Barras e
1 Ferramenta; de +9 para +10: 20 Barras e 5 Ferramentas). Sem chance de falhar e
sem perder o item: o jogo é para ser gostoso, não para frustrar.

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
