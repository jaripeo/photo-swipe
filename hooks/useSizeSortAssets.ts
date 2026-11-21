import { useEffect, useState } from 'react';
import * as MediaLibrary from 'expo-media-library/legacy';
import type { MediaKind } from '@/types';

// Fetch this many assets' metadata to find the largest files.
// 200 gives a wide net without making loading too slow (~5-10 s on large libraries).
const POOL_SIZE = 200;
// Small concurrent batches keep the native bridge busy without flooding I/O.
const CONCURRENCY = 5;

export interface UseSizeSortAssetsReturn {
  sortedAssets: MediaLibrary.Asset[];
  fileSizeMap: Map<string, number>;
  isLoading: boolean;
  error: string | null;
}

// Returns the full sorted pool (up to POOL_SIZE items, largest first).
// The calling screen is responsible for slicing to its display window.
export function useSizeSortAssets(
  allAssets: MediaLibrary.Asset[],
  kindMap: Map<string, MediaKind>,
  enabledKinds: Set<MediaKind>,
): UseSizeSortAssetsReturn {
  const [sortedAssets, setSortedAssets] = useState<MediaLibrary.Asset[]>([]);
  const [fileSizeMap, setFileSizeMap] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (allAssets.length === 0) return;
    let cancelled = false;

    setIsLoading(true);
    setError(null);
    setSortedAssets([]);
    setFileSizeMap(new Map());

    (async () => {
      try {
        // Step 1: filter by enabled kinds
        const filtered = allAssets.filter((a) =>
          enabledKinds.has(kindMap.get(a.id) ?? 'photo')
        );

        // Step 2: heuristic pre-sort so the pool is biased toward large files
        // before we spend any time on getAssetInfoAsync calls.
        // Videos (by duration desc) float first — they are almost always the heaviest.
        // Photos/screenshots are ranked by pixel count as a proxy for file size.
        const heuristic = [...filtered].sort((a, b) => {
          const aIsVideo = (kindMap.get(a.id) ?? 'photo') === 'video';
          const bIsVideo = (kindMap.get(b.id) ?? 'photo') === 'video';
          if (aIsVideo !== bIsVideo) return aIsVideo ? -1 : 1;
          if (aIsVideo) return (b.duration ?? 0) - (a.duration ?? 0);
          return (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0);
        });
        const pool = heuristic.slice(0, Math.min(POOL_SIZE, filtered.length));

        // Step 3: resolve true fileSize for every pooled asset.
        // Pass the full Asset object (not just a.id) — native PHAsset queries on iOS
        // require the object reference for reliable metadata resolution.
        // Any asset whose fileSize is missing gets 0 so it sorts to the bottom rather
        // than being silently dropped (prevents "Nothing to show" on stubbed assets).
        const sizeMap = new Map<string, number>();
        for (let i = 0; i < pool.length; i += CONCURRENCY) {
          if (cancelled) return;
          const batch = pool.slice(i, i + CONCURRENCY);
          const infos = await Promise.all(
            batch.map((a) => MediaLibrary.getAssetInfoAsync(a))
          );
          for (const info of infos) {
            // iOS may include the underlying file size even though the legacy
            // cross-platform type does not expose the platform-specific field.
            const fileSize = (info as MediaLibrary.AssetInfo & { fileSize?: number }).fileSize;
            sizeMap.set(info.id, fileSize ?? 0);
          }
        }

        if (cancelled) return;

        // Step 4: sort the full pool by real file size, largest first
        const sorted = [...pool].sort(
          (a, b) => (sizeMap.get(b.id) ?? 0) - (sizeMap.get(a.id) ?? 0)
        );

        setSortedAssets(sorted);
        setFileSizeMap(sizeMap);
        setIsLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load file sizes');
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAssets.length]);

  return { sortedAssets, fileSizeMap, isLoading, error };
}
