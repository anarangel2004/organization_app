'use client';

type ActiveTool = 'TEXT' | 'PEN' | 'HIGHLIGHTER' | 'ERASER';
type EraserType = 'SMALL' | 'LARGE' | 'OBJECT';

const TEXT_COLORS = [
  { name: 'Preto', hex: '#111111' },
  { name: 'Azul', hex: '#0055FF' },
  { name: 'Vermelho', hex: '#D9381E' },
  { name: 'Verde', hex: '#059669' },
  { name: 'Laranja', hex: '#D97706' },
  { name: 'Roxo', hex: '#7C3AED' },
];

interface EditorToolbarProps {
  chapterIndexStr: string;
  category?: string;
  viewMode: 'EDIT' | 'PREVIEW';
  setViewMode: (mode: 'EDIT' | 'PREVIEW') => void;
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  penColor: string;
  setPenColor: (color: string) => void;
  penSize: number;
  setPenSize: (size: number) => void;
  eraserType: EraserType;
  setEraserType: (type: EraserType) => void;
  execFormat: (command: string, value?: string) => void;
  applyHeading: (tag: string) => void;
  applyFontSize: (sizePx: string) => void;
}

export function EditorToolbar({
  chapterIndexStr,
  category,
  viewMode,
  setViewMode,
  activeTool,
  setActiveTool,
  penColor,
  setPenColor,
  penSize,
  setPenSize,
  eraserType,
  setEraserType,
  execFormat,
  applyHeading,
  applyFontSize,
}: EditorToolbarProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#FAF8F3]/95 backdrop-blur-sm border-b border-[#D8D5CC] px-6 py-2 flex flex-col space-y-2 shadow-xs">
      {/* LINHA SUPERIOR */}
      <div className="flex items-center justify-between gap-4">
        <div className="font-mono text-[9px] font-bold text-[#767571] tracking-wider uppercase">
          CAPÍTULO {chapterIndexStr} // {category || 'GERAL'}
        </div>

        {/* BOTÕES EDITAR / PREVIEW */}
        <div className="flex border border-[#111111] text-[9px] font-mono font-bold uppercase bg-[#EBE8DF]">
          <button
            onClick={() => setViewMode('EDIT')}
            className={`px-2.5 py-1 transition-colors ${
              viewMode === 'EDIT' ? 'bg-[#111111] text-[#FCF9F2]' : 'hover:bg-[#D8D5CC]'
            }`}
          >
            EDITAR
          </button>
          <button
            onClick={() => setViewMode('PREVIEW')}
            className={`px-2.5 py-1 border-l border-[#111111] transition-colors ${
              viewMode === 'PREVIEW' ? 'bg-[#111111] text-[#FCF9F2]' : 'hover:bg-[#D8D5CC]'
            }`}
          >
            PREVIEW
          </button>
        </div>
      </div>

      {/* FERRAMENTAS DE EDIÇÃO (APENAS EM MODO EDITAR) */}
      {viewMode === 'EDIT' && (
        <>
          <div className="flex items-center space-x-1.5 font-mono text-[9px] pt-1 border-t border-[#D8D5CC]">
            <button
              onClick={() => setActiveTool('TEXT')}
              className={`px-2.5 py-1 border font-bold transition-all ${
                activeTool === 'TEXT'
                  ? 'bg-[#111111] text-[#FCF9F2] border-[#111111]'
                  : 'bg-[#EBE8DF] border-[#D8D5CC] hover:bg-[#D8D5CC]'
              }`}
            >
              TEXTO
            </button>
            <button
              onClick={() => {
                setActiveTool('PEN');
                if (penSize > 10) setPenSize(3);
              }}
              className={`px-2.5 py-1 border font-bold transition-all ${
                activeTool === 'PEN'
                  ? 'bg-[#111111] text-[#FCF9F2] border-[#111111]'
                  : 'bg-[#EBE8DF] border-[#D8D5CC] hover:bg-[#D8D5CC]'
              }`}
            >
              CANETA
            </button>
            <button
  onClick={() => {
    setActiveTool('HIGHLIGHTER');
    setPenSize(10);
  }}
  className={`px-2.5 py-1 border font-bold transition-all ${
    activeTool === 'HIGHLIGHTER'
      ? 'bg-[#111111] text-[#FCF9F2] border-[#111111]'
      : 'bg-[#EBE8DF] border-[#D8D5CC] hover:bg-[#D8D5CC]'
  }`}
>
  MARCADOR
</button>
            <button
              onClick={() => setActiveTool('ERASER')}
              className={`px-2.5 py-1 border font-bold transition-all ${
                activeTool === 'ERASER'
                  ? 'bg-[#111111] text-[#FCF9F2] border-[#111111]'
                  : 'bg-[#EBE8DF] border-[#D8D5CC] hover:bg-[#D8D5CC]'
              }`}
            >
              BORRACHA
            </button>
          </div>

          {/* SUB-OPÇÕES */}
          <div className="pt-1.5 border-t border-[#D8D5CC] flex flex-wrap items-center justify-between text-[9px] font-mono">
            {activeTool === 'TEXT' && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center space-x-1">
                  <button onClick={() => applyHeading('h1')} className="px-2 py-0.5 border border-[#111111] bg-[#111111] text-white font-extrabold">TÍTULO</button>
                  <button onClick={() => applyHeading('h2')} className="px-2 py-0.5 border border-[#D8D5CC] bg-[#EBE8DF] font-semibold text-[#555450] hover:bg-[#111111] hover:text-white">SUBTÍTULO</button>
                  <button onClick={() => applyHeading('p')} className="px-2 py-0.5 border border-[#D8D5CC] bg-[#EBE8DF] hover:bg-[#111111] hover:text-white">NORMAL</button>
                  <button onClick={() => applyFontSize('12px')} className="px-2 py-0.5 border border-[#D8D5CC] bg-[#EBE8DF] text-[8px] hover:bg-[#111111] hover:text-white">PEQUENO</button>
                  <button onClick={() => execFormat('bold')} className="px-2 py-0.5 border border-[#D8D5CC] bg-[#EBE8DF] font-bold hover:bg-[#111111] hover:text-white">B</button>
                  <button onClick={() => execFormat('italic')} className="px-2 py-0.5 border border-[#D8D5CC] bg-[#EBE8DF] italic hover:bg-[#111111] hover:text-white">I</button>
                  <button onClick={() => execFormat('insertUnorderedList')} className="px-2 py-0.5 border border-[#D8D5CC] bg-[#EBE8DF] hover:bg-[#111111] hover:text-white">LISTA</button>
                </div>

                <div className="flex items-center space-x-1 pl-2 border-l border-[#D8D5CC]">
                  <span className="text-[8px] text-[#767571] font-bold mr-1">COR:</span>
                  {TEXT_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => execFormat('foreColor', c.hex)}
                      style={{ backgroundColor: c.hex }}
                      className="w-3.5 h-3.5 rounded-full border border-black/20 hover:scale-125 transition-transform"
                    />
                  ))}
                </div>
              </div>
            )}

            {(activeTool === 'PEN' || activeTool === 'HIGHLIGHTER') && (
              <div className="flex items-center space-x-4 w-full justify-between">
                {activeTool === 'PEN' && (
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[8px] text-[#767571] font-bold mr-1">COR:</span>
                    {TEXT_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        onClick={() => setPenColor(c.hex)}
                        style={{ backgroundColor: c.hex }}
                        className={`w-3.5 h-3.5 rounded-full border ${
                          penColor === c.hex ? 'ring-2 ring-[#111111] scale-110' : ''
                        }`}
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <span className="text-[8px] text-[#767571] font-bold">DIMENSÃO: {penSize}PX</span>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={penSize}
                    onChange={(e) => setPenSize(Number(e.target.value))}
                    className="w-24 accent-[#111111] cursor-pointer"
                  />
                  <div className="flex space-x-1">
                    {[1, 2, 4, 6, 8, 10].map((size) => (
                      <button
                        key={size}
                        onClick={() => setPenSize(size)}
                        className={`px-1.5 py-0.5 border text-[8px] ${
                          penSize === size ? 'bg-[#111111] text-white' : 'bg-[#EBE8DF] border-[#D8D5CC]'
                        }`}
                      >
                        {size}px
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTool === 'ERASER' && (
              <div className="flex items-center space-x-2">
                <span className="text-[8px] text-[#767571] font-bold uppercase mr-1">TIPO DE BORRACHA:</span>
                <button
                  onClick={() => setEraserType('SMALL')}
                  className={`px-2.5 py-0.5 border text-[9px] font-bold transition-all ${
                    eraserType === 'SMALL' ? 'bg-[#111111] text-white border-[#111111]' : 'bg-[#EBE8DF] border-[#D8D5CC]'
                  }`}
                >
                  PEQUENA (8px)
                </button>
                <button
                  onClick={() => setEraserType('LARGE')}
                  className={`px-2.5 py-0.5 border text-[9px] font-bold transition-all ${
                    eraserType === 'LARGE' ? 'bg-[#111111] text-white border-[#111111]' : 'bg-[#EBE8DF] border-[#D8D5CC]'
                  }`}
                >
                  GRANDE (24px)
                </button>
                <button
                  onClick={() => setEraserType('OBJECT')}
                  className={`px-2.5 py-0.5 border text-[9px] font-bold transition-all ${
                    eraserType === 'OBJECT' ? 'bg-[#111111] text-white border-[#111111]' : 'bg-[#EBE8DF] border-[#D8D5CC]'
                  }`}
                >
                  OBJETOS (APAGA TRAÇO COMPLETO)
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </header>
  );
}