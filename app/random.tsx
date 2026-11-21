import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  SafeAreaView,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMediaLibraryContext } from '@/contexts/MediaLibraryContext';
import { useTrash } from '@/contexts/TrashContext';
import { useFilter } from '@/contexts/FilterContext';
import { useSwipeSession } from '@/hooks/useSwipeSession';
import { useRandomPhotos } from '@/hooks/useRandomPhotos';
import { SwipeCard } from '@/components/SwipeCard';

export default function RandomSessionScreen() {
  const { count } = useLocalSearchParams<{ count: string }>();
  const n = Math.max(1, parseInt(count ?? '15', 10));

  const { photoGroups, kindMap } = useMediaLibraryContext();
  const { addToTrash, removeFromTrash } = useTrash();
  const { enabledKinds } = useFilter();
  const { width: W, height: H } = useWindowDimensions();

  // Sampled once on mount — stable for the duration of the session
  const sampledAssets = useRandomPhotos(photoGroups, kindMap, enabledKinds, n);
  const session = useSwipeSession(sampledAssets);

  // Track how many deletions happened in this session for the completion UI
  const [deletedCount, setDeletedCount] = useState(0);

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
          <Text style={styles.headerTitle}>Random Mix</Text>
          <Text style={styles.headerSub}>{n} photos · all months</Text>
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
            style={[
              styles.actionBtn,
              styles.undoBtn,
              !session.canUndo && styles.disabledBtn,
            ]}
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

// ─── Completion sub-component ──────────────────────────────────────────────

interface CompletionViewProps {
  deletedCount: number;
  total: number;
  onReviewTrash: () => void;
  onHome: () => void;
}

function CompletionView({ deletedCount, total, onReviewTrash, onHome }: CompletionViewProps) {
  const kept = total - deletedCount;
  return (
    <View style={styles.doneBox}>
      <Text style={styles.doneCheck}>✓</Text>
      <Text style={styles.doneTitle}>Session Complete!</Text>
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

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: { color: '#6C63FF', fontSize: 17, fontWeight: '600', minWidth: 60 },
  headerCenter: { alignItems: 'center' },
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
  progressFill: {
    height: '100%',
    backgroundColor: '#6C63FF',
    borderRadius: 2,
  },

  cardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backCard: {
    position: 'absolute',
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    transform: [{ scale: 0.95 }, { translateY: 12 }],
  },

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
  doneTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 8 },
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

  secondaryBtn: {
    paddingVertical: 12,
  },
  secondaryBtnText: { color: '#666', fontSize: 15 },
});
