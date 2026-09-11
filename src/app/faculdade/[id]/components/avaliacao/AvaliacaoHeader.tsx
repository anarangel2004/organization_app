'use client';

interface AvaliacaoHeaderProps {
  theoryWeight: number;
  setTheoryWeight: (val: number) => void;
  practiceWeight: number;
  setPracticeWeight: (val: number) => void;
  isEditingWeights: boolean;
  setIsEditingWeights: (val: boolean) => void;
  savingWeights: boolean;
  onSaveWeights: () => void;
  mediaAtual: string;
}

export function AvaliacaoHeader({
  theoryWeight,
  setTheoryWeight,
  practiceWeight,
  setPracticeWeight,
  isEditingWeights,
  setIsEditingWeights,
  savingWeights,
  onSaveWeights,
  mediaAtual,
}: AvaliacaoHeaderProps) {
  return (
    <div className="border-b border-[#D8D5CC] pb-6 space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2 font-mono text-[10px] tracking-[0.12em] text-[#767571] uppercase">
        <span>SECÇÃO 05 // CRITÉRIOS & ÍNDICE DE CLASSIFICAÇÃO</span>

        <div className="flex items-center gap-2">
          {isEditingWeights ? (
            <div className="flex items-center gap-2 bg-[#111111] text-[#FCF9F2] px-2 py-1 border border-[#111111]">
              <span>TEÓRICO:</span>
              <input
                type="number"
                min="0"
                max="100"
                value={theoryWeight}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setTheoryWeight(val);
                  setPracticeWeight(Math.max(0, 100 - val));
                }}
                className="w-10 bg-[#1B1B18] text-center font-bold text-[#FCF9F2] focus:outline-none"
              />
              <span>% · PRÁTICO:</span>
              <input
                type="number"
                min="0"
                max="100"
                value={practiceWeight}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setPracticeWeight(val);
                  setTheoryWeight(Math.max(0, 100 - val));
                }}
                className="w-10 bg-[#1B1B18] text-center font-bold text-[#FCF9F2] focus:outline-none"
              />
              <span>%</span>
              <button
                type="button"
                onClick={onSaveWeights}
                disabled={savingWeights}
                className="bg-[#FCF9F2] text-[#111111] px-1.5 py-0.5 font-bold hover:bg-[#E5E2D9] ml-1 cursor-pointer"
              >
                OK
              </button>
              <button
                type="button"
                onClick={() => setIsEditingWeights(false)}
                className="text-[#A1A09A] hover:text-[#FCF9F2] ml-1 cursor-pointer"
              >
                X
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span>
                PESO TEÓRICO: <strong className="text-[#111111]">{theoryWeight}%</strong>
              </span>
              <span>·</span>
              <span>
                PESO PRÁTICO: <strong className="text-[#111111]">{practiceWeight}%</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsEditingWeights(true)}
                className="hover:text-[#111111] underline cursor-pointer font-bold ml-1"
              >
                [EDITAR PESOS]
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-1">
        <h2 className="font-display text-6xl sm:text-7xl md:text-8xl leading-[0.9] text-[#111111] uppercase tracking-[-0.01em]">
          AVALIAÇÃO.
        </h2>

        <div className="flex flex-col items-start md:items-end shrink-0">
          <span className="font-mono text-[9px] tracking-[0.12em] text-[#767571] uppercase block">
            MÉDIA ATUAL DA DISCIPLINA
          </span>
          <div className="font-display text-4xl text-[#111111]">{mediaAtual}</div>
        </div>
      </div>
    </div>
  );
}