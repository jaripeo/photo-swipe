import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';

const MIN = 5;
const MAX = 50;
const DEFAULT = 15;
const PRESETS = [10, 15, 25, 50] as const;

interface Props {
  visible: boolean;
  totalPhotos: number;
  onClose: () => void;
  onStart: (count: number) => void;
}

export function QuickCleanModal({ visible, totalPhotos, onClose, onStart }: Props) {
  const [count, setCount] = useState(DEFAULT);

  const clamp = (n: number) => Math.max(MIN, Math.min(MAX, Math.min(n, totalPhotos)));

  const adjust = (delta: number) => setCount((c) => clamp(c + delta));

  const handleStart = () => {
    onStart(clamp(count));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Tap outside to dismiss */}
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <Text style={styles.title}>Quick Random Clean</Text>
          <Text style={styles.subtitle}>
            Randomly pick photos across your entire library to swipe through.
          </Text>

          {/* Preset chips */}
          <View style={styles.presetRow}>
            {PRESETS.map((p) => {
              const active = count === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setCount(clamp(p))}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Fine-tune stepper */}
          <View style={styles.stepper}>
            <TouchableOpacity
              style={[styles.stepBtn, count <= MIN && styles.stepBtnDisabled]}
              onPress={() => adjust(-1)}
              disabled={count <= MIN}
              activeOpacity={0.7}
            >
              <Text style={styles.stepIcon}>−</Text>
            </TouchableOpacity>

            <View style={styles.stepValueWrap}>
              <Text style={styles.stepValue}>{count}</Text>
              <Text style={styles.stepLabel}>photos</Text>
            </View>

            <TouchableOpacity
              style={[styles.stepBtn, count >= Math.min(MAX, totalPhotos) && styles.stepBtnDisabled]}
              onPress={() => adjust(1)}
              disabled={count >= Math.min(MAX, totalPhotos)}
              activeOpacity={0.7}
            >
              <Text style={styles.stepIcon}>+</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            Drawn proportionally from all {totalPhotos.toLocaleString()} photos across every month
          </Text>

          {/* Actions */}
          <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
            <Text style={styles.startBtnText}>Start Session →</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#161616',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    marginBottom: 24,
  },

  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },

  presetRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 50,
    backgroundColor: '#222',
    borderWidth: 1.5,
    borderColor: '#333',
  },
  chipActive: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  chipText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginBottom: 16,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#222',
    borderWidth: 1.5,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.3,
  },
  stepIcon: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 26,
  },
  stepValueWrap: {
    alignItems: 'center',
    minWidth: 64,
  },
  stepValue: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 44,
  },
  stepLabel: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },

  hint: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 17,
  },

  startBtn: {
    width: '100%',
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  startBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cancelBtn: {
    paddingVertical: 8,
  },
  cancelText: {
    color: '#666',
    fontSize: 15,
  },
});
