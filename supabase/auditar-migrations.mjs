#!/usr/bin/env node
/**
 * Auditoria das migrations do CleanFlow.
 *
 *   node supabase/auditar-migrations.mjs
 *
 * Confere, sem precisar de banco, se cada migration so referencia tabela,
 * view ou funcao que JA existe quando ela roda — ou seja, criada por ela
 * mesma, por uma migration anterior ou pelo schema.sql.
 *
 * Existe porque a migration-55 foi entregue referenciando "public.extras",
 * uma tabela que nunca existiu (os nomes reais sao service_extras e
 * booking_extras). O build do Next nao pega isso: ele valida TypeScript,
 * nao SQL. Sem esta conferencia o erro so aparece no SQL Editor, na mao
 * do David, com a migration ja pela metade.
 *
 * Saida: lista o que nao existe, com arquivo e linha. Sai com codigo 1 se
 * achar algo, para dar para plugar em script de build depois.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));

/** Ordena schema.sql primeiro, depois migration-N pelo numero. */
const arquivos = readdirSync(DIR)
  // So o historico de verdade: schema.sql e migration-N. O
  // teste-remendos.sql fica de fora — ele nao e migration, e o
  // testar-migrations.sh o coloca na posicao certa por conta propria.
  .filter((f) => f === 'schema.sql' || /^migration-\d+-/.test(f))
  .sort((a, b) => {
    if (a === 'schema.sql') return -1;
    if (b === 'schema.sql') return 1;
    const n = (s) => Number(s.match(/migration-(\d+)/)?.[1] ?? 0);
    return n(a) - n(b);
  });

/** Tira comentarios de linha para nao achar referencia dentro deles. */
const semComentarios = (sql) =>
  sql
    .split('\n')
    .map((l) => {
      const i = l.indexOf('--');
      return i === -1 ? l : l.slice(0, i);
    })
    .join('\n');

const CRIA = [
  [/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi, 'tabela'],
  [/create\s+(?:or\s+replace\s+)?view\s+public\.(\w+)/gi, 'tabela'], // view serve como tabela
  [/create\s+(?:or\s+replace\s+)?materialized\s+view\s+public\.(\w+)/gi, 'tabela'],
  [/create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)/gi, 'funcao'],
];

/** Referencias que exigem que o objeto ja exista. */
const USA = [
  [/\bon\s+public\.(\w+)/gi, 'tabela'],
  [/\bfrom\s+public\.(\w+)/gi, 'tabela'],
  [/\bjoin\s+public\.(\w+)/gi, 'tabela'],
  [/\balter\s+table\s+(?:if\s+exists\s+)?public\.(\w+)/gi, 'tabela'],
  [/\bupdate\s+public\.(\w+)/gi, 'tabela'],
  [/\binsert\s+into\s+public\.(\w+)/gi, 'tabela'],
  [/\bdelete\s+from\s+public\.(\w+)/gi, 'tabela'],
  [/\breferences\s+public\.(\w+)/gi, 'tabela'],
  [/\bpublic\.(\w+)\s*\(/gi, 'funcao'],
];

/**
 * Palavras que aparecem como public.X( mas nao sao funcao nossa, ou que
 * sao checadas de proposito (o SQL ja se protege com to_regclass / if
 * exists antes de usar).
 */
const IGNORAR_FUNCAO = new Set(['table', 'view', 'index']);

/**
 * "drop ... if exists" nao exige que o objeto exista — e o jeito de limpar
 * o que uma versao anterior do arquivo criou. Nao e referencia orfa.
 * Cuidado: "drop policy if exists X on public.T" NAO entra aqui, porque o
 * IF EXISTS cobre a politica, nao a tabela: se T nao existir, o Postgres
 * da erro. Foi exatamente assim que a migration-55 quebrou.
 */
const ehDropSeguro = (sql, idx) => {
  const antes = sql.slice(Math.max(0, idx - 60), idx).toLowerCase();
  return /drop\s+(function|view|materialized\s+view|table|type|sequence)\s+if\s+exists\s*$/.test(antes);
};

const conhecidas = { tabela: new Set(), funcao: new Set() };
const problemas = [];

/** Marca o que o proprio arquivo cria, antes de conferir o que ele usa. */
const registrarCriacoes = (sql) => {
  for (const [re, tipo] of CRIA) {
    for (const m of sql.matchAll(re)) conhecidas[tipo].add(m[1].toLowerCase());
  }
};

/** Linha aproximada de um indice no texto. */
const linhaDe = (sql, idx) => sql.slice(0, idx).split('\n').length;

for (const arquivo of arquivos) {
  const bruto = readFileSync(join(DIR, arquivo), 'utf8');
  const sql = semComentarios(bruto);

  // O arquivo pode usar o que ele mesmo cria, entao registra primeiro.
  registrarCriacoes(sql);

  for (const [re, tipo] of USA) {
    for (const m of sql.matchAll(re)) {
      const nome = m[1].toLowerCase();
      if (tipo === 'funcao' && IGNORAR_FUNCAO.has(nome)) continue;
      if (ehDropSeguro(sql, m.index ?? 0)) continue;
      // Uma referencia protegida por to_regclass/if exists no mesmo arquivo
      // e intencional — o SQL confere antes de usar.
      if (conhecidas[tipo].has(nome)) continue;
      // Funcao pode ter o nome de uma tabela e vice-versa em regex solta;
      // so acusa se nao existir em nenhum dos dois conjuntos.
      if (conhecidas.tabela.has(nome) || conhecidas.funcao.has(nome)) continue;
      problemas.push({
        arquivo,
        linha: linhaDe(sql, m.index ?? 0),
        tipo,
        nome,
        trecho: m[0].trim(),
      });
    }
  }
}

if (problemas.length === 0) {
  console.log(`✓ ${arquivos.length} arquivos conferidos — nenhuma referência órfã.`);
  process.exit(0);
}

console.log(`✗ ${problemas.length} referência(s) a objeto que não existe:\n`);
for (const p of problemas) {
  console.log(`  ${p.arquivo}:${p.linha}  ${p.tipo} public.${p.nome}   (${p.trecho})`);
}
console.log('\nOu o nome está errado, ou a migration que cria isso não roda antes.');
process.exit(1);
