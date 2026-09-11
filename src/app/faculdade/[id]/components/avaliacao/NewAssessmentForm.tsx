'use client';

import { useState } from 'react';
import { AssessmentFileUploader } from './AssessmentFileUploader';

interface NewAssessmentFormProps {
  onAddItem: (itemData: {
    category: 'TEORICA' | 'PRATICA';
    title: string;
    weight: number;
    date: string;
    chapters: string;
    fileName: string;
    fileUrl: string;
  }) => Promise<void>;
  onFileUpload: (
    e: React.ChangeEvent<HTMLInputElement>,
    targetItemId?: string
  ) => Promise<{ fileName: string; fileUrl: string } | undefined>;
  uploading: boolean;
}

export function NewAssessmentForm({
  onAddItem,
  onFileUpload,
  uploading,
}: NewAssessmentFormProps) {
  const [category, setCategory] = useState<'TEORICA' | 'PRATICA'>('TEORICA');
  const [title, setTitle] = useState('');
  const [weight, setWeight] = useState<number | ''>(20);
  const [date, setDate] = useState('');
  const [chapters, setChapters] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const res = await onFileUpload(e);
    if (res) {
      setFileName(res.fileName);
      setFileUrl(res.fileUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddItem({
      category,
      title,
      weight: typeof weight === 'number' ? weight : 0,
      date,
      chapters,
      fileName,
      fileUrl,
    });
    setTitle('');
    setWeight(20);
    setDate('');
    setChapters('');
    setFileName('');
    setFileUrl('');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#111111] text-[#FCF9F2] p-4 border border-[#31312C] font-mono text-[10px] space-y-4 uppercase"
    >
      <div className="font-bold tracking-wider text-[#FCF9F2] border-b border-[#31312C] pb-2">
        NOVA AVALIAÇÃO // NOVO ITEM
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="block text-[8.5px] font-bold text-[#A1A09A]">1. RAMO</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as 'TEORICA' | 'PRATICA')}
            className="w-full bg-[#1B1B18] border border-[#31312C] p-1.5 font-bold text-[#FCF9F2] focus:outline-none"
          >
            <option value="TEORICA">RAMO TEÓRICO</option>
            <option value="PRATICA">RAMO PRÁTICO</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-[8.5px] font-bold text-[#A1A09A]">2. TÍTULO</label>
          <input
            type="text"
            placeholder="EX: TESTE 1 / LAB 1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#1B1B18] border border-[#31312C] p-1.5 font-bold text-[#FCF9F2] focus:outline-none text-[10px]"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[8.5px] font-bold text-[#A1A09A]">3. PESO NO RAMO (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={weight}
            onChange={(e) => setWeight(e.target.value === '' ? '' : parseFloat(e.target.value))}
            className="w-full bg-[#1B1B18] border border-[#31312C] p-1.5 font-bold text-[#FCF9F2] focus:outline-none text-[10px]"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[8.5px] font-bold text-[#A1A09A]">4. DATA REALIZAÇÃO / ENTREGA</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-[#1B1B18] border border-[#31312C] p-1.5 font-bold text-[#FCF9F2] focus:outline-none text-[10px] [color-scheme:dark]"
          />
        </div>

        <div className="col-span-1 sm:col-span-2 space-y-1">
          <label className="block text-[8.5px] font-bold text-[#A1A09A]">5. CAPÍTULOS / CONTEÚDO</label>
          <input
            type="text"
            placeholder="EX: CAPÍTULOS 1 A 4"
            value={chapters}
            onChange={(e) => setChapters(e.target.value)}
            className="w-full bg-[#1B1B18] border border-[#31312C] p-1.5 font-bold text-[#FCF9F2] focus:outline-none text-[10px]"
          />
        </div>

        <div className="col-span-1 sm:col-span-2">
          <AssessmentFileUploader
            fileName={fileName}
            uploading={uploading}
            onUpload={handleUpload}
            label="6. ANEXAR ENUNCIADO / FICHEIRO"
          />
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <button
          type="submit"
          className="bg-[#FCF9F2] text-[#111111] px-4 py-1.5 font-bold hover:bg-[#E5E2D9] transition-colors cursor-pointer"
        >
          GUARDAR AVALIAÇÃO
        </button>
      </div>
    </form>
  );
}