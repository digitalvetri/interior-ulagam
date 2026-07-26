export type CustomerSource =
  | 'referral' | 'instagram' | 'whatsapp' | 'website' | 'walk_in' | 'imported' | 'other';

export type CustomerStage = 'lead' | 'opportunity' | 'client' | 'past_client';

export interface Customer {
  id: string;
  tenantId: string;
  ownerId: string | null;
  fullName: string;
  email: string | null;
  phone: string;
  company: string | null;
  city: string | null;
  address: string | null;
  source: CustomerSource;
  stage: CustomerStage;
  tags: string[];
  notes: string | null;
  lastContactedAt: string | null;
  createdAt: string;
}
