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
  createdAt?: string;
  updatedAt?: string;
}