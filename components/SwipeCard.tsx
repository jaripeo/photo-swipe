import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { GestureType } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { Asset } from 'expo-media-library/legacy';
import type { MediaKind } from '@/types';
import { useFavorites } from '@/contexts/FavoritesContext';
import { ZoomableImageModal } from '@/components/ZoomableImageModal';

const SNAP_SPRING = { damping: 18, stiffness: 150 };
const THUMB_RADIUS = 7;
const SCRUBBER_PADDING = 14;

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

function formatFileSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${Math.round(bytes / 1_048_576)} MB`;
  if (bytes >= 1_024) return `${Math.round(bytes / 1_024)} KB`;
  return `${bytes} B`;
}

// Four-corner expand icon for the fullscreen button.
function ExpandIcon() {
  return (
    <View style={styles.expandIconWrap}>
      <View style={[styles.corner, { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 }]} />
      <View style={[styles.corner, { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 }]} />
      <View style={[styles.corner, { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 }]} />
      <View style={[styles.corner, { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 }]} />
    </View>
  );
}

// ─── Video content (only mounted for the top card) ────────────────────────────

interface VideoContentProps {
  uri: string;
  cardGestureRef: React.MutableRefObject<GestureType | undefined>;
}

function VideoContent({ uri, cardGestureRef }: VideoContentProps) {
  const [muted, setMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const isScrubbingRef = useRef(false);
  // Ref mirror of isFullscreen for use inside event listener callbacks where
  // the React state closure would otherwise be stale.
  const isFullscreenRef = useRef(false);
  // Class-component ref — gives us access to enterFullscreen() / exitFullscreen().
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
    const playingSub = player.addListener('playingChange', ({ isPlaying: playing }) => {
      setIsPlaying(playing);
    });
    // Fallback: if the video reaches its end while the native fullscreen player
    // is open, dismiss it so the user isn't stuck. (With loop=true this only
    // fires if loop is disabled elsewhere.)
    const endSub = player.addListener('playToEnd', () => {
      if (isFullscreenRef.current) {
        videoViewRef.current?.exitFullscreen();
      }
    });

    // Seed values if the source was already loaded before this effect ran.
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

  // Read player.playing at call time so we never act on stale React state.
  const togglePlayPause = useCallback(() => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [player]);

  // Called by onFullscreenEnter (safety net) and by the button handler.
  const handleFullscreenEnter = useCallback(() => {
    isFullscreenRef.current = true;
    setIsFullscreen(true);
  }, []);

  // Called by onFullscreenExit — restores custom controls.
  const handleFullscreenExit = useCallback(() => {
    isFullscreenRef.current = false;
    setIsFullscreen(false);
  }, []);

  const enterFullscreen = useCallback(async () => {
    // Set nativeControls=true BEFORE the native player is presented.
    // React will commit the prop update during the ~300 ms iOS transition
    // animation, ensuring the "Done" button is visible when the player appears.
    isFullscreenRef.current = true;
    setIsFullscreen(true);
    try {
      await videoViewRef.current?.enterFullscreen();
    } catch {
      // Entry failed (e.g. unsupported device) — revert.
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

  const scrubberGesture = useMemo(() =>
    Gesture.Pan()
      .blocksExternalGesture(cardGestureRef)
      .minDistance(2)
      .runOnJS(true)
      .onStart((e) => {
        const w = trackWidthSv.value;
        const clampedX = Math.max(0, Math.min(w, e.x - SCRUBBER_PADDING));
        const newTime = durationSv.value > 0 ? (clampedX / w) * durationSv.value : 0;
        handleScrubStart();
        handleSeek(newTime);
      })
      .onUpdate((e) => {
        const w = trackWidthSv.value;
        const clampedX = Math.max(0, Math.min(w, e.x - SCRUBBER_PADDING));
        const newTime = durationSv.value > 0 ? (clampedX / w) * durationSv.value : 0;
        handleSeek(newTime);
      })
      .onEnd(() => {
        handleScrubEnd();
      }),
    [cardGestureRef, trackWidthSv, durationSv, handleSeek, handleScrubStart, handleScrubEnd]
  );

  const progress = duration > 0 ? currentTime / duration : 0;
  const fillPct = `${Math.round(progress * 100)}%` as `${number}%`;

  return (
    <>
      {/* nativeControls is false while inline (custom UI handles everything)
          and switches to true right before enterFullscreen() is called so iOS
          renders the native "Done" button inside the fullscreen player.
          onFullscreenEnter/Exit keep the state in sync for any other paths
          (e.g. the user force-rotating the device). */}
      <VideoView
        ref={videoViewRef}
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={isFullscreen}
        onFullscreenEnter={handleFullscreenEnter}
        onFullscreenExit={handleFullscreenExit}
      />

      {/* Tap-anywhere-on-video area for play/pause.
          Rendered before the scrubber and buttons so they sit on top of it. */}
      <TouchableOpacity
        style={styles.playPauseArea}
        onPress={togglePlayPause}
        activeOpacity={1}
      >
        {!isPlaying && (
          <View style={styles.playIconCircle}>
            <Text style={styles.playIconText}>▶</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Fullscreen button — top-right corner */}
      <TouchableOpacity
        style={styles.fullscreenBtn}
        onPress={enterFullscreen}
        hitSlop={12}
        activeOpacity={0.7}
      >
        <ExpandIcon />
      </TouchableOpacity>

      {/* Scrubber strip */}
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

// ─── Card ─────────────────────────────────────────────────────────────────────

interface Props {
  asset: Asset;
  kind: MediaKind;
  isTop: boolean;
  fileSizeMap?: Map<string, number>;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export function SwipeCard({ asset, kind, isTop, fileSizeMap, onSwipeLeft, onSwipeRight }: Props) {
  const { isFavorited, toggleFavorite } = useFavorites();
  const [zoomVisible, setZoomVisible] = useState(false);
  const { width: W, height: H } = useWindowDimensions();
  const THRESHOLD = W * 0.35;
  const CARD_W = W - 32;
  const CARD_H = H * 0.66;

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const cardGestureRef = useRef<GestureType | undefined>(undefined);

  const gesture = Gesture.Pan()
    .withRef(cardGestureRef)
    .enabled(isTop)
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY * 0.35;
    })
    .onEnd((e) => {
      const pastThreshold =
        Math.abs(e.translationX) > THRESHOLD || Math.abs(e.velocityX) > 900;

      if (pastThreshold) {
        const dir = e.translationX > 0 ? 1 : -1;
        const distLeft = Math.abs(dir * W * 1.6 - tx.value);
        const duration = Math.max(80, Math.min(200, distLeft * 0.25));
        tx.value = withTiming(
          dir * W * 1.6,
          { duration, easing: Easing.out(Easing.quad) },
          (finished) => {
            if (finished) {
              if (dir > 0 && onSwipeRight) runOnJS(onSwipeRight)();
              if (dir < 0 && onSwipeLeft) runOnJS(onSwipeLeft)();
            }
          }
        );
      } else {
        tx.value = withSpring(0, SNAP_SPRING);
        ty.value = withSpring(0, SNAP_SPRING);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(tx.value, [-W / 2, 0, W / 2], [-12, 0, 12], Extrapolation.CLAMP);
    return {
      transform: [
        { translateX: tx.value },
        { translateY: ty.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const keepStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [0, W * 0.22], [0, 1], Extrapolation.CLAMP),
  }));

  const deleteStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [-W * 0.22, 0], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.card, { width: CARD_W, height: CARD_H }, cardStyle]}>

        {kind === 'video' && isTop ? (
          <VideoContent uri={asset.uri} cardGestureRef={cardGestureRef} />
          ) : (
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => isTop && setZoomVisible(true)}
              activeOpacity={1}
              disabled={!isTop}
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
          )}

        <Animated.View style={[styles.label, styles.keepLabel, keepStyle]}>
          <Text style={styles.keepText}>KEEP</Text>
        </Animated.View>

        <Animated.View style={[styles.label, styles.deleteLabel, deleteStyle]}>
          <Text style={styles.deleteText}>DELETE</Text>
        </Animated.View>

        {/* Duration badge only on non-top video cards — top card uses the scrubber. */}
        {kind === 'video' && !isTop && asset.duration != null && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>▶ {formatDuration(asset.duration)}</Text>
          </View>
        )}
        {kind === 'screenshot' && (
          <View style={styles.screenshotBadge}>
            <Text style={styles.screenshotText}>SCREENSHOT</Text>
          </View>
        )}

        {/* Creation date pill — centered at the top, inset to clear the heart and
            fullscreen buttons on either side. pointerEvents="none" so touches fall
            through to the card gesture or video play/pause area. */}
        <View style={styles.datePillWrapper} pointerEvents="none">
          <View style={styles.datePill}>
            <Text style={styles.datePillText}>{formatDate(asset.creationTime)}</Text>
          </View>
        </View>

        {/* Favorite button — top-left, mirrors the video fullscreen button */}
        <TouchableOpacity
          style={styles.favoriteBtn}
          onPress={() => toggleFavorite(asset.id)}
          hitSlop={12}
          activeOpacity={0.7}
        >
          <Text style={styles.favoriteIcon}>{isFavorited(asset.id) ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>

        {/* File size badge — only rendered when a fileSizeMap is provided (Size Sort mode).
            Floats above the video scrubber on top-video cards; bottom-right otherwise. */}
        {fileSizeMap?.has(asset.id) && (
          <View
            style={[
              styles.sizeBadge,
              kind === 'video' && isTop ? styles.sizeBadgeVideoTop : styles.sizeBadgeDefault,
            ]}
            pointerEvents="none"
          >
            <Text style={styles.sizeBadgeText}>{formatFileSize(fileSizeMap.get(asset.id)!)}</Text>
          </View>
        )}

        </Animated.View>
      </GestureDetector>

      {kind !== 'video' && (
        <ZoomableImageModal
          uri={asset.uri}
          visible={zoomVisible}
          onClose={() => setZoomVisible(false)}
        />
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#000', // black letterbox/pillarbox when using contain
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },

  label: {
    position: 'absolute',
    top: 36,
    paddingVertical: 7,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 3.5,
  },
  keepLabel: {
    right: 24,
    borderColor: '#4ade80',
    transform: [{ rotate: '15deg' }],
  },
  deleteLabel: {
    left: 24,
    borderColor: '#f87171',
    transform: [{ rotate: '-15deg' }],
  },
  keepText: { color: '#4ade80', fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  deleteText: { color: '#f87171', fontSize: 20, fontWeight: '900', letterSpacing: 2 },

  // ── Play / Pause ──
  playPauseArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  playIconText: {
    color: '#fff',
    fontSize: 26,
    marginLeft: 4, // optical compensation for the triangle glyph
  },

  // ── Fullscreen ──
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
  expandIconWrap: {
    width: 18,
    height: 18,
  },
  corner: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderColor: '#fff',
  },

  // ── Mute ──
  muteBtn: {
    position: 'absolute',
    bottom: 66, // above the scrubber strip
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteIcon: { fontSize: 18 },

  // ── Scrubber ──
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

  // ── Date pill ──
  datePillWrapper: {
    position: 'absolute',
    top: 14,
    left: 56,  // clears the 36px heart button + 6px gap
    right: 56, // mirrors left; also clears the fullscreen btn on video top cards
    alignItems: 'center',
  },
  datePill: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  datePillText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Favorite button ──
  favoriteBtn: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 36,
    height: 36,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteIcon: { fontSize: 18 },

  // ── Badges ──
  durationBadge: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  durationText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  screenshotBadge: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    backgroundColor: 'rgba(99,102,241,0.85)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  screenshotText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  // ── File size badge (Size Sort mode only) ──
  sizeBadge: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  // Photo/screenshot cards and non-top video cards: bottom-right corner
  sizeBadgeDefault: {
    bottom: 14,
    right: 14,
  },
  // Top video card: float above the scrubber strip, left side (opposite the mute button)
  sizeBadgeVideoTop: {
    bottom: 70,
    left: 14,
  },
  sizeBadgeText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    fontWeight: '600',
  },
});
