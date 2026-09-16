'use client';

import React from 'react';
import { X, LogOut, User, Mail, ShieldAlert, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: {
    name: string;
    email: string;
    role: string;
    institution: string;
    code: string;
    lastAccess: string;
  };
}

export default function ProfileModal({
  isOpen,
  onClose,
  user = {
    name: 'UTILIZADOR ATELIER',
    email: 'estudante@atelier-agenda.pt',
    role: 'MESTRADO EM ARQUITETURA',
    institution: 'DEPT. CIÊNCIAS & HUMANIDADES',
    code: 'USR-2026//04',
    lastAccess: 'HÁ 2 DIAS'
  }
}: ProfileModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleLogout = () => {
    // Adiciona a tua lógica de logout
    router.push('/login');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 font-mono">
      <div className="bg-[#FBF9F5] border-2 border-black w-full max-w-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
        
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between bg-black text-white px-4 py-3">
          <span className="text-xs uppercase font-bold tracking-widest flex items-center gap-2">
            <User className="w-4 h-4" /> // REGISTO DE PERFIL DE UTILIZADOR
          </span>
          <button 
            onClick={onClose}
            className="hover:bg-neutral-800 p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 space-y-6">
          
          {/* Identificação Principal */}
          <div className="border border-black p-4 bg-white flex items-center gap-4">
            <div className="w-16 h-16 bg-black text-white font-extrabold text-2xl flex items-center justify-center border border-black">
              {user.name.charAt(0)}
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wider">{user.code}</p>
              <h2 className="text-xl font-extrabold text-black uppercase tracking-tight">{user.name}</h2>
              <p className="text-xs font-bold text-neutral-700 mt-0.5">{user.email}</p>
            </div>
          </div>

          {/* Tabela de Parâmetros Curriculares / Sistema */}
          <div className="border border-black bg-white">
            <div className="bg-neutral-100 px-3 py-1.5 border-b border-black text-[10px] font-bold uppercase tracking-wider text-neutral-600">
              DADOS DE CREDENCIAÇÃO
            </div>
            
            <div className="divide-y divide-neutral-200 text-xs">
              <div className="p-3 flex justify-between items-center">
                <span className="text-neutral-500 uppercase">CURSO / CARGO</span>
                <span className="font-bold text-black uppercase">{user.role}</span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span className="text-neutral-500 uppercase">DEPARTAMENTO</span>
                <span className="font-bold text-black uppercase">{user.institution}</span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span className="text-neutral-500 uppercase">ÚLTIMO ACESSO</span>
                <span className="font-bold text-black uppercase">{user.lastAccess}</span>
              </div>
            </div>
          </div>

          {/* Aviso de Encerramento */}
          <div className="p-3 bg-neutral-100 border border-neutral-300 text-[11px] text-neutral-600 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-black shrink-0 mt-0.5" />
            <span>Ao encerrar a sessão, todas as instâncias locais serão desincronizadas temporariamente até ao próximo login.</span>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleLogout}
              className="flex-1 bg-black text-white py-3 px-4 font-bold text-xs uppercase hover:bg-red-600 transition-colors flex items-center justify-center gap-2 border border-black"
            >
              <LogOut className="w-4 h-4" />
              ENCERRAR SESSÃO // LOGOUT
            </button>
            <button
              onClick={onClose}
              className="py-3 px-6 bg-white text-black font-bold text-xs uppercase hover:bg-neutral-200 transition-colors border border-black"
            >
              FECHAR
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}