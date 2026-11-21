import { useState } from 'react';
import {
  FlatList,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useMediaLibraryContext } from '@/contexts/MediaLibraryContext';
import { useFilter } from '@/contexts/FilterContext';
import { QuickCleanModal } from '@/components/QuickCleanModal';
import { DateRangeModal } from '@/components/DateRangeModal';
import { SizeSortModal } from '@/components/SizeSortModal';
import type { MediaKind, PhotoGroup } from '@/types';

const GAP = 10;

const KIND_CONFIG: { kind: MediaKind; label: string; icon: string }[] = [
  { kind: 'photo',      label: 'Photos',      icon: '📷' },
  { kind: 'video',      label: 'Videos',      icon: '🎥' },
  { kind: 'screenshot', label: 'Screenshots', icon: '📸' },
];

export default function MonthPickerScreen() {
  const {
    permissionStatus,
    requestPermission,
    photoGroups,
    totalCount,
    isLoading,
    error,
  } = useMediaLibraryContext();

  const { toggle, isEnabled } = useFilter();
  const [modalVisible, setModalVisible] = useState(false);
  const [dateRangeVisible, setDateRangeVisible] = useState(false);
  const [sizeSortVisible, setSizeSortVisible] = useState(false);

  const handleStartRandom = (count: number) => {
    setModalVisible(false);
    router.push({ pathname: '/random', params: { count: String(count) } });
  };

  const handleStartDateRange = (startMs: number, endMs: number, shuffled: boolean, batchLimit: number) => {
    setDateRangeVisible(false);
    router.push({
      pathname: '/swipe/daterange',
      params: {
        startMs: String(startMs),
        endMs: String(endMs),
        shuffled: String(shuffled),
        batchLimit: String(batchLimit),
      },
    });
  };

  const handleStartSizeSort = (batchLimit: number) => {
    setSizeSortVisible(false);
    router.push({
      pathname: '/swipe/sizeSort',
      params: { batchLimit: String(batchLimit) },
    });
  };

  // ── Permission / loading gates ─────────────────────────────────────────

  if (
    permissionStatus === null ||
    (permissionStatus === 'granted' && isLoading && photoGroups.length === 0)
  ) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6C63FF" />
        {permissionStatus === 'granted' && (
          <Text style={styles.loadingText}>Indexing library…</Text>
        )}
      </View>
    );
  }

  if (permissionStatus !== 'granted') {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.appTitle}>SwipeClean</Text>
        <Text style={styles.appSubtitle}>
          Clean up your camera roll,{'\n'}one swipe at a time.
        </Text>
        <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
          <Text style={styles.grantBtnText}>Grant Photo Access</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // ── List header (rendered above the grid) ─────────────────────────────

  const listHeader = (
    <View>
      {/* Top header */}
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Your Library</Text>
        <Text style={styles.subheading}>{totalCount.toLocaleString()} items</Text>
      </View>

      {/* Quick Random Clean */}
      <TouchableOpacity
        style={styles.randomCard}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.82}
      >
        <View style={styles.randomCardLeft}>
          <Text style={styles.randomCardIcon}>⚡</Text>
          <View>
            <Text style={styles.randomCardTitle}>Quick Random Clean</Text>
            <Text style={styles.randomCardSub}>
              Swipe through a random mix across all months
            </Text>
          </View>
        </View>
        <Text style={styles.randomCardArrow}>›</Text>
      </TouchableOpacity>

      {/* Date Range Cleanup */}
      <TouchableOpacity
        style={styles.dateRangeCard}
        onPress={() => setDateRangeVisible(true)}
        activeOpacity={0.82}
      >
        <View style={styles.randomCardLeft}>
          <Text style={styles.randomCardIcon}>📅</Text>
          <View>
            <Text style={styles.randomCardTitle}>Date Range Cleanup</Text>
            <Text style={styles.randomCardSub}>
              Target a semester, trip, or any custom window
            </Text>
          </View>
        </View>
        <Text style={styles.randomCardArrow}>›</Text>
      </TouchableOpacity>

      {/* Size Sort */}
      <TouchableOpacity
        style={styles.sizeSortCard}
        onPress={() => setSizeSortVisible(true)}
        activeOpacity={0.82}
      >
        <View style={styles.randomCardLeft}>
          <Text style={styles.randomCardIcon}>⚖️</Text>
          <View>
            <Text style={styles.randomCardTitle}>Size Sort</Text>
            <Text style={styles.randomCardSub}>
              Tackle your biggest storage hogs first
            </Text>
          </View>
        </View>
        <Text style={styles.sizeSortArrow}>›</Text>
      </TouchableOpacity>

      {/* Media type filter toggles */}
      <View style={styles.filterRow}>
        {KIND_CONFIG.map(({ kind, label, icon }) => {
          const active = isEnabled(kind);
          return (
            <TouchableOpacity
              key={kind}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => toggle(kind)}
              activeOpacity={0.75}
            >
              <Text style={styles.filterChipIcon}>{icon}</Text>
              <Text style={[styles.filterChipLabel, active && styles.filterChipLabelActive]}>
                {label}
              </Text>
              {active && <View style={styles.filterDot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Browse by Month</Text>
    </View>
  );

  return (
    <>
      <SafeAreaView style={styles.container}>
        <FlatList<PhotoGroup>
          data={photoGroups}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          ListHeaderComponent={listHeader}
          renderItem={({ item }) => {
            // Count of items visible under current filter
            const visibleCount = KIND_CONFIG.reduce(
              (sum, { kind }) => sum + (isEnabled(kind) ? item.kindCounts[kind] : 0),
              0
            );
            if (visibleCount === 0) return null; // hide months with nothing to show

            return (
              <TouchableOpacity
                style={styles.monthCard}
                activeOpacity={0.82}
                onPress={() => router.push(`/swipe/${item.id}`)}
              >
                <Image
                  source={{ uri: item.coverAsset.uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  recyclingKey={item.id}
                />
                <View style={styles.cardOverlay}>
                  <Text style={styles.monthLabel}>{item.label}</Text>
                  <Text style={styles.photoCount}>{visibleCount} items</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>

      <QuickCleanModal
        visible={modalVisible}
        totalPhotos={totalCount}
        onClose={() => setModalVisible(false)}
        onStart={handleStartRandom}
      />

      <DateRangeModal
        visible={dateRangeVisible}
        onClose={() => setDateRangeVisible(false)}
        onStart={handleStartDateRange}
      />

      <SizeSortModal
        visible={sizeSortVisible}
        onClose={() => setSizeSortVisible(false)}
        onStart={handleStartSizeSort}
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0f0f0f',
  },
  container: { flex: 1, backgroundColor: '#0f0f0f' },

  appTitle: { fontSize: 40, fontWeight: '800', color: '#fff', letterSpacing: -1, marginBottom: 10 },
  appSubtitle: { fontSize: 17, color: '#888', textAlign: 'center', lineHeight: 26, marginBottom: 48 },
  grantBtn: { backgroundColor: '#6C63FF', paddingVertical: 18, paddingHorizontal: 44, borderRadius: 18 },
  grantBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  loadingText: { color: '#666', fontSize: 15, marginTop: 16 },
  errorText: { color: '#f87171', fontSize: 15, textAlign: 'center' },

  headerRow: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 },
  heading: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subheading: { color: '#888', fontSize: 14, marginTop: 3 },

  randomCard: {
    marginHorizontal: 8,
    marginBottom: 10,
    backgroundColor: '#1a1a2e',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#6C63FF44',
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateRangeCard: {
    marginHorizontal: 8,
    marginBottom: 10,
    backgroundColor: '#0f1f1a',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#34d39944',
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sizeSortCard: {
    marginHorizontal: 8,
    marginBottom: 16,
    backgroundColor: '#1a120a',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#f59e0b44',
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sizeSortArrow: { color: '#f59e0b', fontSize: 24, fontWeight: '300', marginLeft: 8 },
  randomCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  randomCardIcon: { fontSize: 28 },
  randomCardTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 3 },
  randomCardSub: { color: '#888', fontSize: 12, lineHeight: 17 },
  randomCardArrow: { color: '#6C63FF', fontSize: 24, fontWeight: '300', marginLeft: 8 },

  // Filter toggles
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
  },
  filterChipActive: {
    borderColor: '#6C63FF',
    backgroundColor: '#1a1a2e',
  },
  filterChipIcon: { fontSize: 14 },
  filterChipLabel: { color: '#666', fontSize: 12, fontWeight: '600' },
  filterChipLabelActive: { color: '#fff' },
  filterDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#6C63FF',
  },

  sectionLabel: {
    color: '#555',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 10,
  },

  grid: { padding: 8 },
  row: { gap: GAP, marginBottom: GAP },
  monthCard: { flex: 1, height: 155, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1a1a1a' },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  monthLabel: { color: '#fff', fontSize: 13, fontWeight: '700' },
  photoCount: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 },
});
