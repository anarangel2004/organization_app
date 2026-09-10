'use client';

interface HeaderSectionProps {
  totalSubjects: number;
}

export function HeaderSection({ totalSubjects }: HeaderSectionProps) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* TÍTULO */}
      <div className="lg:col-span-7 space-y-4">
        <span className="font-mono text-[10px] tracking-[0.12em] text-[#767571] uppercase flex items-center gap-2">
          <span className="w-2 h-2 bg-[#111111] inline-block"></span>
          SECÇÃO 00 // ARQUIVO ACADÉMICO
        </span>
        <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-[0.95] text-[#111111] uppercase tracking-normal">
          FACULDADE &<br />NOTEBOOKS.
        </h1>
        <p className="font-sans text-[13px] text-[#767571] max-w-xl leading-relaxed pt-2">
          Catálogo curricular central, assiduidade, parâmetros monográficos e repositório de anotações técnicas para o ano letivo em curso.
        </p>
      </div>

      {/* CAIXA DE REGISTO */}
      <div className="lg:col-span-5 bg-[#F5F1E8]/50 border border-[#D8D5CC] p-6 space-y-4 font-mono text-[10px] tracking-wider uppercase">
        <div className="flex items-center justify-between border-b border-[#D8D5CC] pb-3 font-bold">
          <span>FOLHA DE REGISTO CURRICULAR</span>
          <span className="text-[#767571]">SISTEMA V.04</span>
        </div>
        <div className="space-y-3 text-[#767571]">
          <div className="flex items-center justify-between">
            <span>DISCIPLINAS ATIVAS</span>
            <span className="flex-1 mx-3 border-b border-dotted border-[#D8D5CC]"></span>
            <span className="text-[#111111] font-bold">
              {String(totalSubjects).padStart(2, '0')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>CADERNOS ATIVOS</span>
            <span className="flex-1 mx-3 border-b border-dotted border-[#D8D5CC]"></span>
            <span className="text-[#111111] font-bold">06</span>
          </div>
          <div className="flex items-center justify-between">
            <span>TRIMESTRE ATUAL</span>
            <span className="flex-1 mx-3 border-b border-dotted border-[#D8D5CC]"></span>
            <span className="text-[#111111] font-bold">OUTONO 2026</span>
          </div>
          <div className="flex items-center justify-between">
            <span>ÚLTIMA ENTRADA</span>
            <span className="flex-1 mx-3 border-b border-dotted border-[#D8D5CC]"></span>
            <span className="text-[#111111] font-bold">HÁ 2 DIAS</span>
          </div>
        </div>
        <div className="flex justify-between text-[9px] pt-3 border-t border-[#D8D5CC] text-[#767571]">
          <span>COORDENAÇÃO PEDAGÓGICA</span>
          <span>DEPT. CIÊNCIAS & HUMANIDADES</span>
        </div>
      </div>
    </section>
  );
}