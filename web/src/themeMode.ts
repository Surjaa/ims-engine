// Light / black theme switch. The choice is kept in localStorage and applied before the first render.
// data-theme drives our CSS variables; data-bs-theme makes Bootstrap components follow the same mode.

export type ThemeMode = 'light' | 'dark';
const KEY = 'ims-theme';

export function getTheme(): ThemeMode {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.dataset.bsTheme = mode;
  root.style.colorScheme = mode;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // Storage can be blocked (private mode). The theme still applies for this visit.
  }
}
