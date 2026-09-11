'use client';

interface AssessmentFileUploaderProps {
  fileName: string | null;
  uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete?: () => void;
  label?: string;
}

export function AssessmentFileUploader({
  fileName,
  uploading,
  onUpload,
  onDelete,
  label = 'ANEXO / FICHEIRO DA AVALIAÇÃO',
}: AssessmentFileUploaderProps) {
  return (
    <div className="bg-[#1B1B18] p-2.5 border border-[#31312C] space-y-2">
      <label className="block text-[8.5px] font-bold text-[#FCF9F2] tracking-wider uppercase">
        {label}
      </label>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono">
        <input
          type="file"
          onChange={onUpload}
          disabled={uploading}
          className="block w-full text-[9px] text-[#A1A09A] file:mr-2 file:py-1 file:px-2 file:border-0 file:text-[9px] file:font-mono file:font-bold file:bg-[#FCF9F2] file:text-[#111111] hover:file:bg-[#E5E2D9] cursor-pointer"
        />

        {fileName && (
          <div className="flex items-center gap-2 shrink-0 bg-[#252520] px-2 py-1 border border-[#31312C]">
            <span className="text-[9px] text-green-400 font-bold uppercase">
              ✓ {fileName}
            </span>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="text-[9px] bg-red-900/40 text-red-400 hover:bg-red-900/80 border border-red-500/30 px-1.5 py-0.5 font-bold cursor-pointer transition-colors"
              >
                [ APAGAR FICHEIRO ]
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}