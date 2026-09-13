'use client';

const TEXT_COLORS = [
  { name: 'Preto', hex: '#111111' },
  { name: 'Azul Escuro', hex: '#1E3A8A' },
  { name: 'Vermelho', hex: '#B91C1C' },
  { name: 'Verde', hex: '#047857' },
];

export function EditorToolbar({ ...props }: any) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-3 px-4 mb-6 border-b border-[#D8D5CC] bg-[#F6F4EE] font-mono text-xs select-none">
      {/* GRUPO DE FERRAMENTAS */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => props.setActiveTool('TEXT')}
          className={`px-3 py-1 font-bold uppercase transition-all rounded-none border ${
            props.activeTool === 'TEXT'
              ? 'bg-[#111111] text-[#FCF9F2] border-[#111111]'
              : 'bg-[#EBE8DF] text-[#111111] border-[#D8D5CC] hover:bg-[#D8D5CC]'
          }`}
        >
          TEXTO
        </button>
        <button
          onClick={() => props.setActiveTool('PEN')}
          className={`px-3 py-1 font-bold uppercase transition-all rounded-none border ${
            props.activeTool === 'PEN'
              ? 'bg-[#111111] text-[#FCF9F2] border-[#111111]'
              : 'bg-[#EBE8DF] text-[#111111] border-[#D8D5CC] hover:bg-[#D8D5CC]'
          }`}
        >
          CANETA
        </button>
        <button
          onClick={() => props.setActiveTool('HIGHLIGHTER')}
          className={`px-3 py-1 font-bold uppercase transition-all rounded-none border ${
            props.activeTool === 'HIGHLIGHTER'
              ? 'bg-[#111111] text-[#FCF9F2] border-[#111111]'
              : 'bg-[#EBE8DF] text-[#111111] border-[#D8D5CC] hover:bg-[#D8D5CC]'
          }`}
        >
          MARCADOR
        </button>
        <button
          onClick={() => props.setActiveTool('ERASER')}
          className={`px-3 py-1 font-bold uppercase transition-all rounded-none border ${
            props.activeTool === 'ERASER'
              ? 'bg-[#111111] text-[#FCF9F2] border-[#111111]'
              : 'bg-[#EBE8DF] text-[#111111] border-[#D8D5CC] hover:bg-[#D8D5CC]'
          }`}
        >
          BORRACHA
        </button>
      </div>

      <div className="h-4 w-[1px] bg-[#D8D5CC] mx-1" />

      {/* ESTILOS DE FORMATO */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => props.executeCommand('formatBlock', '<h1>')}
          className="px-2 py-1 font-bold uppercase bg-[#EBE8DF] border border-[#D8D5CC] hover:bg-[#111111] hover:text-[#FCF9F2] rounded-none"
        >
          TÍTULO
        </button>
        <button
          onClick={() => props.executeCommand('formatBlock', '<h2>')}
          className="px-2 py-1 font-bold uppercase bg-[#EBE8DF] border border-[#D8D5CC] hover:bg-[#111111] hover:text-[#FCF9F2] rounded-none"
        >
          SUBTÍTULO
        </button>
        <button
          onClick={() => props.executeCommand('formatBlock', '<p>')}
          className="px-2 py-1 font-bold uppercase bg-[#EBE8DF] border border-[#D8D5CC] hover:bg-[#111111] hover:text-[#FCF9F2] rounded-none"
        >
          NORMAL
        </button>
      </div>

      <div className="h-4 w-[1px] bg-[#D8D5CC] mx-1" />

      {/* PALETA DE CORES */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[#767571] font-bold uppercase">COR:</span>
        <div className="flex gap-1">
          {TEXT_COLORS.map((c) => (
            <button
              key={c.hex}
              onClick={() => props.executeCommand('foreColor', c.hex)}
              style={{ backgroundColor: c.hex }}
              className="w-4 h-4 rounded-none border border-[#111111] hover:scale-110 transition-transform"
              title={c.name}
            />
          ))}
        </div>
      </div>
    </div>
  );
}