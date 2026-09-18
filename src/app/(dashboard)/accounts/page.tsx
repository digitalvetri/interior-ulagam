import { redirect } from 'next/navigation';

// Legacy /accounts route → /finance
export default function AccountsRedirect() {
  redirect('/finance');
}
