# Como trabalhar juntos (guia para iniciantes)

Vocês são **duas pessoas**, cada uma usando o Claude. O Claude é o **coordenador**:
ele lê o `CLAUDE.md`, confere o que o outro está fazendo e segue este guia.
Você não precisa decorar nada: basta pedir ao Claude e ele faz os passos abaixo.

## Ideia geral

```
main  ─────────●───────────────●──────────▶   (sempre funcionando)
                \             /
 feat/sua-tarefa ●──●──●──●──●  ← Pull Request, revisado pelo outro
```

- `main` é a versão "oficial". **Ninguém mexe direto nela.**
- Cada tarefa ganha um **branch** (uma cópia separada).
- Quando a tarefa termina, abre-se um **Pull Request (PR)**: o outro olha e aprova,
  e só então ela entra na `main`.
- Assim um nunca apaga o trabalho do outro.

## O ciclo de uma tarefa

1. **Escolha uma issue** em *Issues* no GitHub (ou crie uma) e se atribua a ela
   (*Assignees*). Assim o outro sabe que você está nela.
2. **Abra o Claude e diga:** `vou trabalhar na issue #N`.
   O Claude vai: atualizar a `main`, criar o branch `feat/N-nome-curto`, conferir
   se a outra pessoa tem PR aberto mexendo nos mesmos arquivos e avisar você.
3. **Trabalhe normalmente** pedindo as mudanças ao Claude.
4. **Ao terminar, diga:** `pode abrir o PR`. O Claude roda os testes, faz o
   commit, envia e abre o PR com `Closes #N`.
5. **Peça a revisão ao amigo.** Ele abre o Claude e diz: `revisa o PR #M`.
6. Aprovado → clique em **Merge** no GitHub (ou peça ao Claude) e apague o branch.
7. Depois de um merge, a outra pessoa diz ao Claude: `atualiza meu branch com a main`.

## Divisão de áreas (evita conflito)

Cada um é "dono" de uma área. Pode mexer na área do outro, mas **avise na issue**.

| Área | Pastas | Dono |
| --- | --- | --- |
| Jogo e servidor | `src/game/`, `src/server/`, `db/`, `docs/design.md` | **Rodrigo** — economia e lógica |
| Arte e telas | `src/art/`, `src/components/`, `src/app/`, `public/`, `docs/visual-identity.md` | **João** — visual |
| Compartilhado (combinar antes) | `CLAUDE.md`, `package.json`, `src/game/config.ts` | os dois |

**Contrato entre as áreas:** as telas só leem o `GameState` (`src/server/game.ts`) e
chamam as ações de `src/app/actions.ts`. Se o Rodrigo mudar o formato do `GameState`
ou criar uma ação nova, ele avisa na issue; o João não mexe em regra de jogo. Mecânica
nova que precisa de tela: Rodrigo entrega o dado + a ação, João faz a tela.

## Rodando o jogo para ver (localhost)

```bash
npm run db:migrate
npm run db:seed     # sítio de demonstração com os 20 moradores + link de login
npm run dev
```

O `db:seed` recria o sítio de demonstração (código `DEMO01`) a cada execução e imprime
um link de login de uso único. Para entrar como outra pessoa:
`SEED_LOGIN=rodrigo npm run db:seed`.

## Regras de ouro

- Uma tarefa = um branch = um PR. PRs pequenos são revisados rápido.
- Nunca `push --force`, nunca commit direto na `main`.
- Conflito no PR? Diga ao Claude: `resolve o conflito com a main`. Ele mostra o
  que mudou dos dois lados **antes** de decidir, e pergunta se tiver dúvida.
- Mudou o banco? Crie migração nova (`002_...sql`), nunca edite a antiga. Antes de
  escolher o número, olhe se o outro já tem um PR com migração.
- Fim do dia: mesmo incompleto, peça `salva meu progresso` (commit + push no seu
  branch). Nada fica só no seu computador.

## Frases úteis para o Claude

| Você diz | O Claude faz |
| --- | --- |
| `o que está acontecendo no projeto?` | resume issues, PRs abertos e quem está em quê |
| `vou trabalhar na issue #N` | prepara o branch e checa conflitos |
| `salva meu progresso` | commit + push no seu branch |
| `pode abrir o PR` | testes + commit + push + PR |
| `revisa o PR #M` | revisão do código do amigo, com comentários |
| `atualiza meu branch com a main` | traz o que já foi aprovado |
| `resolve o conflito com a main` | resolve explicando cada escolha |
