'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export interface UserContextValue {
  id: string;
  fullName: string;
  role: string;        // raw role: 'owner' | 'designer' | 'supervisor' | 'accountant'
  isAdmin: boolean;    // true when role is 'owner'
  roleLoaded: boolean; // false until the first /api/v1/me response arrives
  /** Re-read /api/v1/me, e.g. after the user renames themselves. */
  refresh: () => void;
}

const INITIAL: UserContextValue = {
  id: '', fullName: '', role: '', isAdmin: false, roleLoaded: false, refresh: () => {},
};

export const UserContext = createContext<UserContextValue>(INITIAL);

export function UserProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<UserContextValue>(INITIAL);

  const load = useCallback(() => {
    fetch('/api/v1/me')
      .then(r => r.ok ? r.json() : null)
      .then(body => {
        const d = body?.data;
        if (!d) { setValue(v => ({ ...v, roleLoaded: true })); return; }
        setValue(v => ({
          ...v,
          id: d.id ?? '',
          fullName: d.fullName ?? '',
          role: d.role ?? '',
          isAdmin: !!(d.isAdmin || d.role === 'owner'),
          roleLoaded: true,
        }));
      })
      .catch(() => setValue(v => ({ ...v, roleLoaded: true })));
  }, []);

  useEffect(() => { load(); }, [load]);

  return <UserContext.Provider value={{ ...value, refresh: load }}>{children}</UserContext.Provider>;
}

export const useUser = () => useContext(UserContext);
