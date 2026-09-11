'use client';

import { AssessmentItem } from './types';
import { formatDateStr } from './utils';
import { AssessmentFileUploader } from './AssessmentFileUploader';

interface AssessmentItemRowProps {
  item: AssessmentItem;
  indexStr: string;
  isEditing: boolean;
  uploading: boolean;
  onEditToggle: (id: string | null) => void;
  onUpdateItem: (id: string, updatedFields: Partial<AssessmentItem>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onGradeChange: (id: string, value: string, field?: 'grade' | 'defense_grade') => Promise<void>;
  onToggleDefense: (id: string, currentHasDefense: boolean) => Promise<void>;
  onFileUpload: (
  e: React.ChangeEvent<HTMLInputElement>,
  itemId: string
) => Promise<any>;
  onDeleteFile: (itemId: string) => Promise<void>;
}

export function AssessmentItemRow({
  item,
  indexStr,
  isEditing,
  uploading,
  onEditToggle,
  onUpdateItem,
  onDeleteItem,
  onGradeChange,
  onToggleDefense,
  onFileUpload,
  onDeleteFile,
}: AssessmentItemRowProps) {
  return (
    <div className="py-3 border-b border-[#D8D5CC] space-y-2">
      {isEditing ? (
        <div className="bg-[#111111] text-[#FCF9F2] p-3.5 border border-[#31312C] font-mono text-[10px] space-y-3 uppercase">
          <div className="flex justify-between items-center border-b border-[#31312C] pb-2">
            <span className="font-bold tracking-[0.08em] text-[#FCF9F2]">
              EDITAR {item.category === 'TEORICA' ? 'TESTE' : 'TRABALHO'} #{indexStr} — {item.title}
            </span>
            <button
              type="button"
              onClick={() => onEditToggle(null)}
              className="text-[9px] text-[#A1A09A] hover:text-[#FCF9F2] cursor-pointer"
            >
              [ CONCLUIR / FECHAR ]
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <div className="space-y-1">
              <label className="block text-[8.5px] font-bold text-[#A1A09A] tracking-wider">
                1. TÍTULO
              </label>
              <input
                type="text"
                value={item.title}
                onChange={(e) =>
                  onUpdateItem(item.id, { title: e.target.value.toUpperCase() })
                }
                className="w-full bg-[#1B1B18] border border-[#31312C] p-1.5 font-bold text-[#FCF9F2] focus:outline-none text-[10px]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[8.5px] font-bold text-[#A1A09A] tracking-wider">
                2. PESO NO RAMO (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={item.weight_percent}
                onChange={(e) =>
                  onUpdateItem(item.id, {
                    weight_percent: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full bg-[#1B1B18] border border-[#31312C] p-1.5 font-bold text-[#FCF9F2] focus:outline-none text-[10px]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[8.5px] font-bold text-[#A1A09A] tracking-wider">
                3. DATA DE REALIZAÇÃO / ENTREGA
              </label>
              <input
                type="date"
                value={item.due_date ? item.due_date.split('T')[0] : ''}
                onChange={(e) =>
                  onUpdateItem(item.id, {
                    due_date: e.target.value ? e.target.value : null,
                  })
                }
                className="w-full bg-[#1B1B18] border border-[#31312C] p-1.5 font-bold text-[#FCF9F2] focus:outline-none text-[10px] [color-scheme:dark]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[8.5px] font-bold text-[#A1A09A] tracking-wider">
                4. MATÉRIA / REQUISITOS
              </label>
              <input
                type="text"
                value={item.volume_ref || ''}
                onChange={(e) =>
                  onUpdateItem(item.id, {
                    volume_ref: e.target.value.toUpperCase(),
                  })
                }
                className="w-full bg-[#1B1B18] border border-[#31312C] p-1.5 font-bold text-[#FCF9F2] focus:outline-none text-[10px]"
              />
            </div>

            {item.category === 'PRATICA' && item.has_defense && (
              <div className="col-span-1 sm:col-span-2 space-y-1 bg-[#1B1B18] p-2 border border-[#31312C]">
                <label className="block text-[8.5px] font-bold text-indigo-400 tracking-wider">
                  DATA DA DEFESA DO TRABALHO
                </label>
                <input
                  type="date"
                  value={item.defense_date ? item.defense_date.split('T')[0] : ''}
                  onChange={(e) =>
                    onUpdateItem(item.id, {
                      defense_date: e.target.value ? e.target.value : null,
                    })
                  }
                  className="w-full bg-[#111111] border border-[#31312C] p-1.5 font-bold text-[#FCF9F2] focus:outline-none text-[10px] [color-scheme:dark]"
                />
              </div>
            )}

            <div className="col-span-1 sm:col-span-2 lg:col-span-4">
              <AssessmentFileUploader
                fileName={item.file_name}
                uploading={uploading}
                onUpload={(e) => onFileUpload(e, item.id)}
                onDelete={item.file_name ? () => onDeleteFile(item.id) : undefined}
                label="5. FICHEIRO ARQUIVADO / ENUNCIADO"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-[11px] tracking-[0.05em]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-5 h-5 flex items-center justify-center border border-[#D8D5CC] font-bold text-[#767571] bg-[#FCF9F2] shrink-0 text-[9px]">
              {indexStr}
            </span>
            <span className="font-bold text-[#111111] uppercase truncate">
              {item.title}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 text-[#767571] uppercase shrink-0 text-[10px]">
            <span>PESO {item.weight_percent}%</span>

            <div className="flex items-center gap-1">
              {item.category === 'PRATICA' && <span className="text-[9px]">ENTREGA:</span>}
              <span className="font-bold text-[#111111]">{formatDateStr(item.due_date)}</span>
            </div>

            {item.category === 'PRATICA' && (
              <div className="flex items-center gap-1.5 border border-[#D8D5CC] px-2 py-0.5 bg-[#F6F3EC]">
                <button
                  type="button"
                  onClick={() => onToggleDefense(item.id, item.has_defense)}
                  className={`text-[9px] font-bold cursor-pointer ${
                    item.has_defense ? 'text-indigo-600' : 'text-[#767571]'
                  }`}
                >
                  {item.has_defense ? '[ DEFESA ATIVA ]' : '+ DEFESA'}
                </button>

                {item.has_defense && (
                  <div className="flex flex-wrap items-center gap-2 border-l border-[#D8D5CC] pl-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] text-[#767571]">DATA:</span>
                      <input
                        type="date"
                        value={item.defense_date ? item.defense_date.split('T')[0] : ''}
                        onChange={(e) =>
                          onUpdateItem(item.id, {
                            defense_date: e.target.value ? e.target.value : null,
                          })
                        }
                        className="bg-[#FCF9F2] border border-[#111111] text-center font-bold text-[9px] text-[#111111] focus:bg-[#111111] focus:text-[#FCF9F2] focus:outline-none px-1 h-6 [color-scheme:light]"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[8px] text-[#767571]">NOTA:</span>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        step="0.1"
                        placeholder="—"
                        value={item.defense_grade !== null ? item.defense_grade : ''}
                        onChange={(e) =>
                          onGradeChange(item.id, e.target.value, 'defense_grade')
                        }
                        className="w-10 h-6 bg-[#FCF9F2] border border-[#111111] text-center font-bold text-[10px] text-[#111111] focus:bg-[#111111] focus:text-[#FCF9F2] focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-1">
              {item.category === 'PRATICA' && <span className="text-[9px]">TRABALHO:</span>}
              <input
                type="number"
                min="0"
                max="20"
                step="0.1"
                placeholder="—"
                value={item.grade !== null ? item.grade : ''}
                onChange={(e) => onGradeChange(item.id, e.target.value, 'grade')}
                className="w-14 h-7 bg-[#FCF9F2] border border-[#111111] text-center font-bold text-[11px] text-[#111111] focus:bg-[#111111] focus:text-[#FCF9F2] focus:outline-none transition-colors"
              />
              <span className="font-bold text-[#111111]">/ 20</span>
            </div>

            <div className="flex items-center gap-1 text-[9px]">
              <button
                type="button"
                onClick={() => onEditToggle(item.id)}
                className="hover:text-[#111111] underline cursor-pointer font-bold"
              >
                EDITAR
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => onDeleteItem(item.id)}
                className="hover:text-red-600 underline cursor-pointer font-bold"
              >
                APAGAR
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] tracking-[0.05em] text-[#767571] uppercase pt-0.5">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#111111]">
            {item.category === 'TEORICA' ? 'CAPÍTULOS:' : 'REQUISITOS / NOTAS:'}
          </span>
          <span className={item.volume_ref && item.volume_ref.trim() !== '' ? 'text-[#111111]' : 'text-[#767571]'}>
            {item.volume_ref && item.volume_ref.trim() !== ''
              ? item.volume_ref
              : 'SEM NOTAS REGISTADAS'}
          </span>
        </div>

        {item.file_url ? (
          <a
            href={item.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#111111] text-[#FCF9F2] px-2 py-0.5 hover:bg-[#31312c] transition-colors font-bold inline-flex items-center gap-1"
          >
            <span>🗏 {item.file_name || 'DOCUMENTO ARQUIVADO'}</span>
            <span>&rarr;</span>
          </a>
        ) : (
          <span className="border border-dashed border-[#D8D5CC] px-1.5 py-0.5 text-[#A1A09A]">
            SEM DOCUMENTO ARQUIVADO
          </span>
        )}
      </div>
    </div>
  );
}