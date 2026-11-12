# Identidade visual — Sítio Dae Han

Referências enviadas pelo grupo: logo da igreja (chama + mão), vista de satélite
da **Chácara Coreana / Templo Dae Han** e foto do templo principal, além das
fotos do pessoal (usadas só como referência; **nenhuma foto fica no repositório**,
só os bonecos pixelados derivados delas).

Veja tudo renderizado em **`/art`** (guia de arte vivo).

## Estilo

- **Pixel art suave:** sem contorno preto. Sombra e contorno são feitos com tons
  mais escuros da própria cor, como no tijolo e nas folhas. Texturas com variações
  sutis (pontilhado/ruído determinístico), nunca degradê liso.
- **Clima aconchegante de jogo de fazenda**, mas arte 100% original: não copiar
  sprites, telas, fontes ou ícones de nenhum jogo existente.
- **Interface:** painéis de "pergaminho" com moldura de madeira em pixel
  (`box-shadow` em camadas de 3px), botões com bisel de 1 pixel.
- **Escala:** sprites sempre em múltiplos inteiros (2×, 3×, 4×) com
  `shape-rendering="crispEdges"`.

## Tipografia

| Uso | Fonte | Observação |
| --- | --- | --- |
| Títulos, botões, números | **Pixelify Sans** (500) | pixel, traço fino |
| Texto corrido | **VT323** | monoespaçada fina, ótima leitura em 20–24px |

Ambas via `next/font/google` (`src/app/layout.tsx`).

## Paleta (`src/art/palette.ts`)

| Origem | Cores |
| --- | --- |
| Logo — chama | `#de4a47` vermelho · `#f0566a` rosa · `#e5603a` brasa |
| Logo — mão | `#8e2d52` vinho · `#6e2040` vinho escuro |
| Templo | `#b5553c` tijolo · `#efe8d8` arcos/colunas · `#8d887d` telhado |
| Mata/gramado | `#86ad52` grama · `#4f8a3c` folha · `#264f27` mata fechada |
| Água | `#6cc5d6` piscina |
| UI | `#f8ecd2` pergaminho · `#a8703f` madeira · `#3b2630` tinta |

Botão principal = vermelho da chama; destaques/títulos = vinho da mão.

## Mapa do sítio (`src/art/FarmMap.tsx`)

Layout baseado no satélite: campo aberto no canto superior esquerdo, mata densa
em volta (árvores + palmeiras), **piscina cercada** no meio, **templo principal**
logo abaixo (tijolo, arcos brancos, telhado cinza de quatro águas), casinhas de
telhado laranja a sudoeste, outro prédio no canto nordeste. As construções
coletivas aparecem no mapa: canteiro de obras enquanto estão em andamento e o
prédio pronto depois (Poço ao lado da piscina, Celeiro à esquerda, Moinho a leste).

## Bonecos (`src/art/avatars.ts`)

Bustos 20×22 gerados por parâmetros (pele, cabelo, estilo, boné, óculos, barba,
roupa…). Cada pessoa do grupo escolhe o seu ao entrar; um boneco por pessoa em
cada sítio. O **Jondo (Diego)**, líder, usa um broche com a chama da logo.

Para **adicionar alguém**: inclua uma nova chave em `AVATARS` (nunca renomeie uma
chave existente, ela fica salva no banco em `players.avatar`) e confira em `/art`.

## Bonecos de corpo inteiro (`src/art/walker.ts`)

Sprites 18×26 gerados do **mesmo** `AvatarSpec` dos retratos: a cabeça vem do retrato e
o corpo (camisa, braços, calça, sapatos) é desenhado abaixo. Quatro direções (frente,
costas, direita e esquerda espelhada), cada uma com 3 quadros: parado, passo A, passo B.
Calça e sapatos podem ser personalizados por pessoa (`pants`, `pantsShade`, `shoes`).
O componente `Walker` (`src/art/WalkerSprite.tsx`) anima os quadros e respeita
“reduzir movimento”. Veja todos em `/art`.

## Sítio vivo (`src/art/FarmScene.tsx`)

Na aba Sítio, os moradores andam pelo mapa. É só enfeite: roda no navegador e não
muda nada do jogo.

- **Caminhos:** os bonecos andam por uma rede de pontos (`NODES`/`EDGES`) nas trilhas,
  no pátio, no campo e no gramado; param um pouco e seguem. Para abrir uma área nova,
  acrescente pontos e ligações (em dev, `/art` desenha a rede em rosa).
- **Escala:** bonecos em meia escala (1 pixel do boneco = ½ pixel do mapa), para o rosto
  continuar legível sem ficarem do tamanho das casas. O mapa aparece com zoom 2× numa
  janela que se arrasta, começando no pátio.
- **Profundidade:** cenário e bonecos são ordenados pela linha dos pés, então ninguém
  “flutua” na frente de uma construção.
- Tocar num boneco mostra nome, profissão e nível; seu boneco tem uma setinha rosa.
- Com “reduzir movimento”, ficam parados.

## Tela do Sítio (`src/components/screens/FarmScreen.tsx`)

- O mapa ocupa toda a área entre a barra de cima e as abas (`.shell.full` +
  `.farm-stage`); a dica e o botão **Convidar** flutuam por cima.
- A **construção atual** fica numa gaveta embaixo (`.drawer`): fechada mostra o nome e
  o % pronto; tocando, abre com os recursos e os botões de doar.
- **Construções são clicáveis.** Cada sprite do mapa tem uma chave (`place` em
  `FarmMap.farmItems`): templo, piscina, casinha, anexo e as construções coletivas
  (poço, celeiro, moinho — inclusive o canteiro de obras). Tocar mostra um balão com o
  nome e a gaveta passa a descrever o lugar (`LANDMARKS` em `FarmMap.tsx` para os fixos,
  `BUILDINGS` da config para os coletivos). Tocar no chão ou num morador fecha a gaveta.

## Pendências

- Commitar o arquivo original da logo em `public/brand/logo.png` (o jogo usa a
  versão pixelada `LOGO` em `src/art/sprites.ts`).

## Sítio vivo (roadmap 1b)

O mapa mostra o que está acontecendo no jogo:

- **Locais de trabalho** das quatro profissões, em `src/art/workplaces.ts`: Lavoura (duas
  hortas no campo), Curral (cercado com a vaca, a oeste), Serraria (toras e cavalete, a
  leste) e Forja (forno de pedra e bigorna, a sudeste). Todos são tocáveis, como as obras.
- **Cada um no seu canto:** de dia os moradores andam perto do local da própria profissão
  (`spot` em `FarmScene`); ainda passeiam, mas voltam. À noite, quem já fez a ronda senta
  em roda **atrás e ao lado** da fogueira, nunca na frente, para a chama aparecer.
- **Fogueira** ao sul do templo (`FIRE_SPOT`). A chama fica menor quando a vida está
  abaixo de 35%; tocar nela abre a aba Noite.
- **Dia e noite** (`src/art/daylight.ts`, horário de Brasília): o mapa escurece das 17h às
  20h (hora da horda), fica escuro até as 5h e clareia até as 7h. O brilho da fogueira
  cresce com a escuridão e com a vida dela.
- A página `/art` mostra a cena de dia e às 21h com a fogueira fraca.
