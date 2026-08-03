export type UserRole = 'owner' | 'designer' | 'supervisor' | 'accountant';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern' | 'consultant';
export type EmployeeStatus = 'active' | 'on_leave' | 'inactive';

export interface EmergencyContact {
  name?: string;
  relation?: string;
  phone?: string;
}

export interface Employee {
  id: string;
  tenantId: string;
  supabaseUid: string | null;
  /** True when Better Auth holds a credential for this person, i.e. they can sign in. */
  hasLogin?: boolean;
  role: UserRole;
  fullName: string;
  phone: string | null;
  email: string | null;
  photoUrl: string | null;
  jobTitle: string | null;
  department: string | null;
  location: string | null;
  employmentType: EmploymentType | null;
  hireDate: string | null;
  dob: string | null;
  managerId: string | null;
  emergencyContact: EmergencyContact | null;
  status: EmployeeStatus | string;
  createdAt: string;
}
