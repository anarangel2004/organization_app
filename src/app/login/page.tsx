'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/faculdade');
      router.refresh();
    }
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
    } else {
      alert('Conta criada com sucesso! Podes agora fazer login.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FCF9F2] p-4 font-mono">
      <div className="w-full max-w-md border border-[#D8D5CC] bg-white p-6 shadow-sm space-y-4">
        <h1 className="text-xl font-bold uppercase tracking-wider text-[#111111]">
          Acesso // Faculdade
        </h1>

        {error && (
          <div className="p-3 bg-red-100 border border-red-300 text-red-700 text-xs font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs uppercase text-[#767571] font-bold mb-1">
              E-mail
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[#D8D5CC] p-2 text-sm outline-none focus:border-[#111111]"
            />
          </div>

          <div>
            <label className="block text-xs uppercase text-[#767571] font-bold mb-1">
              Palavra-passe
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-[#D8D5CC] p-2 text-sm outline-none focus:border-[#111111]"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#111111] text-[#FCF9F2] py-2 text-xs font-bold uppercase hover:bg-black transition-colors"
            >
              {loading ? 'A entrar...' : 'Entrar'}
            </button>
            <button
              type="button"
              onClick={handleSignUp}
              disabled={loading}
              className="px-4 border border-[#D8D5CC] bg-[#FCF9F2] text-[#111111] py-2 text-xs font-bold uppercase hover:bg-[#F5F1E8] transition-colors"
            >
              Registar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}