import { redirect } from 'next/navigation';

export default async function RequirementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/leads/${id}`);
}
