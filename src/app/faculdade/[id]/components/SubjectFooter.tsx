'use client';

interface SubjectFooterProps {
  subjectName?: string;
}

export function SubjectFooter({ subjectName = 'SEGURANÇA DE SISTEMAS & COMPUTADORES' }: SubjectFooterProps) {
  return (
    <footer className="mt-20 border-t border-[#111111] pt-6 pb-12 flex flex-col md:flex-row justify-between items-start md:items-center font-mono text-[10px] tracking-[0.1em] text-[#767571] uppercase gap-4">
      <div>
        <strong className="text-[#111111]">{subjectName}</strong>
      </div>
      <div>
        © APP PESSOAL · TODOS OS DIREITOS RESERVADOS
      </div>
    </footer>
  );
}