# SQL Viewer

Ferramenta da equipe de suporte para visualizar o resultado de consultas MySQL copiadas
do grid do cliente SQL: tabela interativa, ficha do registro, gráficos simples e saídas
(CSV, Excel e "copiar para chamado").

**Todo o processamento acontece no navegador.** Não há API routes, server actions,
analytics, logs, login, banco de dados nem localStorage. Os dados colados ficam só na
memória da página e somem ao fechá-la.

## Rodar localmente

Requer Node.js 20 ou superior.

```bash
npm install
```

```bash
npm run dev
```

Acesse http://localhost:3000.

Outros comandos:

```bash
npm test
```

```bash
npm run build
```

## Deploy na Vercel

1. Envie o repositório para o GitHub.
2. Na Vercel, clique em **Add New → Project** e importe o repositório. O framework
   (Next.js) é detectado sozinho; não há variáveis de ambiente.
3. Clique em **Deploy**. A cada push na branch principal a Vercel publica uma nova versão.

A aplicação é estática (sem funções de servidor), então qualquer plano da Vercel atende.

## Como adicionar um novo perfil

Os perfis ficam em [`config/perfis.ts`](config/perfis.ts). Eles são opcionais: qualquer
consulta funciona como "Genérica" mesmo sem perfil. Para adicionar um, inclua um objeto
na lista `PERFIS`:

```ts
{
  id: "CADCLI",                       // identificador (vira o nome padrão da aba)
  nome: "Cadastro de clientes",       // texto exibido no badge e no seletor
  assinatura: ["CLI_CODCLI", "CLI_NOMCLI"],
  colunasPadrao: ["CLI_CODCLI", "CLI_NOMCLI", "CLI_CGCCPF", "CLI_CIDADE"],
  colunasFixas: ["CLI_CODCLI"],
  colunaTitulo: "CLI_NOMCLI",
  graficoSugerido: { modo: "contagem", categoria: "CLI_ESTADO" },
  relacoes: [
    { perfil: "FATGOR", colunaOrigem: "CLI_CODCLI", colunaDestino: "FGO_CODCLI", rotulo: "Pedidos do cliente" },
  ],
  rotulosInversos: { FATGOR: "Cliente" },
},
```

Para a visão **Tela** (o registro exibido como formulário de ERP), acrescente `tela`:

```ts
  tabela: "CADCLI",                    // nome no banco para o SQL sugerido (padrão: id)
  totais: ["CLI_LIMITE"],              // colunas somadas quando esta tabela aparece como grade em outra Tela
  tela: {
    titulo: "Cliente",                 // título = "Cliente " + valor de colunaTitulo
    subtitulo: [{ coluna: "CLI_CIDADE", rotulo: "Cidade" }],
    status: [
      { coluna: "CLI_BLOQUE", rotulo: "Bloqueado",
        valores: { S: { texto: "Sim", cor: "vermelho" }, N: { texto: "Não", cor: "verde" } } },
    ],
    destaques: [{ coluna: "CLI_LIMITE", rotulo: "Limite de crédito", formato: "moeda" }],
    secoes: [
      { titulo: "Dados cadastrais", campos: [
        { coluna: "CLI_NOMCLI", rotulo: "Razão social", largo: true },
        { coluna: "CLI_DTACAD", rotulo: "Cadastro", hora: "CLI_HORCAD" },
        { coluna: "CLI_TIPPES", rotulo: "Tipo", valores: { F: "Física", J: "Jurídica" } },
      ] },
    ],
  },
```

Na Tela, colunas não citadas em nenhuma seção vão para "Outros campos"; campos NULL, vazios
ou zerados ficam ocultos até marcar "Mostrar campos vazios"; o nome técnico da coluna
aparece ao lado de cada rótulo. Sem `tela`, o formulário é montado automaticamente,
agrupado por tipo. Os rótulos da FATGOR são um ponto de partida: revise-os em
`config/perfis.ts`. Quando uma relação do perfil não tem aba aberta, a Tela sugere o
`SELECT` para buscar os registros ligados.

