import { useState, useEffect, useCallback, useRef } from 'react';
import * as MediaLibrary from 'expo-media-library/legacy';
import type { MediaKind, PhotoGroup } from '@/types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// expo-media-library returns creationTime in seconds on iOS, ms on Android.
function toMs(creationTime: number): number {
  return creationTime < 1_000_000_000_000 ? creationTime * 1000 : creationTime;
}

// Fetch every asset (photos + videos) across the whole library in batches.
async function fetchAllAssets(): Promise<MediaLibrary.Asset[]> {
  const all: MediaLibrary.Asset[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const page = await MediaLibrary.getAssetsAsync({
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      first: 500,
      after: cursor,
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });
    all.push(...page.assets);
    cursor = page.endCursor;
    hasMore = page.hasNextPage;
  }

  return all;
}

// iOS stores screenshots in a smart album called "Screenshots".
// We fetch just their IDs to cross-reference later — no image data loaded.
async function fetchScreenshotIds(): Promise<Set<string>> {
  try {
    const album = await MediaLibrary.getAlbumAsync('Screenshots');
    if (!album) return new Set();

    const ids = new Set<string>();
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const page = await MediaLibrary.getAssetsAsync({
        album,
        mediaType: MediaLibrary.MediaType.photo,
        first: 500,
        after: cursor,
      });
      page.assets.forEach((a) => ids.add(a.id));
      cursor = page.endCursor;
      hasMore = page.hasNextPage;
    }

    return ids;
  } catch {
    return new Set(); // album may not exist on this device
  }
}

function buildKindMap(
  assets: MediaLibrary.Asset[],
  screenshotIds: Set<string>
): Map<string, MediaKind> {
  const map = new Map<string, MediaKind>();
  for (const asset of assets) {
    if (asset.mediaType === 'video') {
      map.set(asset.id, 'video');
    } else if (screenshotIds.has(asset.id)) {
      map.set(asset.id, 'screenshot');
    } else {
      map.set(asset.id, 'photo');
    }
  }
  return map;
}

function groupAssetsByMonth(
  assets: MediaLibrary.Asset[],
  kindMap: Map<string, MediaKind>
): PhotoGroup[] {
  const buckets = new Map<string, MediaLibrary.Asset[]>();

  for (const asset of assets) {
    const date = new Date(toMs(asset.creationTime));
    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;

    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(asset);
    } else {
      buckets.set(key, [asset]);
    }
  }

  const groups: PhotoGroup[] = [];

  for (const [key, groupAssets] of buckets) {
    const [yearStr, monthStr] = key.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;

    const kindCounts = { photo: 0, video: 0, screenshot: 0 };
    for (const a of groupAssets) {
      kindCounts[kindMap.get(a.id) ?? 'photo']++;
    }

    groups.push({
      id: key,
      label: `${MONTH_NAMES[month]} ${year}`,
      year,
      month,
      count: groupAssets.length,
      kindCounts,
      coverAsset: groupAssets[0],
      assets: groupAssets,
    });
  }

  return groups.sort((a, b) =>
    b.year !== a.year ? b.year - a.year : b.month - a.month
  );
}

// ─── Public interface ──────────────────────────────────────────────────────

interface State {
  permissionStatus: MediaLibrary.PermissionStatus | null;
  photoGroups: PhotoGroup[];
  kindMap: Map<string, MediaKind>;
  totalCount: number;
  isLoading: boolean;
  error: string | null;
}

export interface UseMediaLibraryReturn extends State {
  requestPermission: () => Promise<void>;
  refreshLibrary: () => Promise<void>;
  deleteAssets: (assets: MediaLibrary.Asset[]) => Promise<boolean>;
}

export function useMediaLibrary(): UseMediaLibraryReturn {
  const [state, setState] = useState<State>({
    permissionStatus: null,
    photoGroups: [],
    kindMap: new Map(),
    totalCount: 0,
    isLoading: false,
    error: null,
  });

  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const loadPhotos = useCallback(async () => {
    if (!alive.current) return;
    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      // Fetch all assets and screenshot IDs in parallel
      const [assets, screenshotIds] = await Promise.all([
        fetchAllAssets(),
        fetchScreenshotIds(),
      ]);

      const kindMap = buildKindMap(assets, screenshotIds);
      const photoGroups = groupAssetsByMonth(assets, kindMap);

      if (alive.current) {
        setState((s) => ({
          ...s,
          photoGroups,
          kindMap,
          totalCount: assets.length,
          isLoading: false,
        }));
      }
    } catch (err) {
      if (alive.current) {
        const message = err instanceof Error ? err.message : 'Failed to load library';
        setState((s) => ({ ...s, isLoading: false, error: message }));
      }
    }
  }, []);

  const requestPermission = useCallback(async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (alive.current) setState((s) => ({ ...s, permissionStatus: status }));
    if (status === 'granted') await loadPhotos();
  }, [loadPhotos]);

  const refreshLibrary = useCallback(async () => {
    if (state.permissionStatus === 'granted') await loadPhotos();
  }, [state.permissionStatus, loadPhotos]);

  const deleteAssets = useCallback(
    async (assets: MediaLibrary.Asset[]): Promise<boolean> => {
      try {
        await MediaLibrary.deleteAssetsAsync(assets);
        await loadPhotos();
        return true;
      } catch (err) {
        // PHPhotosErrorDomain 3072 = user cancelled native prompt — not an error
        if (err instanceof Error && err.message.includes('3072')) return false;
        if (alive.current) {
          const message = err instanceof Error ? err.message : 'Delete failed';
          setState((s) => ({ ...s, error: message }));
        }
        return false;
      }
    },
    [loadPhotos]
  );

  useEffect(() => {
    MediaLibrary.getPermissionsAsync().then(({ status }) => {
      if (!alive.current) return;
      setState((s) => ({ ...s, permissionStatus: status }));
      if (status === 'granted') loadPhotos();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, requestPermission, refreshLibrary, deleteAssets };
}
