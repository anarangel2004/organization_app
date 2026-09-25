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

// Prazos: não existe "% preparado" nem estado de preparação nas
// avaliações/tarefas. Aplicado por ordem aos cartões de prazo.
export const MOCK_DEADLINE_PREP: { prep: number; state: string }[] = [
  { prep: 80, state: 'Revisto' },
  { prep: 35, state: 'Rascunho' },
  { prep: 60, state: 'Em curso' },
];

// Plano de ação: as tarefas não têm duração, por isso cada tarefa
// pendente conta como esta estimativa no balanceador de carga.
export const MOCK_TASK_HOURS = 1;

// Balanço: não há registo de horas nem de despesas.
export const MOCK_BILLABLE_HOURS = { done: 24.5, target: 30 };
export const MOCK_STUDY_HOURS = { done: 17.8, target: 20 };

export const MOCK_EXPENSES: { label: string; amount: number }[] = [
  { label: 'Fotocópias', amount: 8.2 },
  { label: 'Licença tipográfica', amount: 39 },
  { label: 'Provas de impressão', amount: 14.5 },
];
