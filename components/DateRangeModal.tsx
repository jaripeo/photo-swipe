import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMediaLibraryContext } from '@/contexts/MediaLibraryContext';
import { useFilter } from '@/contexts/FilterContext';

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function toMs(creationTime: number): number {
  return creationTime < 1_000_000_000_000 ? creationTime * 1000 : creationTime;
}

interface MonthYear {
  year: number;
  month: number; // 0-indexed, matches JS Date.getMonth()
}

function asOrdinal(my: MonthYear): number {
  return my.year * 12 + my.month;
}

function addMonths(my: MonthYear, delta: number): MonthYear {
  const total = asOrdinal(my) + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

function clampMY(my: MonthYear, min: MonthYear, max: MonthYear): MonthYear {
  const n = asOrdinal(my);
  if (n < asOrdinal(min)) return min;
  if (n > asOrdinal(max)) return max;
  return my;
}

// 0 is the sentinel for "no limit"
const BATCH_OPTIONS: { label: string; value: number }[] = [
  { label: '15', value: 15 },
  { label: '30', value: 30 },
  { label: '50', value: 50 },
  { label: 'All', value: 0 },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onStart: (startMs: number, endMs: number, shuffled: boolean, batchLimit: number) => void;
}

export function DateRangeModal({ visible, onClose, onStart }: Props) {
  const { photoGroups, kindMap } = useMediaLibraryContext();
  const { enabledKinds } = useFilter();

  // Earliest and latest months present in the library.
  const [minMY, maxMY] = useMemo((): [MonthYear, MonthYear] => {
    if (photoGroups.length === 0) {
      const now = new Date();
      const my: MonthYear = { year: now.getFullYear(), month: now.getMonth() };
      return [my, my];
    }
    // photoGroups is sorted newest-first
    const newest = photoGroups[0];
    const oldest = photoGroups[photoGroups.length - 1];
    return [
      { year: oldest.year, month: oldest.month },
      { year: newest.year, month: newest.month },
    ];
  }, [photoGroups]);

  const [start, setStart] = useState<MonthYear>(() => clampMY(addMonths(maxMY, -5), minMY, maxMY));
  const [end, setEnd] = useState<MonthYear>(maxMY);
  const [shuffled, setShuffled] = useState(false);
  const [batchLimit, setBatchLimit] = useState(15);

  // Seed defaults the first time the library finishes loading.
  const seeded = useRef(false);
  useEffect(() => {
    if (photoGroups.length > 0 && !seeded.current) {
      seeded.current = true;
      setEnd(maxMY);
      setStart(clampMY(addMonths(maxMY, -5), minMY, maxMY));
    }
  }, [photoGroups.length, maxMY, minMY]);

  // Count assets that fall within [start, end] under the current kind filter.
  const matchCount = useMemo(() => {
    const startMs = new Date(start.year, start.month, 1).getTime();
    const endMs = new Date(end.year, end.month + 1, 1).getTime() - 1;
    let count = 0;
    for (const g of photoGroups) {
      for (const a of g.assets) {
        const ms = toMs(a.creationTime);
        if (ms >= startMs && ms <= endMs && enabledKinds.has(kindMap.get(a.id) ?? 'photo')) {
          count++;
        }
      }
    }
    return count;
  }, [photoGroups, kindMap, enabledKinds, start, end]);

  const validRange = asOrdinal(start) <= asOrdinal(end);
  const canStart = validRange && matchCount > 0;

  function nudgeStart(delta: number) {
    setStart((prev) => {
      const next = clampMY(addMonths(prev, delta), minMY, maxMY);
      // Don't let start cross end
      return asOrdinal(next) <= asOrdinal(end) ? next : prev;
    });
  }

  function nudgeEnd(delta: number) {
    setEnd((prev) => {
      const next = clampMY(addMonths(prev, delta), minMY, maxMY);
      // Don't let end cross start
      return asOrdinal(next) >= asOrdinal(start) ? next : prev;
    });
  }

  function handleStart() {
    const startMs = new Date(start.year, start.month, 1).getTime();
    const endMs = new Date(end.year, end.month + 1, 1).getTime() - 1;
    onStart(startMs, endMs, shuffled, batchLimit);
  }

  // Effective session size shown to the user — respects the batch cap.
  const sessionCount =
    batchLimit === 0 ? matchCount : Math.min(matchCount, batchLimit);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.handle} />

        <Text style={styles.title}>📅  Date Range Cleanup</Text>
        <Text style={styles.subtitle}>
          Pick a time window and swipe through everything inside it — a semester, a trip, a year.
        </Text>

        {/* ── Start month picker ───────────────────────────── */}
        <View style={styles.pickerRow}>
          <Text style={styles.pickerLabel}>From</Text>
          <View style={styles.pickerControl}>
            <TouchableOpacity
              onPress={() => nudgeStart(-1)}
              hitSlop={14}
              style={styles.chevronBtn}
            >
              <Text style={styles.chevron}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthText}>
              {MONTH_NAMES_SHORT[start.month]}  {start.year}
            </Text>
            <TouchableOpacity
              onPress={() => nudgeStart(1)}
              hitSlop={14}
              style={styles.chevronBtn}
            >
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── End month picker ─────────────────────────────── */}
        <View style={styles.pickerRow}>
          <Text style={styles.pickerLabel}>To</Text>
          <View style={styles.pickerControl}>
            <TouchableOpacity
              onPress={() => nudgeEnd(-1)}
              hitSlop={14}
              style={styles.chevronBtn}
            >
              <Text style={styles.chevron}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthText}>
              {MONTH_NAMES_SHORT[end.month]}  {end.year}
            </Text>
            <TouchableOpacity
              onPress={() => nudgeEnd(1)}
              hitSlop={14}
              style={styles.chevronBtn}
            >
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Batch limit chips ─────────────────────────────── */}
        <View style={styles.batchRow}>
          <Text style={styles.batchLabel}>Batch Limit</Text>
          <View style={styles.batchChips}>
            {BATCH_OPTIONS.map(({ label, value }) => {
              const active = batchLimit === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.batchChip, active && styles.batchChipActive]}
                  onPress={() => setBatchLimit(value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.batchChipText, active && styles.batchChipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Match count badge ─────────────────────────────── */}
        <View style={styles.countBadge}>
          <Text style={[styles.countText, matchCount === 0 && styles.countTextEmpty]}>
            {matchCount === 0
              ? 'No items match this range'
              : batchLimit === 0 || matchCount <= batchLimit
              ? `${matchCount.toLocaleString()} item${matchCount === 1 ? '' : 's'} in range`
              : `${sessionCount} of ${matchCount.toLocaleString()} items`}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* ── Order toggle ──────────────────────────────────── */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextWrap}>
            <Text style={styles.toggleLabel}>Shuffle Order</Text>
            <Text style={styles.toggleSub}>
              {shuffled ? 'Cards served randomly' : 'Oldest to newest'}
            </Text>
          </View>
          <Switch
            value={shuffled}
            onValueChange={setShuffled}
            trackColor={{ false: '#2a2a2a', true: '#6C63FF' }}
            thumbColor={shuffled ? '#d4d0ff' : '#888'}
          />
        </View>

        {/* ── Start button ──────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
          onPress={handleStart}
          disabled={!canStart}
          activeOpacity={0.85}
        >
          <Text style={styles.startBtnText}>
            {canStart ? 'Start Session  →' : 'No items to show'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    backgroundColor: '#2a2a2a',
    borderRadius: 2,
    marginBottom: 30,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    color: '#666',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 32,
  },

  // ── Month pickers ──────────────────────────────────────────
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  pickerLabel: {
    color: '#777',
    fontSize: 13,
    fontWeight: '600',
    width: 34,
  },
  pickerControl: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  chevronBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    color: '#6C63FF',
    fontSize: 26,
    lineHeight: 30,
  },
  monthText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 100,
  },

  // ── Batch limit ────────────────────────────────────────────
  batchRow: {
    marginBottom: 18,
  },
  batchLabel: {
    color: '#777',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  batchChips: {
    flexDirection: 'row',
    gap: 8,
  },
  batchChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
  },
  batchChipActive: {
    backgroundColor: '#1a1a2e',
    borderColor: '#6C63FF',
  },
  batchChipText: {
    color: '#555',
    fontSize: 13,
    fontWeight: '700',
  },
  batchChipTextActive: {
    color: '#a78bfa',
  },

  // ── Count badge ────────────────────────────────────────────
  countBadge: {
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 28,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#6C63FF33',
  },
  countText: {
    color: '#a78bfa',
    fontSize: 13,
    fontWeight: '600',
  },
  countTextEmpty: {
    color: '#555',
  },

  divider: {
    height: 1,
    backgroundColor: '#1e1e1e',
    marginBottom: 22,
  },

  // ── Toggle ─────────────────────────────────────────────────
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 36,
  },
  toggleTextWrap: { flex: 1, marginRight: 16 },
  toggleLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  toggleSub: {
    color: '#555',
    fontSize: 12,
  },

  // ── Buttons ────────────────────────────────────────────────
  startBtn: {
    backgroundColor: '#6C63FF',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  startBtnDisabled: {
    backgroundColor: '#1e1e1e',
  },
  startBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelText: {
    color: '#444',
    fontSize: 15,
  },
});
