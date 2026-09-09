'use client';

import Link from 'next/link';
import {
  BookOpen,
  FileText,
  FolderOpen,
  Clock,
  ChevronRight,
  Calendar,
  FileCheck,
  Mail,
  Percent,
  CheckCircle2,
  XCircle,
  MapPin,
  User
} from 'lucide-react';
import { Subject } from '../types';

interface SubjectCardProps {
  subject: Subject;
}

export function SubjectCard({ subject }: SubjectCardProps) {
  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-5">
      <div className="space-y-3">
        {/* Header do Card */}
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${subject.color}`} />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
              {subject.code}
            </span>
          </div>
          {subject.nextEvaluation && (
            <span className="text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
              <Calendar className="w-3 h-3" />
              {subject.nextEvaluation.date}
            </span>
          )}
        </div>

        <div>
          <h3 className="text-sm font-serif font-bold text-slate-900 leading-tight">
            {subject.name}
          </h3>
        </div>

        {/* Lista de Horários */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 text-xs text-slate-700 space-y-2">
          {subject.schedules.map((sched, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between font-medium border-b border-slate-200/50 last:border-0 pb-1.5 last:pb-0 gap-2"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">
                  {sched.dayOfWeek} • {sched.startTime} às {sched.endTime}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-200/80 text-slate-700 border border-slate-300/60 px-1.5 py-0.5 rounded-md">
                  {sched.type}
                </span>
                <div className="flex items-center gap-0.5 text-slate-500 text-[11px]">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>{sched.room || 'A definir'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Docentes */}
        <div className="space-y-1.5 pt-1 text-xs">
          {subject.teacherTeorica?.name && (
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-[11px] font-medium flex items-center gap-1 text-slate-500">
                <User className="w-3 h-3 text-slate-400" /> Teórica:
              </span>
              <div className="text-right">
                <span className="font-medium text-slate-800">{subject.teacherTeorica.name}</span>
                {subject.teacherTeorica.email && (
                  <a
                    href={`mailto:${subject.teacherTeorica.email}`}
                    className="block text-[10px] text-amber-700 hover:underline flex items-center gap-0.5 justify-end"
                  >
                    <Mail className="w-2.5 h-2.5" /> {subject.teacherTeorica.email}
                  </a>
                )}
              </div>
            </div>
          )}

          {subject.teacherPratica?.name && (
            <div className="flex items-center justify-between text-slate-600 pt-0.5">
              <span className="text-[11px] font-medium flex items-center gap-1 text-slate-500">
                <User className="w-3 h-3 text-slate-400" /> Prática:
              </span>
              <div className="text-right">
                <span className="font-medium text-slate-800">{subject.teacherPratica.name}</span>
                {subject.teacherPratica.email && (
                  <a
                    href={`mailto:${subject.teacherPratica.email}`}
                    className="block text-[10px] text-amber-700 hover:underline flex items-center gap-0.5 justify-end"
                  >
                    <Mail className="w-2.5 h-2.5" /> {subject.teacherPratica.email}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Resumo de Avaliação */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 font-mono font-medium text-slate-700">
            <Percent className="w-3 h-3 text-slate-400" />
            <span>T: {subject.evaluation.teoricaWeight}%</span>
            <span className="text-slate-300">•</span>
            <span>P: {subject.evaluation.praticaWeight}%</span>
          </div>

          <div>
            {subject.evaluation.requiresAttendance ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md">
                <CheckCircle2 className="w-3 h-3 text-amber-600" /> Frequência Obrigatória
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md">
                <XCircle className="w-3 h-3 text-emerald-600" /> Pode Faltar
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Os 3 Notebooks Fixos */}
      <div className="space-y-2 border-t border-b border-slate-100 py-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
          Notebooks Dedicados
        </span>

        <div className="grid grid-cols-3 gap-2">
          <Link
            href={`/faculdade/${subject.id}/notebook?type=teorica`}
            className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-900 hover:text-white hover:border-slate-900 group transition-all text-center"
          >
            <BookOpen className="w-3.5 h-3.5 text-slate-600 group-hover:text-white mb-1 transition-colors" />
            <span className="text-[10px] font-semibold text-slate-800 group-hover:text-white">
              Teóricas
            </span>
          </Link>

          <Link
            href={`/faculdade/${subject.id}/notebook?type=pratica`}
            className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-900 hover:text-white hover:border-slate-900 group transition-all text-center"
          >
            <FileText className="w-3.5 h-3.5 text-slate-600 group-hover:text-white mb-1 transition-colors" />
            <span className="text-[10px] font-semibold text-slate-800 group-hover:text-white">
              Práticas
            </span>
          </Link>

          <Link
            href={`/faculdade/${subject.id}/notebook?type=testes`}
            className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-900 hover:text-white hover:border-slate-900 group transition-all text-center"
          >
            <FileCheck className="w-3.5 h-3.5 text-slate-600 group-hover:text-white mb-1 transition-colors" />
            <span className="text-[10px] font-semibold text-slate-800 group-hover:text-white">
              Testes
            </span>
          </Link>
        </div>
      </div>

      {/* Rodapé: Biblioteca de Documentos */}
      <div className="flex items-center justify-between pt-1 text-xs">
        <Link
          href={`/faculdade/${subject.id}/materiais`}
          className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition-colors font-medium"
        >
          <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
          <span>Biblioteca ({subject.filesCount})</span>
        </Link>

        <Link
          href={`/faculdade/${subject.id}`}
          className="flex items-center gap-1 text-slate-900 font-semibold hover:translate-x-0.5 transition-transform"
        >
          Aceder <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}