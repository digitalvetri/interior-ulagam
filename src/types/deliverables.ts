// Types and constants for project lifecycle stages and deliverables

export type ProjectStage =
  | 'design_pending'
  | 'design_in_progress'
  | 'design_approved'
  | 'procurement'
  | 'execution'
  | 'snagging'
  | 'handover'
  | 'complete';

export type DeliverableType =
  | '2d_plan'
  | '3d_render'
  | 'color_palette'
  | 'working_drawings'
  | 'bom';

export type DeliverableStatus =
  | 'pending'
  | 'in_progress'
  | 'in_review'
  | 'approved'
  | 'rejected';

export interface Deliverable {
  id: string;
  projectId: string;
  type: DeliverableType;
  status: DeliverableStatus;
  revisionCount: number;
  revisionCap: number;
  latestFileUrl: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export const LIFECYCLE_STAGE_LABELS: Record<ProjectStage, string> = {
  design_pending: 'Design Pending',
  design_in_progress: 'Design In Progress',
  design_approved: 'Design Approved',
  procurement: 'Procurement',
  execution: 'Execution',
  snagging: 'Snagging',
  handover: 'Handover',
  complete: 'Complete',
};

export const LIFECYCLE_STAGE_ORDER: ProjectStage[] = [
  'design_pending',
  'design_in_progress',
  'design_approved',
  'procurement',
  'execution',
  'snagging',
  'handover',
  'complete',
];
