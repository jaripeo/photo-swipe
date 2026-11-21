import { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  SafeAreaView,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMediaLibraryContext } from '@/contexts/MediaLibraryContext';
import { useTrash } from '@/contexts/TrashContext';
import { useFilter } from '@/contexts/FilterContext';
import { useSwipeSession } from '@/hooks/useSwipeSession';
import { SwipeCard } from '@/components/SwipeCard';
import type { Asset } from 'expo-media-library/legacy';

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function toMs(creationTime: number): number {
  return creationTime < 1_000_000_000_000 ? creationTime * 1000 : creationTime;
}

function fisherYates<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function DateRangeSwipeScreen() {
  const { startMs, endMs, shuffled, batchLimit } = useLocalSearchParams<{
    startMs: string;
    endMs: string;
    shuffled: string;
    batchLimit: string;
  }>();

  const startMsN = parseInt(startMs ?? '0', 10);
  const endMsN = parseInt(endMs ?? '0', 10);
  const isShuffled = shuffled === 'true';
  // 0 is the sentinel for "no limit" (mirrors the modal's BATCH_OPTIONS).
  const batchLimitN = parseInt(batchLimit ?? '15', 10);

  const { photoGroups, kindMap } = useMediaLibraryContext();
  const { addToTrash, removeFromTrash } = useTrash();
  const { enabledKinds } = useFilter();
  const { width: W, height: H } = useWindowDimensions();
  const [deletedCount, setDeletedCount] = useState(0);

  // Flatten every month's assets, filter by date range + active kinds, sort
  // oldest-to-newest, optionally shuffle the full pool, then cap to batchLimit.
  // Order matters: shuffle the WHOLE pool first so the batch is a random sample,
  // not just the oldest N items.
  const assets = useMemo((): Asset[] => {
    const filtered = photoGroups
      .flatMap((g) => g.assets)
      .filter((a) => {
        const ms = toMs(a.creationTime);
        return (
          ms >= startMsN &&
          ms <= endMsN &&
          enabledKinds.has(kindMap.get(a.id) ?? 'photo')
        );
      })
      .sort((a, b) => toMs(a.creationTime) - toMs(b.creationTime));

    const ordered = isShuffled ? fisherYates(filtered) : filtered;
    return batchLimitN > 0 ? ordered.slice(0, batchLimitN) : ordered;
  }, [photoGroups, kindMap, enabledKinds, startMsN, endMsN, isShuffled, batchLimitN]);

  const session = useSwipeSession(assets);

  // Readable header label: "Jan 2026 – May 2026" or "Jan 2026" if same month.
  const rangeLabel = useMemo(() => {
    if (!startMsN || !endMsN) return 'Date Range';
    const s = new Date(startMsN);
    const e = new Date(endMsN);
    const sStr = `${MONTH_NAMES_SHORT[s.getMonth()]} ${s.getFullYear()}`;
    const eStr = `${MONTH_NAMES_SHORT[e.getMonth()]} ${e.getFullYear()}`;
    return sStr === eStr ? sStr : `${sStr} – ${eStr}`;
  }, [startMsN, endMsN]);

  const handleSwipeRight = () => {
    if (!session.currentAsset) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    session.decide(session.currentAsset, 'keep');
  };

  const handleSwipeLeft = () => {
    if (!session.currentAsset) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addToTrash(session.currentAsset);
    session.decide(session.currentAsset, 'delete');
    setDeletedCount((c) => c + 1);
  };

  const handleUndo = () => {
    const undone = session.undo();
    if (!undone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (undone.decision === 'delete') {
      removeFromTrash(undone.asset.id);
      setDeletedCount((c) => Math.max(0, c - 1));
    }
  };

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (assets.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={16}>
            <Text style={styles.backBtn}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{rangeLabel}</Text>
          <View style={{ minWidth: 60 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>Nothing to show</Text>
          <Text style={styles.emptySub}>
            No items match your filters{'\n'}for {rangeLabel}.
          </Text>
          <TouchableOpacity style={styles.emptyBackBtn} onPress={() => router.back()}>
            <Text style={styles.emptyBackText}>Adjust Range</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Session ─────────────────────────────────────────────────────────────────

  const { done, total } = session.progress;
  const progressPct = total > 0 ? done / total : 0;
  const CARD_W = W - 32;
  const CARD_H = H * 0.66;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={16}>
          <Text style={styles.backBtn}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{rangeLabel}</Text>
          <Text style={styles.headerSub}>
            {isShuffled ? '🔀 shuffled' : '📅 oldest first'} · {total} items
          </Text>
        </View>
        <Text style={styles.counter}>{done}/{total}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPct * 100}%` as `${number}%` }]} />
      </View>

      {/* Card area */}
      <View style={styles.cardArea}>
        {session.isComplete ? (
          <CompletionView
            rangeLabel={rangeLabel}
            deletedCount={deletedCount}
            total={total}
            onReviewTrash={() => router.replace('/(tabs)/explore')}
            onHome={() => router.replace('/(tabs)')}
          />
        ) : (
          <>
            {session.nextAsset && (
              <View style={[styles.backCard, { width: CARD_W - 20, height: CARD_H - 12 }]}>
                <Image
                  source={{ uri: session.nextAsset.uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  recyclingKey={session.nextAsset.id}
                />
              </View>
            )}
            {session.currentAsset && (
              <SwipeCard
                key={session.currentAsset.id}
                asset={session.currentAsset}
                kind={kindMap.get(session.currentAsset.id) ?? 'photo'}
                isTop
                onSwipeLeft={handleSwipeLeft}
                onSwipeRight={handleSwipeRight}
              />
            )}
          </>
        )}
      </View>

      {/* Action buttons */}
      {!session.isComplete && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={handleSwipeLeft}
            activeOpacity={0.75}
          >
            <Text style={styles.actionIcon}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.undoBtn, !session.canUndo && styles.disabledBtn]}
            onPress={handleUndo}
            disabled={!session.canUndo}
            activeOpacity={0.75}
          >
            <Text style={styles.actionIcon}>↩</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.keepBtn]}
            onPress={handleSwipeRight}
            activeOpacity={0.75}
          >
            <Text style={styles.actionIcon}>✓</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Completion ───────────────────────────────────────────────────────────────

interface CompletionViewProps {
  rangeLabel: string;
  deletedCount: number;
  total: number;
  onReviewTrash: () => void;
  onHome: () => void;
}

function CompletionView({ rangeLabel, deletedCount, total, onReviewTrash, onHome }: CompletionViewProps) {
  const kept = total - deletedCount;
  return (
    <View style={styles.doneBox}>
      <Text style={styles.doneCheck}>✓</Text>
      <Text style={styles.doneTitle}>Done with{'\n'}{rangeLabel}!</Text>
      <Text style={styles.doneStat}>
        {kept} kept · {deletedCount} queued for deletion
      </Text>
      {deletedCount > 0 ? (
        <TouchableOpacity style={styles.primaryBtn} onPress={onReviewTrash} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Review {deletedCount} in Trash →</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.allKeptMsg}>All photos kept — nothing to delete.</Text>
      )}
      <TouchableOpacity style={styles.secondaryBtn} onPress={onHome} activeOpacity={0.7}>
        <Text style={styles.secondaryBtnText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: { color: '#6C63FF', fontSize: 17, fontWeight: '600', minWidth: 60 },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerSub: { color: '#666', fontSize: 11, marginTop: 1 },
  counter: { color: '#888', fontSize: 14, minWidth: 60, textAlign: 'right' },

  progressTrack: {
    height: 3,
    backgroundColor: '#222',
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#6C63FF', borderRadius: 2 },

  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backCard: {
    position: 'absolute',
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    transform: [{ scale: 0.95 }, { translateY: 12 }],
  },

  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 10 },
  emptySub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  emptyBackBtn: {
    backgroundColor: '#6C63FF',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 14,
  },
  emptyBackText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 24,
  },
  actionBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  deleteBtn: { backgroundColor: '#1a1a1a', borderWidth: 2.5, borderColor: '#f87171' },
  undoBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#555',
  },
  keepBtn: { backgroundColor: '#1a1a1a', borderWidth: 2.5, borderColor: '#4ade80' },
  disabledBtn: { opacity: 0.25 },
  actionIcon: { fontSize: 22, color: '#fff', fontWeight: '700' },

  doneBox: { alignItems: 'center', paddingHorizontal: 32 },
  doneCheck: { fontSize: 64, color: '#6C63FF', marginBottom: 12 },
  doneTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 32,
  },
  doneStat: { fontSize: 15, color: '#888', marginBottom: 36 },
  allKeptMsg: { fontSize: 14, color: '#666', marginBottom: 36, textAlign: 'center' },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 12 },
  secondaryBtnText: { color: '#666', fontSize: 15 },
});
