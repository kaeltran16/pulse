import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { colorScheme as nwColorScheme } from 'nativewind';

export type Mode = 'light' | 'dark' | 'system';
export type Resolved = 'light' | 'dark';

type ThemeContextValue = {
  mode: Mode;
  resolved: Resolved;
  setMode: (m: Mode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>('system');
  const systemScheme = useRNColorScheme();

  const resolved: Resolved =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  useEffect(() => {
    nwColorScheme.set(mode);
  }, [mode]);

  const setMode = useCallback((m: Mode) => setModeState(m), []);

  const value = useMemo(
    () => ({ mode, resolved, setMode }),
    [mode, resolved, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
