import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { MediaLibraryProvider } from '@/contexts/MediaLibraryContext';
import { TrashProvider } from '@/contexts/TrashContext';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import { FilterProvider } from '@/contexts/FilterContext';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <MediaLibraryProvider>
        <TrashProvider>
          <FavoritesProvider>
            <FilterProvider>
              <Stack screenOptions={{ headerShown: false }} />
            </FilterProvider>
          </FavoritesProvider>
        </TrashProvider>
      </MediaLibraryProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
