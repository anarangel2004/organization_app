'use client';

export function NotebooksSection() {
  return (
    <section id="notebooks" className="space-y-6 pt-12">
      <div className="border-b border-[#D8D5CC] pb-4 flex justify-between items-end">
        <div>
          <span className="font-mono text-[10px] tracking-[0.12em] text-[#767571] uppercase block mb-1">
            SECÇÃO 02 // REPOSITÓRIO DE APONTAMENTOS
          </span>
          <h2 className="font-display text-6xl sm:text-7xl md:text-8xl leading-[0.9] text-[#111111] uppercase tracking-[-0.01em]">
            NOTEBOOKS.
          </h2>
        </div>

        {/* ESTATÍSTICA GERAL */}
        <div className="text-right hidden sm:block">
          <span className="font-mono text-[9px] tracking-[0.12em] text-[#767571] uppercase block">
            % DE CAPÍTULOS PREENCHIDOS
          </span>
          <span className="font-display text-4xl text-[#111111]">48.3%</span>
        </div>
      </div>

      {/* GREDO DE 3 CARTÕES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CARTÃO 1: TEÓRICAS */}
        <div className="border border-[#D8D5CC] p-6 bg-[#F6F3EC] flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <span className="font-mono text-[9px] tracking-[0.12em] text-[#767571] uppercase block border-b border-[#D8D5CC] pb-2">
              VOL. 01 · TEÓRICAS
            </span>
            <div className="font-mono text-[11px] text-[#111111] font-bold">
              6 CAPÍTULOS // EDITADO HÁ 2 DIAS
            </div>
            {/* Barra de progresso fina */}
            <div className="w-full bg-[#E5E2DB] h-1.5 overflow-hidden">
              <div className="bg-[#111111] h-full w-[60%]" />
            </div>
          </div>
          <button className="w-full bg-[#111111] text-[#FCF9F2] hover:bg-[#31312c] font-mono text-[10px] tracking-[0.1em] font-bold uppercase py-3 transition-colors">
            ABRIR TEÓRICAS &rarr;
          </button>
        </div>

        {/* CARTÃO 2: PRÁTICAS */}
        <div className="border-2 border-[#111111] p-6 bg-[#FCF9F2] flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-[#111111] pb-2">
              <span className="font-mono text-[9px] tracking-[0.12em] text-[#111111] font-bold uppercase">
                VOL. 02 · PRÁTICAS
              </span>
              <span className="bg-[#111111] text-[#FCF9F2] font-mono text-[8px] px-1.5 py-0.5 uppercase">
                LAB
              </span>
            </div>
            <div className="font-mono text-[11px] text-[#111111] font-bold">
              4 CAPÍTULOS // EDITADO HOJE
            </div>
            <div className="w-full bg-[#E5E2DB] h-1.5 overflow-hidden">
              <div className="bg-[#111111] h-full w-[40%]" />
            </div>
          </div>
          <button className="w-full border border-[#111111] hover:bg-[#111111] hover:text-[#FCF9F2] text-[#111111] font-mono text-[10px] tracking-[0.1em] font-bold uppercase py-3 transition-colors">
            ABRIR PRÁTICAS &rarr;
          </button>
        </div>

        {/* CARTÃO 3: TESTES */}
        <div className="border border-[#D8D5CC] p-6 bg-[#F6F3EC] flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <span className="font-mono text-[9px] tracking-[0.12em] text-[#767571] uppercase block border-b border-[#D8D5CC] pb-2">
              VOL. 03 · TESTES
            </span>
            <div className="font-mono text-[11px] text-[#111111] font-bold">
              12 TESTES ANTERIORES
            </div>
            <p className="font-sans text-[12px] text-[#767571]">
              Exames resolvidos e enunciados arquivados.
            </p>
          </div>
          <button className="w-full border border-[#111111] hover:bg-[#111111] hover:text-[#FCF9F2] text-[#111111] font-mono text-[10px] tracking-[0.1em] font-bold uppercase py-3 transition-colors">
            ABRIR TESTES &rarr;
          </button>
        </div>
      </div>
    </section>
  );
}