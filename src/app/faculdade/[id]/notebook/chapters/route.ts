import { NextResponse } from 'next/server';

// Substitui esta função com a tua chamada real de BD (ex: Supabase, Prisma, Drizzle, etc.)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subjectId, number, title, category, content } = body;

    const newChapter = {
      id: crypto.randomUUID(),
      subjectId,
      number,
      title,
      category,
      content: content || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
    };

    // AQUI: Inserir na tua BD (ex: await db.chapter.create({ data: newChapter }))

    return NextResponse.json(newChapter, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar capítulo' }, { status: 500 });
  }
}