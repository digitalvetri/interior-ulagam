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

export interface StageStyle {
  label: string;
  bg: string;
  fg: string;
  border: string;
}

export const STAGE_STYLE_MAP: Record<ProjectStage, StageStyle> = {
  design_pending:     { label: 'Design Pending',  bg: '#EFF6FF',                 fg: '#1E40AF', border: 'rgba(30,64,175,0.20)'    },
  design_in_progress: { label: 'In Progress',     bg: '#FFF7ED',                 fg: '#9A3412', border: 'rgba(154,52,18,0.20)'    },
  design_approved:    { label: 'Design Approved', bg: '#ECFDF5',                 fg: '#065F46', border: 'rgba(6,95,70,0.20)'       },
  procurement:        { label: 'Procurement',     bg: '#FEF3C7',                 fg: '#92400E', border: 'rgba(146,64,14,0.20)'    },
  execution:          { label: 'Execution',       bg: '#F5F3FF',                 fg: '#6B21A8', border: 'rgba(107,33,168,0.20)'   },
  snagging:           { label: 'Snagging',        bg: '#FDF2F8',                 fg: '#BE185D', border: 'rgba(190,24,93,0.20)'    },
  handover:           { label: 'Handover',        bg: '#FEF2F2',                 fg: '#991B1B', border: 'rgba(153,27,27,0.20)'    },
  complete:           { label: 'Complete',        bg: 'rgba(15,157,110,0.10)',   fg: '#0F6E4A', border: 'rgba(15,157,110,0.24)'   },
};

export const LIFECYCLE_STAGE_LABELS: Record<ProjectStage, string> = Object.fromEntries(
  Object.entries(STAGE_STYLE_MAP).map(([k, v]) => [k, v.label]),
) as Record<ProjectStage, string>;

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
