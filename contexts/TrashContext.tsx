import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react';
import type { Asset } from 'expo-media-library/legacy';

interface TrashState {
  queue: Asset[];
}

type TrashAction =
  | { type: 'ADD'; asset: Asset }
  | { type: 'REMOVE'; assetId: string }
  | { type: 'CLEAR' };

function trashReducer(state: TrashState, action: TrashAction): TrashState {
  switch (action.type) {
    case 'ADD':
      if (state.queue.some((a) => a.id === action.asset.id)) return state;
      return { queue: [...state.queue, action.asset] };
    case 'REMOVE':
      return { queue: state.queue.filter((a) => a.id !== action.assetId) };
    case 'CLEAR':
      return { queue: [] };
  }
}

interface TrashContextValue {
  queue: Asset[];
  addToTrash: (asset: Asset) => void;
  removeFromTrash: (assetId: string) => void;
  clearTrash: () => void;
}

const TrashContext = createContext<TrashContextValue | null>(null);

export function TrashProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(trashReducer, { queue: [] });

  const addToTrash = useCallback((asset: Asset) => {
    dispatch({ type: 'ADD', asset });
  }, []);

  const removeFromTrash = useCallback((assetId: string) => {
    dispatch({ type: 'REMOVE', assetId });
  }, []);

  const clearTrash = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  return (
    <TrashContext.Provider value={{ queue: state.queue, addToTrash, removeFromTrash, clearTrash }}>
      {children}
    </TrashContext.Provider>
  );
}

export function useTrash(): TrashContextValue {
  const ctx = useContext(TrashContext);
  if (!ctx) throw new Error('useTrash must be used inside TrashProvider');
  return ctx;
}
