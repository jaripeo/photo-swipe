import { createContext, useContext, type ReactNode } from 'react';
import { useMediaLibrary, type UseMediaLibraryReturn } from '@/hooks/useMediaLibrary';

const MediaLibraryContext = createContext<UseMediaLibraryReturn | null>(null);

export function MediaLibraryProvider({ children }: { children: ReactNode }) {
  const value = useMediaLibrary();
  return (
    <MediaLibraryContext.Provider value={value}>
      {children}
    </MediaLibraryContext.Provider>
  );
}

export function useMediaLibraryContext(): UseMediaLibraryReturn {
  const ctx = useContext(MediaLibraryContext);
  if (!ctx) throw new Error('useMediaLibraryContext must be inside MediaLibraryProvider');
  return ctx;
}
