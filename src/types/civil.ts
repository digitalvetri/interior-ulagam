import { z } from 'zod';

// ─── Civil Management — shared client/server schemas ─────────────────────────

/** No Pending: jobs are entered once the work is finished. */
export const CIVIL_JOB_STATUSES = ['done', 'billed', 'paid'] as const;
export type CivilJobStatus = (typeof CIVIL_JOB_STATUSES)[number];

export const CIVIL_LINE_KINDS = ['material', 'labour'] as const;
export type CivilLineKind = (typeof CIVIL_LINE_KINDS)[number];

const optionalText = z.string().trim().max(500).optional().nullable()
  .transform(v => (v ? v : null));

/** yyyy-mm-dd — what <input type="date"> produces and Postgres `date` accepts. */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-09-21');

export const CivilCompanyInput = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(200),
  gstin: optionalText,
  address: optionalText,
  contactName: optionalText,
  contactPhone: optionalText,
  notes: optionalText,
});
export type CivilCompanyInput = z.infer<typeof CivilCompanyInput>;

export const CivilCityInput = z.object({
  name: z.string().trim().min(1, 'City name is required').max(120),
});

export const CivilBranchInput = z.object({
  companyId: z.string().uuid(),
  /** Either an existing city… */
  cityId: z.string().uuid().optional(),
  /** …or a new city name, created on the spot. */
  cityName: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().min(1, 'Branch name is required').max(200),
  address: optionalText,
  contactName: optionalText,
  contactPhone: optionalText,
}).refine(v => v.cityId || v.cityName, { message: 'Pick a city or type a new one', path: ['cityId'] });
export type CivilBranchInput = z.infer<typeof CivilBranchInput>;

export const CivilManagerInput = z.object({
  name: z.string().trim().min(1, 'Manager name is required').max(120),
  phone: optionalText,
  active: z.boolean().optional(),
});

export const CivilJobLineInput = z.object({
  /** Existing line id — lets an edit keep the line's private real cost. */
  id: z.string().uuid().optional(),
  description: z.string().trim().min(1, 'Each line needs a description').max(500),
  kind: z.enum(CIVIL_LINE_KINDS),
  amountPaise: z.number().int().min(0).max(1_000_000_000_00),
});
export type CivilJobLineInput = z.infer<typeof CivilJobLineInput>;

export const CivilJobInput = z.object({
  branchId: z.string().uuid(),
  jobDate: isoDate,
  heading: z.string().trim().min(1, 'Work heading is required').max(200),
  remark: optionalText,
  managerId: z.string().uuid().optional().nullable(),
  lines: z.array(CivilJobLineInput).min(1, 'Add at least one line').max(200),
});
export type CivilJobInput = z.infer<typeof CivilJobInput>;

export const CivilStatusChangeInput = z.object({
  to: z.enum(CIVIL_JOB_STATUSES),
  billNo: z.string().trim().max(100).optional(),
  billDate: isoDate.optional(),
  paidDate: isoDate.optional(),
});
export type CivilStatusChangeInput = z.infer<typeof CivilStatusChangeInput>;

export const CivilBulkStatusInput = z.object({
  jobIds: z.array(z.string().uuid()).min(1).max(500),
  change: CivilStatusChangeInput,
});

// ─── Import ──────────────────────────────────────────────────────────────────

export interface ParsedCivilLine {
  description: string;
  kind: CivilLineKind;
  amountPaise: number;
}

export interface ParsedCivilJob {
  jobNo: number;
  jobDate: string | null;
  storeName: string;
  heading: string;
  lines: ParsedCivilLine[];
  remark: string | null;
  managerName: string | null;
  billNo: string | null;
  billDate: string | null;
  statedTotalPaise: number | null;
  /** Stated TOTAL disagrees with the sum of the lines. */
  mismatch: boolean;
}

export interface ParsedCivilWorkbook {
  sheetName: string;
  /** Every sheet that has the job columns, so the user can pick the right one. */
  sheets: { name: string; jobCount: number }[];
  jobs: ParsedCivilJob[];
  storeNames: string[];
  managerNames: string[];
}

/** One job row of an import — also used by the browser to pre-check each row. */
export const CivilImportJobInput = z.object({
  jobNo: z.number().int().positive(),
  jobDate: isoDate,
  storeName: z.string().min(1),
  heading: z.string().trim().min(1, 'Work heading is empty').max(200, 'Work heading is longer than 200 characters'),
  remark: z.string().max(2000, 'Remark is longer than 2000 characters').nullable(),
  managerName: z.string().trim().max(120, 'Manager name is longer than 120 characters').nullable(),
  billNo: z.string().trim().max(100, 'Bill no. is longer than 100 characters').nullable(),
  billDate: isoDate.nullable(),
  lines: z.array(CivilJobLineInput).max(200, 'More than 200 amount lines'),
});
export type CivilImportJobInput = z.infer<typeof CivilImportJobInput>;

export const CivilImportCommitInput = z.object({
  /** Store name in the sheet → where it lives in the app. */
  storeMap: z.array(z.object({
    storeName: z.string().min(1),
    companyName: z.string().trim().min(1).max(200),
    cityName: z.string().trim().min(1).max(120),
    branchName: z.string().trim().min(1).max(200),
  })).min(1).max(500),
  jobs: z.array(CivilImportJobInput).min(1).max(5000),
});
export type CivilImportCommitInput = z.infer<typeof CivilImportCommitInput>;

// ─── Real costs (owner only — never exported) ────────────────────────────────

export const CivilJobCostsInput = z.object({
  /** Real cost per billed line; null clears it. Lines not listed are left as they are. */
  lines: z.array(z.object({
    id: z.string().uuid(),
    costPaise: z.number().int().min(0).max(1_000_000_000_00).nullable(),
  })).max(200),
  /** Costs that are not billed to the client. Replaces the job's whole list. */
  extras: z.array(z.object({
    description: z.string().trim().min(1, 'Each extra cost needs a description').max(200),
    amountPaise: z.number().int().min(0).max(1_000_000_000_00),
  })).max(100),
});
export type CivilJobCostsInput = z.infer<typeof CivilJobCostsInput>;
