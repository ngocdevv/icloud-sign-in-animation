import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';

import {
  AppleSignInAnimation,
  type AppleSignInIcon,
  type AppleSignInSpeedMode,
} from './src/components/apple-sign-in';

const avatarSource = require('./assets/avatar.png');

const SPEED_MODES: { mode: AppleSignInSpeedMode; label: string }[] = [
  { mode: 'slow', label: '0.5×' },
  { mode: 'normal', label: '1×' },
  { mode: 'fast', label: '2×' },
];

function CircularServiceIcon({ source }: { source: ImageSourcePropType }) {
  return (
    <View style={styles.serviceIconMask}>
      <Image source={source} style={styles.serviceIconImage} resizeMode="cover" />
    </View>
  );
}

const SERVICE_ICONS: AppleSignInIcon[] = [
  {
    key: 'photos',
    accessibilityLabel: 'Photos',
    carrierColor: '#F4F4F4',
    element: (
      <CircularServiceIcon
        source={require('./assets/service-icons/photos.png')}
      />
    ),
  },
  {
    key: 'weather',
    accessibilityLabel: 'Weather',
    carrierColor: '#168BD6',
    element: (
      <CircularServiceIcon
        source={require('./assets/service-icons/weather.png')}
      />
    ),
  },
  {
    key: 'app-store',
    accessibilityLabel: 'App Store',
    carrierColor: '#168AF4',
    element: (
      <CircularServiceIcon
        source={require('./assets/service-icons/app-store.png')}
      />
    ),
  },
  {
    key: 'messages',
    accessibilityLabel: 'Messages',
    carrierColor: '#28DC4A',
    element: (
      <CircularServiceIcon
        source={require('./assets/service-icons/messages.png')}
      />
    ),
  },
];

export default function App() {
  const [runKey, setRunKey] = useState(0);
  const [speed, setSpeed] = useState<AppleSignInSpeedMode>('normal');

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Replay sign-in animation"
        onPress={() => setRunKey((current) => current + 1)}
        style={({ pressed }) => [
          styles.backButton,
          pressed && styles.backButtonPressed,
        ]}
      >
        <Ionicons name="chevron-back" size={30} color="#111111" />
      </Pressable>

      <AppleSignInAnimation
        key={runKey}
        avatarSource={avatarSource}
        userName="Ngọc Lê"
        icons={SERVICE_ICONS}
        speed={speed}
        style={styles.animation}
      />

      <View style={styles.speedBar} accessibilityRole="adjustable">
        {SPEED_MODES.map(({ mode, label }) => {
          const selected = mode === speed;
          return (
            <Pressable
              key={mode}
              accessibilityRole="button"
              accessibilityLabel={`Animation speed ${label}`}
              accessibilityState={{ selected }}
              onPress={() => setSpeed(mode)}
              style={({ pressed }) => [
                styles.speedChip,
                selected && styles.speedChipSelected,
                pressed && styles.speedChipPressed,
              ]}
            >
              <Text
                style={[
                  styles.speedChipLabel,
                  selected && styles.speedChipLabelSelected,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  serviceIconMask: {
    width: 90,
    height: 90,
    borderRadius: 45,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceIconImage: {
    width: 112,
    height: 112,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  animation: {
    transform: [{ translateY: 64 }],
  },
  backButton: {
    position: 'absolute',
    zIndex: 10,
    top: 68,
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#111111',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  backButtonPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.96 }],
  },
  speedBar: {
    position: 'absolute',
    zIndex: 10,
    right: 20,
    bottom: 48,
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    shadowColor: '#111111',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  speedChip: {
    minWidth: 52,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  speedChipSelected: {
    backgroundColor: '#111111',
  },
  speedChipPressed: {
    opacity: 0.7,
  },
  speedChipLabel: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  speedChipLabelSelected: {
    color: '#FFFFFF',
  },
});
