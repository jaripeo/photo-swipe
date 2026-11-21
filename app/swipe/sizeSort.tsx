import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import type { Asset } from 'expo-media-library/legacy';
import { useMediaLibraryContext } from '@/contexts/MediaLibraryContext';
import { useFilter } from '@/contexts/FilterContext';
import { useSizeSortAssets } from '@/hooks/useSizeSortAssets';
import { SizeSortPreviewModal } from '@/components/SizeSortPreviewModal';
import type { MediaKind } from '@/types';

const CELL_GAP = 8;
const CELL_MARGIN = 12;

function formatFileSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${Math.round(bytes / 1_048_576)} MB`;
  if (bytes >= 1_024) return `${Math.round(bytes / 1_024)} KB`;
  return `${bytes} B`;
}

function formatDate(creationTime: number): string {
  const ms = creationTime < 1_000_000_000_000 ? creationTime * 1000 : creationTime;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Grid cell ────────────────────────────────────────────────────────────────

interface CellProps {
  asset: Asset;
  rank: number;
  kind: MediaKind;
  fileSize: number;
  cellWidth: number;
  onPress: () => void;
}

function GridCell({ asset, rank, kind, fileSize, cellWidth, onPress }: CellProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[styles.cell, { width: cellWidth, height: cellWidth * 1.1 }]}
    >
      <Image
        source={{ uri: asset.uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        recyclingKey={asset.id}
      />

      {/* Rank badge — top left */}
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>#{rank}</Text>
      </View>

      {/* Video indicator — top right */}
      {kind === 'video' && (
        <View style={styles.videoBadge}>
          <Text style={styles.videoIcon}>▶</Text>
        </View>
      )}

      {/* Bottom overlay — size + date */}
      <View style={styles.cellOverlay}>
        <Text style={styles.cellSize} numberOfLines={1}>
          {formatFileSize(fileSize)}
        </Text>
        <Text style={styles.cellDate} numberOfLines={1}>
          {formatDate(asset.creationTime)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SizeSortScreen() {
  const { batchLimit } = useLocalSearchParams<{ batchLimit: string }>();
  const batchLimitN = parseInt(batchLimit ?? '15', 10);

  const { photoGroups, kindMap, refreshLibrary } = useMediaLibraryContext();
  const { enabledKinds } = useFilter();
  const { width: W } = useWindowDimensions();

  const cellWidth = Math.floor((W - CELL_MARGIN * 2 - CELL_GAP) / 2);

  const allAssets = useMemo(
    () => photoGroups.flatMap((g) => g.assets),
    [photoGroups],
  );

  const { sortedAssets, fileSizeMap, isLoading, error } = useSizeSortAssets(
    allAssets,
    kindMap,
    enabledKinds,
  );

  // Local copy so deletions take effect immediately without re-fetching
  const [localAssets, setLocalAssets] = useState<Asset[]>([]);
  // How many items from localAssets are currently visible
  const [displayCount, setDisplayCount] = useState(batchLimitN);
  // Modal state
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const hasInitializedAssets = useRef(false);

  // Initialise once when the hook finishes. Do not repopulate after the user
  // deletes the last item from the local list.
  useEffect(() => {
    if (!hasInitializedAssets.current && sortedAssets.length > 0) {
      hasInitializedAssets.current = true;
      setLocalAssets(sortedAssets);
    }
  }, [sortedAssets]);

  const displayedAssets = localAssets.slice(0, displayCount);
  const remaining = localAssets.length - displayCount;
  const hasMore = remaining > 0;

  const handleLoadNext = () => {
    setDisplayCount((c) => Math.min(c + batchLimitN, localAssets.length));
  };

  const handleDeleteSuccess = useCallback((assetId: string) => {
    setLocalAssets((prev) => prev.filter((a) => a.id !== assetId));
    setModalVisible(false);
    setSelectedAsset(null);
    refreshLibrary(); // background sync — keeps global context in step
  }, [refreshLibrary]);

  // ── Loading / error ─────────────────────────────────────────────────────────

  if (isLoading || error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={16}>
            <Text style={styles.backBtn}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Size Sort</Text>
          <View style={{ minWidth: 60 }} />
        </View>
        <View style={styles.centered}>
          {error ? (
            <>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.actionBtn} onPress={() => router.back()}>
                <Text style={styles.actionBtnText}>Go Back</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color="#f59e0b" />
              <Text style={styles.loadingText}>Measuring file sizes…</Text>
              <Text style={styles.loadingSub}>Finding your heaviest items</Text>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (localAssets.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={16}>
            <Text style={styles.backBtn}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Size Sort</Text>
          <View style={{ minWidth: 60 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>Nothing to show</Text>
          <Text style={styles.emptySub}>No items match your active filters.</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.back()}>
            <Text style={styles.actionBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Leaderboard list ────────────────────────────────────────────────────────

  const listHeader = (
    <View style={styles.listHeader}>
      <Text style={styles.listHeaderText}>
        Showing {displayedAssets.length} of {localAssets.length} heaviest items · tap to preview
      </Text>
    </View>
  );

  const listFooter = (
    <View style={styles.footer}>
      {hasMore ? (
        <TouchableOpacity style={styles.loadNextBtn} onPress={handleLoadNext} activeOpacity={0.82}>
          <Text style={styles.loadNextText}>
            Load Next {Math.min(batchLimitN, remaining)} Heaviest Items  ↓
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.allLoadedBadge}>
          <Text style={styles.allLoadedText}>
            All {localAssets.length} items loaded
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={16}>
            <Text style={styles.backBtn}>‹ Back</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Size Sort</Text>
            <Text style={styles.headerSub}>⚖️ largest first</Text>
          </View>
          <View style={{ minWidth: 60 }} />
        </View>

        {/* Grid */}
        <FlatList<Asset>
          data={displayedAssets}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          renderItem={({ item, index }) => (
            <GridCell
              asset={item}
              rank={index + 1}
              kind={kindMap.get(item.id) ?? 'photo'}
              fileSize={fileSizeMap.get(item.id) ?? 0}
              cellWidth={cellWidth}
              onPress={() => {
                setSelectedAsset(item);
                setModalVisible(true);
              }}
            />
          )}
        />
      </SafeAreaView>

      <SizeSortPreviewModal
        asset={selectedAsset}
        kind={selectedAsset ? (kindMap.get(selectedAsset.id) ?? 'photo') : 'photo'}
        fileSize={selectedAsset ? (fileSizeMap.get(selectedAsset.id) ?? 0) : 0}
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setSelectedAsset(null);
        }}
        onDeleteSuccess={handleDeleteSuccess}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: { color: '#f59e0b', fontSize: 17, fontWeight: '600', minWidth: 60 },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerSub: { color: '#666', fontSize: 11, marginTop: 1 },

  // ── Loading / error / empty ──
  loadingText: { color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 20 },
  loadingSub: { color: '#666', fontSize: 13, marginTop: 6 },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorText: { color: '#f87171', fontSize: 15, textAlign: 'center', marginBottom: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 10 },
  emptySub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  actionBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 14,
  },
  actionBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },

  // ── List header / footer ──
  listHeader: {
    paddingHorizontal: CELL_MARGIN,
    paddingTop: 4,
    paddingBottom: 12,
  },
  listHeaderText: {
    color: '#555',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  footer: {
    paddingHorizontal: CELL_MARGIN,
    paddingTop: 16,
    paddingBottom: 32,
  },
  loadNextBtn: {
    backgroundColor: '#1f1a0a',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#f59e0b66',
    paddingVertical: 16,
    alignItems: 'center',
  },
  loadNextText: {
    color: '#fbbf24',
    fontSize: 15,
    fontWeight: '700',
  },
  allLoadedBadge: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  allLoadedText: {
    color: '#3a3a3a',
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Grid ──
  grid: {
    paddingBottom: 8,
  },
  row: {
    paddingHorizontal: CELL_MARGIN,
    gap: CELL_GAP,
    marginBottom: CELL_GAP,
  },

  // ── Grid cell ──
  cell: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  rankBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  rankText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '800',
  },
  videoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 8,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoIcon: { color: '#fff', fontSize: 10 },
  cellOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  cellSize: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  cellDate: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    marginTop: 1,
  },
});
