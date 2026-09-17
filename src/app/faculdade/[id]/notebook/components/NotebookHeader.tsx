'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { NotebookTab } from './types';

export type SyncStatus = 'synced' | 'saving' | 'error';

interface NotebookHeaderProps {
  subjectId: string;
  activeTab: NotebookTab;
  onTabChange: (tab: NotebookTab) => void;
  activeChapterId?: string;
  isCompleted?: boolean;
  onChapterUpdate?: () => void;
  syncStatus?: SyncStatus;
}

export function NotebookHeader({
  subjectId,
  activeTab,
  onTabChange,
  activeChapterId,
  isCompleted = false,
  onChapterUpdate,
  syncStatus = 'synced',
}: NotebookHeaderProps) {
  const [loading, setLoading] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState('DESKTOP VINCULADO');

  // Deteção automática do dispositivo (iPad / Tablet / Desktop)
  useEffect(() => {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isIpad = /iPad|Macintosh/.test(navigator.userAgent) && isTouch;

    if (isIpad) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deteção de dispositivo só é possível no cliente
      setDeviceLabel('IPAD PRO VINCULADO');
    } else if (isTouch) {
      setDeviceLabel('TABLET VINCULADO');
    } else {
      setDeviceLabel('DESKTOP VINCULADO');
    }
  }, []);

  const handleToggleCompleted = async () => {
    if (!activeChapterId) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('chapters')
        .update({ is_completed: !isCompleted })
        .eq('id', activeChapterId);

      if (!error && onChapterUpdate) {
        onChapterUpdate();
      }
    } catch (err) {
      console.error('Erro ao atualizar estado do capítulo:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <header className="h-12 border-b border-[#D8D5CC] bg-[#F6F4EE] px-4 flex items-center justify-between text-[11px] font-mono shrink-0 select-none">
      <div className="flex items-center gap-3 font-bold">
        <Link
          href={`/faculdade/${subjectId}`}
          className="hover:bg-[#111111] hover:text-[#FCF9F2] px-2 py-1 border border-[#D8D5CC] transition-colors uppercase text-[#111111] flex items-center gap-1"
        >
          ← VOLTAR
        </Link>
        <span className="text-[#D8D5CC]">{'//'}</span>
        <span className="text-[#767571] uppercase tracking-wider">FACULDADE</span>
        <span className="text-[#D8D5CC]">{'//'}</span>
        <span className="text-[#111111] uppercase tracking-wider font-extrabold">CADERNO</span>

        {/* BOTÕES DAS ABAS */}
        <div className="flex items-center gap-1 bg-[#EBE8DF] p-0.5 border border-[#D8D5CC] ml-2">
          {(['TEORICAS', 'PRATICAS', 'TESTES'] as NotebookTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`px-3 py-1 text-[10px] uppercase font-bold tracking-wider transition-colors cursor-pointer rounded-none border ${
                activeTab === tab
                  ? 'bg-[#111111] text-[#FCF9F2] border-[#111111]'
                  : 'text-[#767571] border-transparent hover:text-[#111111]'
              }`}
            >
              {tab === 'TEORICAS' ? 'TEÓRICAS' : tab === 'PRATICAS' ? 'PRÁTICAS' : 'TESTES'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10px]">
        {/* BOTÃO DE MARCAR COMO CONCLUÍDO */}
        {activeChapterId && (
          <button
            type="button"
            disabled={loading}
            onClick={handleToggleCompleted}
            className={`px-3 py-1.5 font-bold uppercase transition-all cursor-pointer rounded-none border tracking-wider flex items-center gap-1.5 ${
              isCompleted
                ? 'bg-[#111111] text-[#FCF9F2] border-[#111111] hover:bg-[#31312C]'
                : 'bg-[#EBE8DF] text-[#111111] border-[#D8D5CC] hover:border-[#111111] hover:bg-[#E2DFD6]'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span>{isCompleted ? '✓' : '○'}</span>
            <span>{isCompleted ? 'CAPÍTULO CONCLUÍDO' : 'MARCAR CONCLUÍDO'}</span>
          </button>
        )}

        {/* INDICADOR DE DISPOSITIVO E SINCRONIZAÇÃO */}
        <div className="hidden lg:flex items-center gap-2 text-[#767571] font-mono">
          <span className="w-2 h-2 bg-[#111111] inline-block" />
          <span>{deviceLabel}</span>
          <span className="text-[#D8D5CC]">{'//'}</span>
          <span className="flex items-center gap-1.5 font-bold text-[#111111]">
            <span
              className={`w-2 h-2 inline-block rounded-full ${
                syncStatus === 'saving'
                  ? 'bg-amber-500 animate-pulse'
                  : syncStatus === 'error'
                  ? 'bg-red-500'
                  : 'bg-emerald-600'
              }`}
            />
            {syncStatus === 'saving' && 'A GUARDAR...'}
            {syncStatus === 'synced' && '100% SINCRONIZADO'}
            {syncStatus === 'error' && 'ERRO AO GUARDAR'}
          </span>
        </div>

        {/* BOTÃO DE EXPORTAR PDF */}
        <button
          onClick={handleExportPdf}
          className="bg-[#111111] text-[#FCF9F2] hover:bg-[#31312C] px-3.5 py-1.5 font-bold uppercase transition-colors cursor-pointer rounded-none border border-[#111111] tracking-wider"
        >
          [ EXPORTAR PDF ]
        </button>
      </div>
    </header>
  );
}