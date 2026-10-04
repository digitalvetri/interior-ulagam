import type { CivilJobStatus, CivilLineKind } from '@/types/civil';

// Response shapes of /api/v1/civil/* as the pages receive them (JSON: dates are strings).

export interface CivilStats {
  jobCount: number;
  doneCount: number;
  donePaise: number;
  billedPaise: number;
}

export interface CivilCompany extends CivilStats {
  id: string;
  name: string;
  gstin: string | null;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
  branchCount: number;
  cities: string[];
}

export interface CivilBranchCard extends CivilStats {
  id: string;
  name: string;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  cityId: string;
  cityName: string;
}

/** GET /api/v1/civil/companies/:id */
export interface CivilCompanyDetail extends Omit<CivilCompany, keyof CivilStats | 'branchCount' | 'cities'> {
  branches: CivilBranchCard[];
}

/** GET /api/v1/civil/branches/:id */
export interface CivilBranchDetail extends CivilBranchCard {
  companyId: string;
  companyName: string;
}

/** GET /api/v1/civil/branches */
export interface CivilBranchOption {
  id: string;
  name: string;
  companyId: string;
  companyName: string;
  cityId: string;
  cityName: string;
}

export interface CivilCity { id: string; name: string }
export interface CivilManager { id: string; name: string; phone: string | null; active: boolean }

/** GET /api/v1/civil/jobs rows */
export interface CivilJobRow {
  id: string;
  jobNo: number;
  jobDate: string;
  heading: string;
  remark: string | null;
  status: CivilJobStatus;
  billNo: string | null;
  billDate: string | null;
  paidDate: string | null;
  totalPaise: number;
  branchId: string;
  branchName: string;
  companyId: string;
  companyName: string;
  cityId: string;
  cityName: string;
  managerId: string | null;
  managerName: string | null;
  lineCount: number;
}

export interface CivilJobLine { id?: string; description: string; kind: CivilLineKind; amountPaise: number }

export interface CivilJobEvent {
  id: string;
  fromStatus: CivilJobStatus | null;
  toStatus: CivilJobStatus;
  note: string | null;
  createdAt: string;
  byName: string | null;
}

/** GET /api/v1/civil/jobs/:id */
export interface CivilJobDetail extends CivilJobRow {
  lines: CivilJobLine[];
  events: CivilJobEvent[];
}

/** GET /api/v1/civil/summary */
export interface CivilSummary {
  /** Jobs dated this month (all statuses). */
  monthCount: number;
  monthPaise: number;
  doneCount: number;
  donePaise: number;
  billedCount: number;
  billedPaise: number;
  paidThisMonthPaise: number;
}

export interface CivilSuggestions {
  headings: { text: string; uses: number }[];
  descriptions: { text: string; uses: number }[];
}
