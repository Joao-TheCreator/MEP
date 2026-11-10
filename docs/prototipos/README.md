# Protótipos (prévias interativas)

Páginas soltas, só para ver e testar ideias antes de virarem tela de verdade.
Não fazem parte do jogo: os números vêm de `src/game/config.ts`, mas itens,
moedas e estoque são exemplos.

| Prévia | Abrir no navegador |
| --- | --- |
| **Jogo completo (demonstração)**: as telas do João (branch `art/farm-screen-redesign`) com as regras reais, sem servidor. Os outros 19 moradores jogam sozinhos; painel "Teste" acelera o tempo. Código de convite: DEMO01 | [jogo-demo.html](https://raw.githack.com/Joao-TheCreator/MEP/main/docs/prototipos/jogo-demo.html) |
| Personagem (celular deitado): atributos, árvore de habilidades, equipamento e mochila | [personagem.html](https://raw.githack.com/Joao-TheCreator/MEP/main/docs/prototipos/personagem.html) |
| Tela do Sítio (PR #15): mapa em tela cheia, gaveta da obra, construções clicáveis | [tela-sitio.html](https://raw.githack.com/Joao-TheCreator/MEP/main/docs/prototipos/tela-sitio.html) |

Os links abrem a versão que está na `main`. Também dá para baixar o arquivo e abrir
direto no navegador.

## Como a demonstração é feita

`jogo-demo.html` é gerado a partir do código do jogo: as telas de `src/components/`,
as regras de `src/game/` e o protótipo da noite (`src/prototype/night/`). No lugar do
servidor e do Postgres, um "servidor de mentira" no navegador aplica as mesmas regras
de `src/server/game.ts` e guarda tudo no próprio navegador. Por isso não tem login
por e-mail, e cada pessoa joga num sítio só dela.
