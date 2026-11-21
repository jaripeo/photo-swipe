import { useEffect } from 'react';
import {
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const RESET_SPRING = { damping: 18, stiffness: 180 };

interface Props {
  uri: string;
  visible: boolean;
  onClose: () => void;
}

export function ZoomableImageModal({ uri, visible, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const reset = () => {
    scale.value = withSpring(1, RESET_SPRING);
    translateX.value = withSpring(0, RESET_SPRING);
    translateY.value = withSpring(0, RESET_SPRING);
  };

  useEffect(() => {
    if (visible) {
      scale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
    }
  }, [visible, scale, translateX, translateY]);

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.min(MAX_SCALE, Math.max(1, startScale.value * event.scale));
    })
    .onEnd(() => {
      if (scale.value <= 1.01) {
        scale.value = withSpring(1, RESET_SPRING);
        translateX.value = withSpring(0, RESET_SPRING);
        translateY.value = withSpring(0, RESET_SPRING);
      }
    });

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value <= 1) return;
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    })
    .onEnd(() => {
      const maxX = ((scale.value - 1) * width) / 2;
      const maxY = ((scale.value - 1) * height) / 2;
      translateX.value = withSpring(
        Math.max(-maxX, Math.min(maxX, translateX.value)),
        RESET_SPRING,
      );
      translateY.value = withSpring(
        Math.max(-maxY, Math.min(maxY, translateY.value)),
        RESET_SPRING,
      );
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd((_event, success) => {
      if (!success) return;
      if (scale.value > 1.01) {
        scale.value = withTiming(1, { duration: 180 });
        translateX.value = withTiming(0, { duration: 180 });
        translateY.value = withTiming(0, { duration: 180 });
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE, { duration: 180 });
      }
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.imageStage, imageStyle]}>
            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
          </Animated.View>
        </GestureDetector>

        <SafeAreaView style={styles.overlay} pointerEvents="box-none">
          <View style={styles.toolbar} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close zoomed image"
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resetButton}
              onPress={reset}
              accessibilityRole="button"
              accessibilityLabel="Reset image zoom"
            >
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.hint} pointerEvents="none">
            <Text style={styles.hintText}>Pinch or double-tap to zoom · drag to move</Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageStage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'space-between',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,30,30,0.82)',
  },
  closeText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  resetButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(30,30,30,0.82)',
  },
  resetText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  hint: {
    alignSelf: 'center',
    marginBottom: 18,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(30,30,30,0.82)',
  },
  hintText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '600',
  },
});
