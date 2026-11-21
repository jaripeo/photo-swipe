import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import * as MediaLibrary from 'expo-media-library/legacy';
import type { MediaKind } from '@/types';
import { ZoomableImageModal } from '@/components/ZoomableImageModal';

const SCRUBBER_PADDING = 14;
const THUMB_RADIUS = 7;

function formatFileSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${Math.round(bytes / 1_048_576)} MB`;
  if (bytes >= 1_024) return `${Math.round(bytes / 1_024)} KB`;
  return `${bytes} B`;
}

function formatDate(creationTime: number): string {
  const ms = creationTime < 1_000_000_000_000 ? creationTime * 1000 : creationTime;
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Standalone video player (no card gesture to block) ──────────────────────

function VideoPreview({ uri }: { uri: string }) {
  const [muted, setMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const isScrubbingRef = useRef(false);
  const isFullscreenRef = useRef(false);
  const videoViewRef = useRef<VideoView>(null);
  const trackWidthSv = useSharedValue(1);
  const durationSv = useSharedValue(0);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.timeUpdateEventInterval = 0.1;
    p.play();
  });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    const timeSub = player.addListener('timeUpdate', ({ currentTime: t }) => {
      if (!isScrubbingRef.current) setCurrentTime(t);
    });
    const sourceSub = player.addListener('sourceLoad', ({ duration: d }) => {
      setDuration(d);
      durationSv.value = d;
    });
    const playingSub = player.addListener('playingChange', ({ isPlaying: p }) => {
      setIsPlaying(p);
    });
    const endSub = player.addListener('playToEnd', () => {
      if (isFullscreenRef.current) videoViewRef.current?.exitFullscreen();
    });

    if (player.duration > 0) {
      setDuration(player.duration);
      durationSv.value = player.duration;
    }
    setIsPlaying(player.playing);

    return () => {
      timeSub.remove();
      sourceSub.remove();
      playingSub.remove();
      endSub.remove();
    };
  }, [player, durationSv]);

  useEffect(() => {
    return () => {
      try { player.pause(); } catch { /* already released */ }
    };
  }, [player]);

  const togglePlayPause = useCallback(() => {
    if (player.playing) player.pause();
    else player.play();
  }, [player]);

  const handleFullscreenEnter = useCallback(() => {
    isFullscreenRef.current = true;
    setIsFullscreen(true);
  }, []);

  const handleFullscreenExit = useCallback(() => {
    isFullscreenRef.current = false;
    setIsFullscreen(false);
  }, []);

  const enterFullscreen = useCallback(async () => {
    isFullscreenRef.current = true;
    setIsFullscreen(true);
    try {
      await videoViewRef.current?.enterFullscreen();
    } catch {
      isFullscreenRef.current = false;
      setIsFullscreen(false);
    }
  }, []);

  const handleSeek = useCallback((time: number) => {
    player.currentTime = time;
    setCurrentTime(time);
  }, [player]);

  const handleScrubStart = useCallback(() => {
    isScrubbingRef.current = true;
    player.pause();
  }, [player]);

  const handleScrubEnd = useCallback(() => {
    isScrubbingRef.current = false;
    player.play();
  }, [player]);

  // No .blocksExternalGesture() — the modal has no parent pan gesture to block.
  const scrubberGesture = useMemo(() =>
    Gesture.Pan()
      .minDistance(2)
      .runOnJS(true)
      .onStart((e) => {
        const w = trackWidthSv.value;
        const x = Math.max(0, Math.min(w, e.x - SCRUBBER_PADDING));
        handleScrubStart();
        handleSeek(durationSv.value > 0 ? (x / w) * durationSv.value : 0);
      })
      .onUpdate((e) => {
        const w = trackWidthSv.value;
        const x = Math.max(0, Math.min(w, e.x - SCRUBBER_PADDING));
        handleSeek(durationSv.value > 0 ? (x / w) * durationSv.value : 0);
      })
      .onEnd(() => handleScrubEnd()),
    [trackWidthSv, durationSv, handleSeek, handleScrubStart, handleScrubEnd]
  );

  const progress = duration > 0 ? currentTime / duration : 0;
  const fillPct = `${Math.round(progress * 100)}%` as `${number}%`;

  return (
    <>
      <VideoView
        ref={videoViewRef}
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={isFullscreen}
        onFullscreenEnter={handleFullscreenEnter}
        onFullscreenExit={handleFullscreenExit}
      />

      <TouchableOpacity
        style={[StyleSheet.absoluteFill, styles.playPauseArea]}
        onPress={togglePlayPause}
        activeOpacity={1}
      >
        {!isPlaying && (
          <View style={styles.playIconCircle}>
            <Text style={styles.playIconText}>▶</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Fullscreen toggle — top-right */}
      <TouchableOpacity
        style={styles.fullscreenBtn}
        onPress={enterFullscreen}
        hitSlop={12}
        activeOpacity={0.7}
      >
        <View style={styles.expandIconWrap}>
          <View style={[styles.corner, { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 }]} />
          <View style={[styles.corner, { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 }]} />
          <View style={[styles.corner, { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 }]} />
          <View style={[styles.corner, { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 }]} />
        </View>
      </TouchableOpacity>

      {/* Scrubber */}
      <GestureDetector gesture={scrubberGesture}>
        <View
          style={styles.scrubberContainer}
          onLayout={(e) => {
            trackWidthSv.value = Math.max(1, e.nativeEvent.layout.width - SCRUBBER_PADDING * 2);
          }}
        >
          <View style={styles.scrubberTimes}>
            <Text style={styles.scrubberTimeText}>{formatDuration(currentTime)}</Text>
            <Text style={styles.scrubberTimeText}>{formatDuration(duration)}</Text>
          </View>
          <View style={styles.scrubberTrack}>
            <View style={[styles.scrubberFill, { width: fillPct }]} />
            <View style={[styles.scrubberThumb, { left: fillPct }]} />
          </View>
        </View>
      </GestureDetector>

      {/* Mute toggle */}
      <TouchableOpacity
        style={styles.muteBtn}
        onPress={() => setMuted((m) => !m)}
        hitSlop={16}
        activeOpacity={0.7}
      >
        <Text style={styles.muteIcon}>{muted ? '🔇' : '🔊'}</Text>
      </TouchableOpacity>
    </>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface Props {
  asset: MediaLibrary.Asset | null;
  kind: MediaKind;
  fileSize: number;
  visible: boolean;
  onClose: () => void;
  onDeleteSuccess: (assetId: string) => void;
}

export function SizeSortPreviewModal({
  asset,
  kind,
  fileSize,
  visible,
  onClose,
  onDeleteSuccess,
}: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [zoomVisible, setZoomVisible] = useState(false);

  // Reset deleting state when a new asset is selected
  useEffect(() => {
    if (visible) setIsDeleting(false);
  }, [visible, asset?.id]);

  const handleDelete = async () => {
    if (!asset || isDeleting) return;
    setIsDeleting(true);
    try {
      await MediaLibrary.deleteAssetsAsync([asset]);
      onDeleteSuccess(asset.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('3072')) {
        // Not a user cancellation — surface the error
        Alert.alert('Delete Failed', 'Could not delete this item. Please try again.');
      }
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.container}>

        {/* ── Header ─────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>✕  Close</Text>
          </TouchableOpacity>
          {asset && (
            <View style={styles.metaBadge}>
              <Text style={styles.metaText} numberOfLines={1}>
                {formatFileSize(fileSize)}  ·  {formatDate(asset.creationTime)}
              </Text>
            </View>
          )}
        </View>

        {/* ── Media area ─────────────────────────────────────── */}
        <View style={styles.mediaArea}>
          {asset && kind === 'video' ? (
            <VideoPreview uri={asset.uri} />
          ) : asset ? (
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => setZoomVisible(true)}
              activeOpacity={1}
              accessibilityRole="imagebutton"
              accessibilityLabel="Open image and zoom"
            >
              <Image
                source={{ uri: asset.uri }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                recyclingKey={asset.id}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ── Delete action ───────────────────────────────────── */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.deleteBtn, isDeleting && styles.deleteBtnLoading]}
            onPress={handleDelete}
            disabled={isDeleting}
            activeOpacity={0.8}
          >
            {isDeleting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.deleteBtnText}>🗑️  Delete Asset</Text>
            )}
          </TouchableOpacity>
        </View>

      </SafeAreaView>

      {asset && kind !== 'video' && (
        <ZoomableImageModal
          uri={asset.uri}
          visible={zoomVisible}
          onClose={() => setZoomVisible(false)}
        />
      )}
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  closeBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  metaBadge: {
    flex: 1,
    alignItems: 'flex-end',
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  metaText: { color: '#fbbf24', fontSize: 13, fontWeight: '600' },

  // ── Media area ──
  mediaArea: {
    flex: 1,
    backgroundColor: '#000',
  },

  // ── Video controls ──
  playPauseArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIconText: { color: '#fff', fontSize: 26, marginLeft: 4 },

  fullscreenBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandIconWrap: { width: 18, height: 18 },
  corner: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderColor: '#fff',
  },

  muteBtn: {
    position: 'absolute',
    bottom: 66,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteIcon: { fontSize: 18 },

  scrubberContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: SCRUBBER_PADDING,
    paddingTop: 10,
    paddingBottom: 12,
  },
  scrubberTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  scrubberTimeText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
  },
  scrubberTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
  },
  scrubberFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  scrubberThumb: {
    position: 'absolute',
    top: -(THUMB_RADIUS - 1.5),
    width: THUMB_RADIUS * 2,
    height: THUMB_RADIUS * 2,
    borderRadius: THUMB_RADIUS,
    backgroundColor: '#fff',
    transform: [{ translateX: -THUMB_RADIUS }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
  },

  // ── Action bar ──
  actionBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#0f0f0f',
  },
  deleteBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  deleteBtnLoading: { opacity: 0.6 },
  deleteBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
