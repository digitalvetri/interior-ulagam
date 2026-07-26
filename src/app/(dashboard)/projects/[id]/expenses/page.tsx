'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatRupees } from '@/lib/utils';
import type { Expense, ExpenseCategory } from '@/types/accounts';

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  petty_cash: 'Petty Cash',
  transport: 'Transport',
  labour: 'Labour',
  material: 'Material',
  other: 'Other',
};

const CATEGORY_STYLES: Record<ExpenseCategory, string> = {
  petty_cash: 'bg-gray-100 text-gray-700 border-gray-200',
  transport: 'bg-blue-100 text-blue-700 border-blue-200',
  labour: 'bg-orange-100 text-orange-700 border-orange-200',
  material: 'bg-purple-100 text-purple-700 border-purple-200',
  other: 'bg-gray-100 text-gray-700 border-gray-200',
};

const ALL_CATEGORIES: ExpenseCategory[] = [
  'petty_cash',
  'transport',
  'labour',
  'material',
  'other',
];

// ─── Log Expense Dialog ───────────────────────────────────────────────────────

interface LogExpenseDialogProps {
  projectId: string;
  onSuccess: () => void;
}

function LogExpenseDialog({ projectId, onSuccess }: LogExpenseDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [category, setCategory] = useState<ExpenseCategory>('petty_cash');
  const [amountRupees, setAmountRupees] = useState('');
  const [description, setDescription] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');

  const resetForm = () => {
    setCategory('petty_cash');
    setAmountRupees('');
    setDescription('');
    setReceiptUrl('');
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    setSubmitError(null);

    const parsedAmount = parseFloat(amountRupees);
    if (!amountRupees || isNaN(parsedAmount) || parsedAmount <= 0) {
      setSubmitError('Please enter a valid amount in rupees');
      return;
    }

    const amountPaise = Math.round(parsedAmount * 100);

    const payload: {
      projectId: string;
      category: ExpenseCategory;
      amountPaise: number;
      description?: string;
      receiptUrl?: string;
    } = {
      projectId,
      category,
      amountPaise,
    };

    if (description.trim()) {
      payload.description = description.trim();
    }
    if (receiptUrl.trim()) {
      payload.receiptUrl = receiptUrl.trim();
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error: string };
        setSubmitError(typeof json.error === 'string' ? json.error : 'Failed to log expense');
        return;
      }

      resetForm();
      setOpen(false);
      onSuccess();
    } catch {
      setSubmitError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button>Log Expense</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Expense</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Select
              value={category}
              onValueChange={(val) => setCategory(val as ExpenseCategory)}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {ALL_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="amount">
              Amount (₹) <span className="text-xs text-gray-400 font-normal">— stored as paise</span>
            </Label>
            <Input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="e.g. 1500"
              value={amountRupees}
              onChange={(e) => setAmountRupees(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              type="text"
              placeholder="Brief description of the expense"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Receipt URL */}
          <div className="space-y-1.5">
            <Label htmlFor="receiptUrl">
              Receipt URL <span className="text-xs text-gray-400 font-normal">optional</span>
            </Label>
            <Input
              id="receiptUrl"
              type="url"
              placeholder="https://…"
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
            />
          </div>

          {submitError && (
            <p className="text-sm text-red-600">{submitError}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              setOpen(false);
            }}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Expense'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectExpensesPage({ params }: PageProps) {
  const { id: projectId } = use(params);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchExpenses = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/expenses`);
      if (!res.ok) {
        setFetchError('Failed to load expenses');
        return;
      }
      const json = (await res.json()) as { data: Expense[] };
      setExpenses(json.data);
    } catch {
      setFetchError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  };

  // Data fetch on mount — TanStack Query refactor tracked separately.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void fetchExpenses(); }, [projectId]);

  // ─── Summary Calculations ───────────────────────────────────────────────

  const totalPaise = expenses.reduce((sum, e) => sum + e.amountPaise, 0);

  const categoryBreakdown = ALL_CATEGORIES.map((cat) => {
    const catTotal = expenses
      .filter((e) => e.category === cat)
      .reduce((sum, e) => sum + e.amountPaise, 0);
    return { category: cat, totalPaise: catTotal };
  }).filter((c) => c.totalPaise > 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link
            href={`/projects/${projectId}`}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to Project
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Project Expenses</h1>
        </div>
        <LogExpenseDialog projectId={projectId} onSuccess={fetchExpenses} />
      </div>

      {/* Expenses Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {loading && (
          <div className="p-8 text-center text-sm text-gray-500">
            Loading expenses…
          </div>
        )}
        {fetchError && !loading && (
          <div className="p-8 text-center text-sm text-red-600">{fetchError}</div>
        )}
        {!loading && !fetchError && expenses.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-500">
            No expenses logged yet. Use &ldquo;Log Expense&rdquo; to add one.
          </div>
        )}
        {!loading && !fetchError && expenses.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Category
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Description
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">
                  Amount
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Logged Via
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={CATEGORY_STYLES[expense.category]}
                    >
                      {CATEGORY_LABELS[expense.category]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {expense.description ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatRupees(expense.amountPaise)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 capitalize">
                    {expense.loggedVia}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(expense.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary Footer */}
      {!loading && !fetchError && expenses.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Total Expenses</span>
            <span className="text-base font-bold text-gray-900">
              {formatRupees(totalPaise)}
            </span>
          </div>
          {categoryBreakdown.length > 0 && (
            <div className="border-t border-gray-200 pt-3 space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Breakdown by Category
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {categoryBreakdown.map(({ category, totalPaise: catTotal }) => (
                  <div
                    key={category}
                    className="flex items-center justify-between rounded-md bg-white border border-gray-200 px-3 py-2"
                  >
                    <span className="text-xs text-gray-600">
                      {CATEGORY_LABELS[category]}
                    </span>
                    <span className="text-xs font-semibold text-gray-900">
                      {formatRupees(catTotal)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
