export type DesignTaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type DesignTaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface DesignTask {
  id: string;
  tenantId: string;
  projectId: string | null;
  title: string;
  description: string | null;
  status: DesignTaskStatus;
  priority: DesignTaskPriority;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  // Joined from projects + customers
  projectName: string | null;
  customerName: string | null;
  designerIds: string[] | null;
}
