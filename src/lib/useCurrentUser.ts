'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  initials: string;
  lastSignInAt: string | null;
}

interface AuthUserLike {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  last_sign_in_at?: string | null;
}

function deriveName(user: AuthUserLike): string {
  const meta = user.user_metadata || {};
  const metaName = (meta.full_name || meta.name) as string | undefined;
  if (metaName && metaName.trim()) return metaName.trim();

  if (user.email) {
    const local = user.email.split('@')[0];
    const cleaned = local.replace(/[._-]+/g, ' ').trim();
    return cleaned || 'Utilizador';
  }

  return 'Utilizador';
}

function toCurrentUser(user: AuthUserLike): CurrentUser {
  const name = deriveName(user);
  return {
    id: user.id,
    email: user.email || '',
    name,
    initials: name.charAt(0).toUpperCase() || 'U',
    lastSignInAt: user.last_sign_in_at || null,
  };
}

/**
 * Devolve o utilizador autenticado (sessão real do Supabase), em vez de
 * dados fictícios. Atualiza automaticamente em login/logout.
 */
export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (!error && data.user) {
        setUser(toCurrentUser(data.user));
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ? toCurrentUser(session.user) : null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
