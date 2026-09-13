export type NotebookTab = 'TEORICAS' | 'PRATICAS' | 'TESTES';
export type PaperStyle = 'PAUTADO' | 'QUADRICULA' | 'LISO';

export interface Chapter {
  id: string;
  subjectId: string;
  number: string;
  title: string;
  category: NotebookTab;
  content: string;
  drawingData?: string; // Desenho do Apple Pencil guardado
  pdfUrl?: string;
  pdfName?: string;
  isCompleted?: boolean; // <-- Adicionado
  createdAt?: string;
  updatedAt?: string;
}

// Alias para garantir compatibilidade caso algum componente use ChapterData
export type ChapterData = Chapter;