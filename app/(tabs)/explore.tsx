import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Image } from 'expo-image';
import type { Asset } from 'expo-media-library/legacy';
import { useTrash } from '@/contexts/TrashContext';
import { useMediaLibraryContext } from '@/contexts/MediaLibraryContext';

export default function TrashScreen() {
  const { queue, removeFromTrash, clearTrash } = useTrash();
  const { deleteAssets } = useMediaLibraryContext();

  const handleEmptyTrash = async () => {
    if (queue.length === 0) return;
    // deleteAssetsAsync triggers the native iOS confirmation prompt automatically
    const success = await deleteAssets(queue);
    if (success) clearTrash();
  };

  if (queue.length === 0) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyIcon}>🗑</Text>
        <Text style={styles.emptyTitle}>Trash is empty</Text>
        <Text style={styles.emptySub}>
          Photos you delete while swiping will appear here for review before
          permanently deleting.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Trash</Text>
        <Text style={styles.subheading}>{queue.length} photos queued</Text>
      </View>

      <FlatList<Asset>
        data={queue}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <View style={styles.thumbWrap}>
            <Image source={{ uri: item.uri }} style={styles.thumb} />
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => removeFromTrash(item.id)}
              hitSlop={8}
            >
              <Text style={styles.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <TouchableOpacity
        style={styles.emptyBtn}
        onPress={handleEmptyTrash}
        activeOpacity={0.8}
      >
        <Text style={styles.emptyBtnText}>Empty Trash ({queue.length})</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f0f0f',
    padding: 32,
  },
  container: { flex: 1, backgroundColor: '#0f0f0f' },

  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 10,
  },
  emptySub: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },

  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  heading: { color: '#fff', fontSize: 26, fontWeight: '800' },
  subheading: { color: '#888', fontSize: 14, marginTop: 3 },

  grid: { paddingHorizontal: 8, paddingBottom: 16 },
  thumbWrap: { flex: 1 / 3, aspectRatio: 1, padding: 2 },
  thumb: { flex: 1, width: '100%', height: '100%', borderRadius: 10, backgroundColor: '#1a1a1a' },
  removeBtn: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  emptyBtn: {
    margin: 16,
    backgroundColor: '#f87171',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
