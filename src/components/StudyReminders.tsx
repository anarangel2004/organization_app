'use client';

// Lembretes dos blocos de estudo: com a app aberta (separador ou ecrã
// principal), avisa X minutos antes de cada bloco do plano. Os blocos são
// publicados pelo /estudo e pela Visão Geral (ver publishReminders).
// Não há servidor de notificações: com a app fechada não há avisos.

import { useEffect } from 'react';
import { notificationState, readReminders } from '@/lib/study';

const SENT_KEY = 'estudo:lembretes:enviados';

function readSent(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(SENT_KEY) || '[]') as string[];
  } catch {
    return [];
  }
}
function markSent(id: string) {
  try {
    // Guarda só os últimos 200 avisos.
    window.localStorage.setItem(SENT_KEY, JSON.stringify([...readSent().filter((x) => x !== id), id].slice(-200)));
  } catch {
    // sem storage: pode repetir, não é grave
  }
}

async function show(title: string, body: string, url: string, tag: string) {
  // No iPhone/iPad (app no ecrã principal) só funciona através do service worker.
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) {
      await reg.showNotification(title, { body, tag, data: { url }, icon: '/favicon.ico' });
      return;
    }
  } catch {
    // tenta a notificação simples
  }
  const n = new Notification(title, { body, tag });
  n.onclick = () => {
    window.focus();
    window.location.href = url;
    n.close();
  };
}

export default function StudyReminders() {
  useEffect(() => {
    const check = () => {
      const schedule = readReminders();
      if (!schedule?.enabled || notificationState() !== 'granted') return;
      const now = Date.now();
      const sent = new Set(readSent());
      for (const it of schedule.items) {
        const start = new Date(it.startsAt).getTime();
        const at = start - schedule.minutesBefore * 60000;
        // Avisa a partir da hora do lembrete e até 5 min depois do início.
        if (now >= at && now <= start + 5 * 60000 && !sent.has(it.id)) {
          markSent(it.id);
          void show(it.title, it.body, it.url, it.id);
        }
      }
    };
    check();
    const id = window.setInterval(check, 30_000);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
