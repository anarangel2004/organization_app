// ============================================================
// DADOS DE EXEMPLO (INVENTADOS) DO PAINEL
// ------------------------------------------------------------
// Tudo o que está neste ficheiro NÃO vem da base de dados: são
// valores fictícios que preenchem partes do design para as quais
// ainda não existe tabela/coluna no Supabase. Quando essas fontes
// existirem, substitui cada constante pela consulta real e apaga-a
// daqui. Nada fora deste ficheiro inventa dados.
// ============================================================

// Faixa superior: citação fixa do design.
export const MOCK_QUOTE = 'O rigor é uma forma de liberdade.';

// Cabeçalho: localização editorial (não há morada/perfil com cidade).
export const MOCK_LOCATION = 'Lisboa';

// Balanço: não há registo de horas nem de despesas.
export const MOCK_BILLABLE_HOURS = { done: 24.5, target: 30 };
export const MOCK_STUDY_HOURS = { done: 17.8, target: 20 };

export const MOCK_EXPENSES: { label: string; amount: number }[] = [
  { label: 'Fotocópias', amount: 8.2 },
  { label: 'Licença tipográfica', amount: 39 },
  { label: 'Provas de impressão', amount: 14.5 },
];

// Trabalho: não há registo de horas por projeto. Aplicado por ordem aos
// projetos (o primeiro recebe o primeiro valor…); o total do mês é o
// MOCK_BILLABLE_HOURS acima. Projetos a mais ficam sem horas ("—").
export const MOCK_PROJECT_HOURS: number[] = [11.5, 7, 4.5, 1.5];
