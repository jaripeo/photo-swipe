import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'swipeclean:favorites';

interface FavoritesContextValue {
  isFavorited: (assetId: string) => boolean;
  toggleFavorite: (assetId: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        setFavorites(new Set(JSON.parse(raw) as string[]));
      } catch { /* corrupt data — start fresh */ }
    });
  }, []);

  const toggleFavorite = useCallback((assetId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  const isFavorited = useCallback(
    (assetId: string) => favorites.has(assetId),
    [favorites],
  );

  return (
    <FavoritesContext.Provider value={{ isFavorited, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used inside FavoritesProvider');
  return ctx;
}
