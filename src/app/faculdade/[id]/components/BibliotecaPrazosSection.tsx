'use client';

export function BibliotecaPrazosSection() {
  const docs = [
    { id: '1', name: 'Guião de Laboratório 01 — Buffer Overflows.pdf', chapter: 'VOL. 02 · PRÁTICAS' },
    { id: '2', name: 'Criptografia Assimétrica e Assinaturas Digitais.pdf', chapter: 'VOL. 01 · TEÓRICAS' },
    { id: '3', name: 'Regulamento de Avaliação e Prazos 2024.pdf', chapter: 'SEM CAPÍTULO' },
  ];

  return (
    <section id="biblioteca" className="space-y-6 pt-12">
      <div className="border-b border-[#D8D5CC] pb-4 space-y-2">
        <span className="font-mono text-[10px] tracking-[0.12em] text-[#767571] uppercase block">
          SECÇÃO 04 // RECURSOS & PRAZOS CRÍTICOS
        </span>
        <h2 className="font-display text-6xl sm:text-7xl md:text-8xl leading-[0.9] text-[#111111] uppercase tracking-[-0.01em]">
          BIBLIOTECA & PRAZOS.
        </h2>
      </div>

      {/* BANNER DE PRAZO CRÍTICO */}
      <div className="bg-[#111111] text-[#FCF9F2] p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="font-mono text-[9px] tracking-[0.12em] text-[#D8D5CC] uppercase block mb-1">
            PRAZO CRÍTICO
          </span>
          <h3 className="font-display text-3xl sm:text-4xl uppercase">
            ENTREGA DO PROJETO PRÁTICO N1
          </h3>
        </div>
        <div className="text-left md:text-right font-mono">
          <span className="text-3xl font-bold block">12 DIAS RESTANTES</span>
          <span className="text-[10px] text-[#D8D5CC] uppercase">SUBMISSÃO VIA PORTAL ACADÉMICO</span>
        </div>
      </div>

      {/* LISTA DE DOCUMENTOS */}
      <div className="border-t border-[#111111]">
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 border-b border-[#D8D5CC] gap-2"
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] bg-[#EBE8E1] border border-[#D8D5CC] px-1.5 py-0.5 font-bold">
                PDF
              </span>
              <span className="font-sans text-[13px] font-bold text-[#111111]">
                {doc.name}
              </span>
            </div>

            <div className="flex items-center gap-4 font-mono text-[10px]">
              <span className="text-[#767571] uppercase">{doc.chapter}</span>
              <button className="border border-[#111111] hover:bg-[#111111] hover:text-[#FCF9F2] px-3 py-1 font-bold uppercase transition-colors">
                ABRIR
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* FAIXA INFERIOR COM DEMAIS PRAZOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
        <div className="border border-[#D8D5CC] p-4 bg-[#F6F3EC] flex justify-between items-center font-mono">
          <div>
            <span className="text-[9px] text-[#767571] uppercase block">PRAZO FUTURO</span>
            <span className="text-[12px] font-bold text-[#111111] uppercase">TESTE TEÓRICO INTERMÉDIO</span>
          </div>
          <span className="bg-[#EBE8E1] px-2 py-1 text-[10px] font-bold">FALTAM 28 DIAS</span>
        </div>

        <div className="border border-[#D8D5CC] p-4 bg-[#F6F3EC] flex justify-between items-center font-mono">
          <div>
            <span className="text-[9px] text-[#767571] uppercase block">PRAZO FUTURO</span>
            <span className="text-[12px] font-bold text-[#111111] uppercase">DEFESA ORAL DO LABORATÓRIO</span>
          </div>
          <span className="bg-[#EBE8E1] px-2 py-1 text-[10px] font-bold">FALTAM 45 DIAS</span>
        </div>
      </div>
    </section>
  );
}