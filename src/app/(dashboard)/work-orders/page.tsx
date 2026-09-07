import { redirect } from 'next/navigation';

// Work Orders page is not yet built — redirects to Projects until implemented.
export default function WorkOrdersRedirect() {
  redirect('/projects');
}