O que cada campo faz:

| Campo | Obrigatório | Uso |
| --- | --- | --- |
| `id` | sim | Identificador único. A aba recebe esse nome ("CADCLI", "CADCLI 2"...). |
| `nome` | sim | Descrição exibida na interface. |
| `assinatura` | sim | Colunas que **todas** precisam existir no resultado para reconhecer a tabela. Escolha colunas que só essa tabela tem. |
| `colunasPadrao` | não | Colunas visíveis ao abrir, nesta ordem. As demais começam ocultas. Se nenhuma existir no resultado, todas aparecem. |
| `colunasFixas` | não | Colunas fixadas à esquerda. |
| `colunaTitulo` | não | Coluna usada como título da ficha do registro. |
| `graficoSugerido` | não | Gráfico inicial: `contagem` por `categoria`, ou `soma` de `valor` por `categoria`. Se as colunas não existirem, o gráfico é sugerido automaticamente. |
| `relacoes` | não | Ligações com outros perfis. Valem nos dois sentidos: basta declarar em um dos lados. |
| `tabela` | não | Nome da tabela no banco usado no SQL sugerido (padrão: o `id`). |
| `totais` | não | Colunas somadas no rodapé quando a tabela aparece como grade na Tela de outra (padrão: todas as decimais). |
| `tela` | não | Layout da visão Tela: `titulo`, `subtitulo`, `status` (chips coloridos), `destaques` (cartões), `secoes`. Campos aceitam `formato` (`moeda`, `percentual`), `hora`, `valores` e `largo`. |
| `rotulosInversos` | não | Rótulo exibido **neste** perfil para uma relação declarada em outro (chave = id do perfil que declarou). Sem ele, aparece o `nome` do outro perfil. |

Regras da detecção:

- Se vários perfis casarem e a assinatura de um contiver a do outro, vence a mais longa.
- Se casarem perfis de tabelas diferentes (resultado de JOIN), a consulta vira
  **"Consulta combinada"** (genérica) e o usuário é avisado.
- Colunas declaradas no perfil que não vierem no resultado são ignoradas sem erro.
- O usuário sempre pode trocar o perfil (ou escolher "Genérica") pelo seletor do resumo.
- As chaves das relações são comparadas como texto (com trim), nunca como número, para
  preservar zeros à esquerda e chaves de 20 dígitos.

Depois de editar, rode `npm test` (há testes de detecção em `lib/__tests__/perfis.test.ts`)
e, se quiser, acrescente um caso para o novo perfil.

## Estrutura

```
app/                 página única (Next.js App Router)
components/          interface: abas, entrada, tabela virtualizada, ficha, gráficos, saídas
config/perfis.ts     perfis de tabela (editável)
lib/parser.ts        parser do texto copiado + inferência de tipos
lib/perfis.ts        detecção de perfil e chaves de relação
lib/estado.ts        estado das abas (useReducer)
lib/filtragem.ts     busca, filtros e ordenação
lib/graficos.ts      candidatas e agregação dos gráficos
lib/exportar.ts      CSV, Excel e "copiar para chamado"
fixtures/            exemplo real de resultado (FATGOR)
```

### Formato aceito

Primeira linha = cabeçalho; colunas separadas por TAB; valores entre aspas duplas ou sem
aspas. `\N` e `NULL` sem aspas são NULL; `"NULL"` entre aspas é texto; `""` é string vazia
(diferente de NULL). Campos entre aspas podem conter TAB, quebra de linha e `""` (aspa
escapada). Todo valor é guardado como o texto original; os tipos inferidos (inteiro,
decimal, data, hora, data-hora, texto/código) servem só para exibir, ordenar e calcular.
Valores com zero à esquerda ou com mais de 15 dígitos são sempre texto/código.
