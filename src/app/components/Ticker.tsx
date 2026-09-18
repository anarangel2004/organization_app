'use client';

import { TickerItem } from './types';

interface TickerProps {
  items: TickerItem[];
}

// Faixa de prazos críticos no topo da página principal: um loop contínuo
// (duas cópias do mesmo conteúdo lado a lado, animadas com translateX(-50%))
// que pausa ao passar o rato. Ver a keyframe .ticker-track em globals.css.
export function Ticker({ items }: TickerProps) {
  return (
    <div className="w-full bg-[#111111] text-[#FCF9F2] overflow-hidden font-mono text-[10px] tracking-widest uppercase py-2">
      <div className="ticker-track">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex items-center shrink-0">
            <span className="px-4 font-bold shrink-0">PRAZOS CRÍTICOS // TRANSMISSÃO DIRETA:</span>
            {items.length > 0 ? (
              items.map((item) => (
                <span key={`${copy}-${item.id}`} className="px-4 flex items-center gap-2 shrink-0">
                  {item.text}
                  <span className="bg-[#FCF9F2] text-[#111111] px-1.5 py-0.5 font-bold">{item.tag}</span>
                </span>
              ))
            ) : (
              <span className="px-4 shrink-0">SEM PRAZOS CRÍTICOS NOS PRÓXIMOS 7 DIAS</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
