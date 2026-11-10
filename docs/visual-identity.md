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

## Pendências

- Commitar o arquivo original da logo em `public/brand/logo.png` (o jogo usa a
  versão pixelada `LOGO` em `src/art/sprites.ts`).
- Bonecos de corpo inteiro andando no mapa (pós-MVP).
