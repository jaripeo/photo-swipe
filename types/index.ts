import type { Asset } from 'expo-media-library/legacy';

export type MediaKind = 'photo' | 'video' | 'screenshot';

export interface PhotoGroup {
  id: string;          // "2025-07"
  label: string;       // "July 2025"
  year: number;
  month: number;       // 0-indexed (matches JS Date.getMonth())
  count: number;       // total assets in this group (all kinds)
  kindCounts: { photo: number; video: number; screenshot: number };
  coverAsset: Asset;
  assets: Asset[];
}

export type SwipeDecision = 'keep' | 'delete';

export interface SwipeRecord {
  asset: Asset;
  decision: SwipeDecision;
  groupId: string;
}
