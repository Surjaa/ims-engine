import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { request } from './api';
import type { Settings } from './types';

interface SettingsCtx {
  settings: Settings;
  refresh: () => void;
}

const Ctx = createContext<SettingsCtx>({ settings: {}, refresh: () => {} });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>({});

  const refresh = () => {
    request<Settings>('/settings')
      .then(setSettings)
      .catch(() => {});
  };

  useEffect(() => {
    refresh();
  }, []);

  return <Ctx.Provider value={{ settings, refresh }}>{children}</Ctx.Provider>;
}

export const useSettings = () => useContext(Ctx);
