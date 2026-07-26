'use client';

import { useState, type FormEvent } from 'react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Employee, EmploymentType, UserRole } from '@/types/employees';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'designer',   label: 'Designer'   },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'owner',      label: 'Owner'      },
];
const TYPES: { value: EmploymentType; label: string }[] = [
  { value: 'full_time',  label: 'Full-time'  },
  { value: 'part_time',  label: 'Part-time'  },
  { value: 'contract',   label: 'Contract'   },
  { value: 'intern',     label: 'Intern'     },
  { value: 'consultant', label: 'Consultant' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (row: Employee) => void;
}

export function NewEmployeeDialog({ open, onOpenChange, onCreated }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName]     = useState('');
  const [role, setRole]             = useState<UserRole>('designer');
  const [email, setEmail]           = useState('');
  const [phone, setPhone]           = useState('');
  const [jobTitle, setJobTitle]     = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation]     = useState('');
  const [empType, setEmpType]       = useState<EmploymentType>('full_time');
  const [hireDate, setHireDate]     = useState('');

  function reset() {
    setFullName(''); setRole('designer'); setEmail(''); setPhone('');
    setJobTitle(''); setDepartment(''); setLocation(''); setEmpType('full_time');
    setHireDate(''); setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/employees', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName:       fullName.trim(),
          role,
          email:          email.trim() || undefined,
          phone:          phone.trim() || undefined,
          jobTitle:       jobTitle.trim() || undefined,
          department:     department.trim() || undefined,
          location:       location.trim() || undefined,
          employmentType: empType,
          hireDate:       hireDate || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `Failed (${res.status})`);
      onCreated(body.data as Employee);
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add employee');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>Add employee</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ef-name">Full name *</Label>
              <Input id="ef-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ef-title">Job title</Label>
              <Input id="ef-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ef-dept">Department</Label>
              <Input id="ef-dept" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ef-role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger id="ef-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ef-type">Employment type</Label>
              <Select value={empType} onValueChange={(v) => setEmpType(v as EmploymentType)}>
                <SelectTrigger id="ef-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ef-email">Email</Label>
              <Input id="ef-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ef-phone">Phone</Label>
              <Input id="ef-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ef-loc">Location</Label>
              <Input id="ef-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ef-hire">Hire date</Label>
              <Input id="ef-hire" type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !fullName.trim()} className="bg-emerald-600 text-white hover:bg-emerald-700">
              {submitting ? 'Adding…' : 'Add employee'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
