// ─── Analytics types ──────────────────────────────────────────────────────────
// All monetary values are in PAISE (integers). Display layer divides by 100.

export interface DesignerMetrics {
  /** users.id */
  userId: string;
  fullName: string;
  phone: string | null;
  /** Count of active projects (lifecycleStage NOT IN ('complete')) */
  activeProjectCount: number;
  /** Count of projects with lifecycleStage='complete' */
  completedProjects: number;
  /** Sum of totalContractPaise across all assigned projects (paise integer) */
  totalContractPaise: number;
  /**
   * Aggregate margin percentage across approved quote lines for assigned projects.
   * Computed as: SUM(marginPaise) / SUM(clientRatePaise * qty) * 100
   * Returns null when no approved quote lines exist.
   */
  avgMarginPct: number | null;
  /** Average revisionCount across deliverables on their projects */
  avgRevisionCount: number | null;
}

export interface CostToComplete {
  /** Cost quoted in approved quote lines (SUM costRatePaise * qty) */
  quotedCostPaise: number;
  /** Revenue quoted in approved quote lines (SUM clientRatePaise * qty) */
  quotedClientPaise: number;
  /** Actual expenses logged so far */
  actualExpensesPaise: number;
  /** Remaining budget = max(0, quotedCostPaise - actualExpensesPaise) */
  remainingPaise: number;
  /** Variance = actualExpensesPaise - quotedCostPaise (positive = over budget) */
  variancePaise: number;
  /** Burn percentage = actualExpensesPaise / quotedCostPaise * 100 */
  burnPct: number;
  status: 'on_track' | 'watch' | 'overrun';
}
