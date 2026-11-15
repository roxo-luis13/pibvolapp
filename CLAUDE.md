# Igreja App — PIBC

## Convenção: aviso de novidades a cada atualização no main

Toda vez que uma atualização for mergeada no `main` (uma mudança que os voluntários vão
perceber: nova função, tela nova, mudança de comportamento — não é preciso para fixes
invisíveis de bug ou ajustes internos), adicione uma entrada nova no **topo** do array
`NOVIDADES` em `changelog.js`, com:

- `id`: único, ex. `AAAA-MM-DD-apelido-curto`.
- `titulo`: normalmente "Novidades do app".
- `itens`: lista curta (1–4 frases) do que mudou, em linguagem simples pro voluntário leigo.

Isso faz um popup "Novidades do app" aparecer automaticamente, uma única vez por pessoa
(controlado via `localStorage`), na próxima vez que ela abrir o app depois da atualização.
Não é preciso mexer em nada além desse array — o popup já lê a entrada mais recente sozinho.

## Fluxo de publicação: sempre passar pelo link de teste

Toda alteração vai **primeiro** para a branch `claude/pibvolapp-setup-qhhn0w`, que é o link de teste:
https://raw.githack.com/roxo-luis13/pibvolapp/claude/pibvolapp-setup-qhhn0w/index.html

Só envie para a `main` (app oficial no GitHub Pages) quando o responsável pedir explicitamente.
Atenção: o link de teste usa o **mesmo banco Supabase** do app oficial. Migrações e Edge Functions
valem para os dois na hora, então precisam ser compatíveis com o código que está na `main`.
