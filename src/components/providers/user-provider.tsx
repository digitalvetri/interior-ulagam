'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface UserContextValue {
  id: string;
  fullName: string;
  role: string;        // raw role: 'owner' | 'designer' | 'supervisor' | 'accountant'
  isAdmin: boolean;    // true when role is 'owner'
  roleLoaded: boolean; // false until the first /api/v1/me response arrives
}

const INITIAL: UserContextValue = {
  id: '', fullName: '', role: '', isAdmin: false, roleLoaded: false,
};

export const UserContext = createContext<UserContextValue>(INITIAL);

export function UserProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<UserContextValue>(INITIAL);

  useEffect(() => {
    fetch('/api/v1/me')
      .then(r => r.ok ? r.json() : null)
      .then(body => {
        const d = body?.data;
        if (!d) { setValue(v => ({ ...v, roleLoaded: true })); return; }
        setValue({
          id: d.id ?? '',
          fullName: d.fullName ?? '',
          role: d.role ?? '',
          isAdmin: !!(d.isAdmin || d.role === 'owner'),
          roleLoaded: true,
        });
      })
      .catch(() => setValue(v => ({ ...v, roleLoaded: true })));
  }, []);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export const useUser = () => useContext(UserContext);
