'use client';

import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, ShieldCheck, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

interface UserData {
  name: string;
  email: string;
  role: string;
  code: string;
}

interface UserProfileMenuProps {
  user?: UserData | null;
  onOpenProfileModal?: () => void;
}

const FALLBACK_USER: UserData = {
  name: 'A CARREGAR…',
  email: '',
  role: '—',
  code: '—',
};

export default function UserProfileMenu({ user, onOpenProfileModal }: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const displayUser = user ?? FALLBACK_USER;

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsOpen(false);
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="relative inline-block text-left font-mono z-40" ref={dropdownRef}>
      {/* Botão Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-3 py-2 bg-white border border-black hover:bg-black hover:text-white transition-all duration-150 group"
      >
        <div className="w-6 h-6 bg-black text-white group-hover:bg-white group-hover:text-black flex items-center justify-center font-bold text-xs transition-colors">
          {displayUser.name.charAt(0)}
        </div>
        <div className="text-left hidden sm:block">
          <p className="font-bold text-xs leading-none tracking-tight">{displayUser.name}</p>
          <p className="text-[9px] text-neutral-500 group-hover:text-neutral-300 leading-none mt-1">
            {displayUser.code}
          </p>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Menu Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-[#FBF9F5] border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 p-2">
          {/* Cabeçalho do Utilizador */}
          <div className="p-3 bg-white border border-neutral-300 mb-2">
            <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-bold uppercase tracking-wider mb-1">
              <ShieldCheck className="w-3 h-3 text-black" />
              <span>Sessão Ativa</span>
            </div>
            <p className="text-xs font-bold uppercase text-black truncate">{displayUser.name}</p>
            <p className="text-[11px] text-neutral-600 truncate">{displayUser.email}</p>
            <div className="mt-2 text-[9px] bg-neutral-100 border border-neutral-300 px-1.5 py-0.5 inline-block font-bold">
              {displayUser.role}
            </div>
          </div>

          {/* Opções de Ação */}
          <div className="space-y-1">
            <button
              onClick={() => {
                setIsOpen(false);
                if (onOpenProfileModal) onOpenProfileModal();
              }}
              className="w-full text-left px-3 py-2 text-xs uppercase flex items-center gap-2.5 text-black hover:bg-black hover:text-white transition-colors"
            >
              <User className="w-4 h-4" />
              <span>Ver Ficha de Perfil</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 text-xs uppercase flex items-center gap-2.5 text-red-600 hover:bg-red-600 hover:text-white transition-colors border-t border-neutral-200 mt-1 pt-2 font-bold"
            >
              <LogOut className="w-4 h-4" />
              <span>Encerrar Sessão</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
