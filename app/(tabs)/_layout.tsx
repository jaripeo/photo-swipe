import { Tabs } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTrash } from '@/contexts/TrashContext';

export default function TabLayout() {
  const { queue } = useTrash();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0f0f0f', borderTopColor: '#222' },
        tabBarActiveTintColor: '#6C63FF',
        tabBarInactiveTintColor: '#555',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Clean',
          tabBarIcon: ({ color }) => (
            <IconSymbol name="photo.on.rectangle" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: queue.length > 0 ? `Trash (${queue.length})` : 'Trash',
          tabBarIcon: ({ color }) => (
            <IconSymbol name="trash" size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
