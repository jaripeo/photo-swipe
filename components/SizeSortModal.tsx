import { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMediaLibraryContext } from '@/contexts/MediaLibraryContext';

const BATCH_OPTIONS: { label: string; value: number }[] = [
  { label: '15', value: 15 },
  { label: '30', value: 30 },
  { label: '50', value: 50 },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onStart: (batchLimit: number) => void;
}

export function SizeSortModal({ visible, onClose, onStart }: Props) {
  const { totalCount } = useMediaLibraryContext();
  const [batchLimit, setBatchLimit] = useState(15);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.handle} />

        <Text style={styles.title}>⚖️  Size Sort</Text>
        <Text style={styles.subtitle}>
          Tackle your biggest storage hogs first. The heaviest files load at the top of the card stack.
        </Text>

        {/* ── Batch limit chips ─────────────────────────────── */}
        <View style={styles.batchRow}>
          <Text style={styles.batchLabel}>Items to Review</Text>
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

        {/* ── Library count badge ───────────────────────────── */}
        <View style={styles.infoBadge}>
          <Text style={styles.infoText}>
            Scanning top {batchLimit} of {totalCount.toLocaleString()} items
          </Text>
        </View>

        <Text style={styles.note}>
          File sizes are fetched on-demand — expect a brief loading moment before your first card appears.
        </Text>

        {/* ── Start button ──────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.startBtn, totalCount === 0 && styles.startBtnDisabled]}
          onPress={() => onStart(batchLimit)}
          disabled={totalCount === 0}
          activeOpacity={0.85}
        >
          <Text style={styles.startBtnText}>
            {totalCount > 0 ? 'Start Session  →' : 'Library loading…'}
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

  // ── Batch chips ────────────────────────────────────────────
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
    backgroundColor: '#1f1a0a',
    borderColor: '#f59e0b',
  },
  batchChipText: {
    color: '#555',
    fontSize: 13,
    fontWeight: '700',
  },
  batchChipTextActive: {
    color: '#fbbf24',
  },

  // ── Info badge ─────────────────────────────────────────────
  infoBadge: {
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 20,
    backgroundColor: '#1f1a0a',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#f59e0b33',
  },
  infoText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '600',
  },

  note: {
    color: '#444',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 36,
  },

  // ── Buttons ────────────────────────────────────────────────
  startBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  startBtnDisabled: {
    backgroundColor: '#1e1e1e',
  },
  startBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
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
