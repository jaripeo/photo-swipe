import { useState, useCallback } from 'react';
import type { Asset } from 'expo-media-library/legacy';
import type { SwipeDecision, SwipeRecord } from '@/types';

const MAX_UNDO = 5;

interface SessionState {
  index: number;
  history: SwipeRecord[];
}

export interface UseSwipeSessionReturn {
  currentAsset: Asset | null;
  nextAsset: Asset | null;
  progress: { done: number; total: number };
  canUndo: boolean;
  isComplete: boolean;
  decide: (asset: Asset, decision: SwipeDecision) => void;
  undo: () => SwipeRecord | null;
}

export function useSwipeSession(assets: Asset[]): UseSwipeSessionReturn {
  const [{ index, history }, setState] = useState<SessionState>({
    index: 0,
    history: [],
  });

  const decide = useCallback((asset: Asset, decision: SwipeDecision) => {
    setState((s) => ({
      index: s.index + 1,
      history: [
        ...s.history.slice(-(MAX_UNDO - 1)),
        { asset, decision, groupId: '' },
      ],
    }));
  }, []);

  // Reads current history synchronously before dispatching the state update.
  // Safe because useCallback recreates whenever `history` or `index` changes.
  const undo = useCallback((): SwipeRecord | null => {
    if (history.length === 0 || index === 0) return null;
    const last = history[history.length - 1];
    setState((s) => ({
      index: s.index - 1,
      history: s.history.slice(0, -1),
    }));
    return last;
  }, [history, index]);

  return {
    currentAsset: assets[index] ?? null,
    nextAsset: assets[index + 1] ?? null,
    progress: { done: index, total: assets.length },
    canUndo: history.length > 0 && index > 0,
    isComplete: assets.length > 0 && index >= assets.length,
    decide,
    undo,
  };
}
