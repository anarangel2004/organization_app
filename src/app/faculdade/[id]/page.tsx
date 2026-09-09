import { redirect } from 'next/navigation';

export default async function CadeiraIndexPage({
  params,
}: {
  params: Promise<{ cadeiraId: string }>;
}) {
  const resolvedParams = await params;
  redirect(`/faculdade/${resolvedParams.cadeiraId}/materiais`);
}