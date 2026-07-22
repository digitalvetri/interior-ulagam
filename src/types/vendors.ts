// ─── Vendor types ─────────────────────────────────────────────────────────────

export type MaterialCategory =
  | 'laminate'
  | 'hardware'
  | 'furniture'
  | 'fabric'
  | 'lighting'
  | 'flooring'
  | 'sanitary'
  | 'other';

export interface Vendor {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  category: MaterialCategory | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
}
