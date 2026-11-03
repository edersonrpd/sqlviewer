# Instruções para o Claude

- **Sempre coloque as alterações em produção.** Depois de commitar e enviar a branch de
  trabalho, abra o PR para a branch principal do repositório (a que a Vercel publica;
  hoje `claude/optimistic-edison-jo5n3q`) e faça o merge, sem esperar novo pedido.
- Rode `npx vitest run` antes do merge. O pacote `xlsx` vem de cdn.sheetjs.com, que pode
  estar bloqueado no ambiente: nesse caso instale as demais dependências sem ele, só para
  os testes, e não commite mudanças em `package.json`/`package-lock.json`.
