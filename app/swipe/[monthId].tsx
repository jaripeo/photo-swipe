import { useMemo } from 'react';
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
import { SwipeCard } from '@/components/SwipeCard';

export default function SwipeScreen() {
  const { monthId } = useLocalSearchParams<{ monthId: string }>();
  const { photoGroups, kindMap } = useMediaLibraryContext();
  const { addToTrash, removeFromTrash } = useTrash();
  const { enabledKinds } = useFilter();
  const { width: W, height: H } = useWindowDimensions();

  const group = photoGroups.find((g) => g.id === monthId);

  // Apply the active media-type filter to this month's assets
  const filteredAssets = useMemo(() => {
    if (!group) return [];
    return group.assets.filter((a) => enabledKinds.has(kindMap.get(a.id) ?? 'photo'));
  }, [group, kindMap, enabledKinds]);

  const session = useSwipeSession(filteredAssets);

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
  };

  const handleUndo = () => {
    const undone = session.undo();
    if (!undone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (undone.decision === 'delete') removeFromTrash(undone.asset.id);
  };

  if (!group) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Month not found</Text>
      </View>
    );
  }

  if (filteredAssets.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={16}>
            <Text style={styles.backBtn}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{group.label}</Text>
          <View style={{ minWidth: 60 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>Nothing to show</Text>
          <Text style={styles.emptySub}>
            No items match your current filter in {group.label}.{'\n'}
            Adjust the filters on the home screen and try again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { done, total } = session.progress;
  const progressPct = total > 0 ? done / total : 0;
  const CARD_W = W - 32;
  const CARD_H = H * 0.66;

  const currentKind = session.currentAsset ? (kindMap.get(session.currentAsset.id) ?? 'photo') : 'photo';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={16}>
          <Text style={styles.backBtn}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{group.label}</Text>
        <Text style={styles.counter}>{done}/{total}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPct * 100}%` as `${number}%` }]} />
      </View>

      {/* Card area */}
      <View style={styles.cardArea}>
        {session.isComplete ? (
          <View style={styles.doneBox}>
            <Text style={styles.doneCheck}>✓</Text>
            <Text style={styles.doneTitle}>Done with {group.label}!</Text>
            <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
              <Text style={styles.doneBtnText}>Back to months</Text>
            </TouchableOpacity>
          </View>
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
                kind={currentKind}
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
          <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={handleSwipeLeft} activeOpacity={0.75}>
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
          <TouchableOpacity style={[styles.actionBtn, styles.keepBtn]} onPress={handleSwipeRight} activeOpacity={0.75}>
            <Text style={styles.actionIcon}>✓</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f0f0f', padding: 24 },
  errorText: { color: '#888', fontSize: 16 },

  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 10 },
  emptySub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: { color: '#6C63FF', fontSize: 17, fontWeight: '600', minWidth: 60 },
  monthTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  counter: { color: '#888', fontSize: 14, minWidth: 60, textAlign: 'right' },

  progressTrack: {
    height: 3, backgroundColor: '#222', marginHorizontal: 20,
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#6C63FF', borderRadius: 2 },

  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backCard: {
    position: 'absolute', borderRadius: 22, overflow: 'hidden',
    backgroundColor: '#1a1a1a', transform: [{ scale: 0.95 }, { translateY: 12 }],
  },

  doneBox: { alignItems: 'center', paddingHorizontal: 32 },
  doneCheck: { fontSize: 64, color: '#4ade80', marginBottom: 12 },
  doneTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 32 },
  doneBtn: { backgroundColor: '#6C63FF', paddingVertical: 16, paddingHorizontal: 40, borderRadius: 16 },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  actions: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 20, paddingVertical: 24,
  },
  actionBtn: {
    width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  deleteBtn: { backgroundColor: '#1a1a1a', borderWidth: 2.5, borderColor: '#f87171' },
  undoBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: '#555' },
  keepBtn: { backgroundColor: '#1a1a1a', borderWidth: 2.5, borderColor: '#4ade80' },
  disabledBtn: { opacity: 0.25 },
  actionIcon: { fontSize: 22, color: '#fff', fontWeight: '700' },
});
