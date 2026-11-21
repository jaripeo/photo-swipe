import { useState } from 'react';
import type { Asset } from 'expo-media-library/legacy';
import type { MediaKind, PhotoGroup } from '@/types';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// O(n) reservoir sample — picks k items in a single pass with no sorting
function reservoirSample<T>(items: T[], k: number): T[] {
  if (k >= items.length) return [...items];
  const reservoir = items.slice(0, k);
  for (let i = k; i < items.length; i++) {
    const j = Math.floor(Math.random() * (i + 1));
    if (j < k) reservoir[j] = items[i];
  }
  return reservoir;
}

/**
 * Proportional stratified sampling (largest-remainder method) across groups,
 * filtered to only include assets whose kind is in enabledKinds.
 *
 * Filtering happens before proportional allocation so that the N chosen photos
 * are drawn only from the active media types.
 */
export function sampleAcrossGroups(
  groups: PhotoGroup[],
  n: number,
  kindMap: Map<string, MediaKind>,
  enabledKinds: Set<MediaKind>
): Asset[] {
  // Build filtered virtual groups (don't mutate originals)
  const filtered = groups
    .map((g) => ({
      assets: g.assets.filter((a) => enabledKinds.has(kindMap.get(a.id) ?? 'photo')),
    }))
    .filter((g) => g.assets.length > 0);

  if (filtered.length === 0 || n <= 0) return [];

  const total = filtered.reduce((sum, g) => sum + g.assets.length, 0);
  if (n >= total) return shuffle(filtered.flatMap((g) => g.assets));

  // Largest-remainder proportional allocation
  const raw = filtered.map((g) => (n * g.assets.length) / total);
  const floors = raw.map(Math.floor);
  const allocated = floors.reduce((s, f) => s + f, 0);
  const deficit = n - allocated;

  const byRemainder = filtered
    .map((_, i) => i)
    .sort((a, b) => (raw[b] % 1) - (raw[a] % 1));

  const quotas = [...floors];
  for (let i = 0; i < deficit; i++) quotas[byRemainder[i]]++;

  const selected: Asset[] = [];
  for (let i = 0; i < filtered.length; i++) {
    if (quotas[i] > 0) {
      selected.push(...reservoirSample(filtered[i].assets, quotas[i]));
    }
  }

  return shuffle(selected);
}

/**
 * Computes a stable random sample once on mount.
 * The session is fixed when it starts — re-renders do not reshuffle.
 */
export function useRandomPhotos(
  groups: PhotoGroup[],
  kindMap: Map<string, MediaKind>,
  enabledKinds: Set<MediaKind>,
  count: number
): Asset[] {
  const [assets] = useState<Asset[]>(() =>
    sampleAcrossGroups(groups, count, kindMap, enabledKinds)
  );
  return assets;
}
