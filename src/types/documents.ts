export type DocumentKind = 'folder' | 'file';

export interface DocumentRow {
  id: string;
  tenantId: string;
  parentId: string | null;
  kind: DocumentKind;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  storagePath: string | null;
  projectId: string | null;
  leadId?: string | null;
  uploadedBy: string | null;
  starred: boolean;
  createdAt: string;
}

export interface DocumentCrumb {
  id: string;
  name: string;
}
