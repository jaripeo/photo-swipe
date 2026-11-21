import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { MediaKind } from '@/types';

// All kinds enabled by default
const ALL_KINDS: MediaKind[] = ['photo', 'video', 'screenshot'];

interface FilterContextValue {
  enabledKinds: Set<MediaKind>;
  toggle: (kind: MediaKind) => void;
  isEnabled: (kind: MediaKind) => boolean;
  isAll: boolean;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState<Set<MediaKind>>(new Set(ALL_KINDS));

  const toggle = useCallback((kind: MediaKind) => {
    setEnabled((prev) => {
      // Prevent deselecting the last active kind
      if (prev.has(kind) && prev.size === 1) return prev;
      const next = new Set(prev);
      if (next.has(kind)) {
        next.delete(kind);
      } else {
        next.add(kind);
      }
      return next;
    });
  }, []);

  const isEnabled = useCallback(
    (kind: MediaKind) => enabled.has(kind),
    [enabled]
  );

  return (
    <FilterContext.Provider
      value={{ enabledKinds: enabled, toggle, isEnabled, isAll: enabled.size === ALL_KINDS.length }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilter must be used inside FilterProvider');
  return ctx;
}
