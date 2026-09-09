'use client';

import { useState, useEffect, use } from 'react';
import { Folder, Plus, FileText, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SubjectFile {
  id: string;
  title: string;
  file_name: string;
  file_url?: string;
  file_size?: string;
}

export default function MateriaisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const rawId = decodeURIComponent(resolvedParams.id).toLowerCase();

  const [files, setFiles] = useState<SubjectFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFiles = async () => {
      setLoading(true);

      const { data: subjects } = await supabase.from('subjects').select('*');

      const foundSubject = subjects?.find((s) => {
        const sId = String(s.id).toLowerCase();
        const sCode = String(s.code || '').toLowerCase();
        const sNameSlug = s.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '-');

        const cleanRawId = rawId
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');

        return sId === rawId || sCode === rawId || sNameSlug === cleanRawId;
      });

      if (foundSubject) {
        const { data: filesData } = await supabase
          .from('subject_files')
          .select('*')
          .eq('subject_id', foundSubject.id)
          .order('created_at', { ascending: false });

        if (filesData) setFiles(filesData);
      }

      setLoading(false);
    };

    fetchFiles();
  }, [rawId]);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-sm text-white">
          <Folder className="w-4 h-4 text-sky-400" />
          <span>Repositório de Ficheiros</span>
        </div>

        <button className="bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-2 cursor-pointer">
          <Plus className="w-4 h-4" /> Adicionar Ficheiro
        </button>
      </div>

      <div className="bg-slate-900/30 border border-slate-800/60 rounded-2xl p-8 min-h-[250px] flex items-center justify-center">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
            <span>A carregar materiais...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center text-slate-500 space-y-2">
            <Folder className="w-10 h-10 mx-auto text-slate-700" />
            <p className="text-xs">Nenhum PDF, exame ou exercício associado a esta cadeira.</p>
          </div>
        ) : (
          <div className="w-full space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between hover:bg-slate-800/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-sky-400" />
                  <div>
                    <p className="text-xs font-semibold text-white">{file.title}</p>
                    <p className="text-[10px] text-slate-400">{file.file_name}</p>
                  </div>
                </div>
                {file.file_url && (
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-slate-400 hover:text-white transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}