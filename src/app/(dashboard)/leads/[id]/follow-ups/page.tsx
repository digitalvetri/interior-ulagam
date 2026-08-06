import { redirect } from 'next/navigation';

// Follow-ups are now managed via the modal on the leads list.
// Redirect legacy bookmarks/links to the lead detail page.
export default async function FollowUpsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/leads/${id}`);
}
