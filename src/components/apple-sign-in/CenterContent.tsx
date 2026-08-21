import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { APPLE_SIZE_FACTOR, AVATAR_SIZE_FACTOR } from './constants';
import { getCenterIdentityFrame } from './motion';
import type { AppleSignInAnimationProps } from './types';

interface CenterContentProps {
  avatarSource: AppleSignInAnimationProps['avatarSource'];
  introProgress: SharedValue<number>;
  size: number;
}

const AnimatedImage = Animated.createAnimatedComponent(Image);

export function CenterContent({
  avatarSource,
  introProgress,
  size,
}: CenterContentProps) {
  const avatarSize = size * AVATAR_SIZE_FACTOR;
  const appleSize = size * APPLE_SIZE_FACTOR;

  const identityFrame = useDerivedValue(() =>
    getCenterIdentityFrame(introProgress.value),
  );

  const appleStyle = useAnimatedStyle(() => ({
    opacity: identityFrame.value.appleOpacity,
    transform: [{ scale: identityFrame.value.appleScale }],
  }));

  const blueAppleStyle = useAnimatedStyle(() => ({
    opacity: identityFrame.value.blueAppleOpacity,
  }));

  const blackAppleStyle = useAnimatedStyle(() => ({
    opacity: identityFrame.value.blackAppleOpacity,
  }));

  const avatarStyle = useAnimatedStyle(() => ({
    opacity: identityFrame.value.avatarOpacity,
    transform: [{ scale: identityFrame.value.avatarScale }],
  }));

  return (
    <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
      <Animated.View
        style={[styles.center, { width: appleSize, height: appleSize }, appleStyle]}
      >
        <Animated.View style={[styles.logoLayer, styles.center, blueAppleStyle]}>
          <FontAwesome name="apple" size={appleSize} color="#0669D2" />
        </Animated.View>
        <Animated.View style={[styles.logoLayer, styles.center, blackAppleStyle]}>
          <FontAwesome name="apple" size={appleSize} color="#000000" />
        </Animated.View>
      </Animated.View>

      <AnimatedImage
        source={avatarSource}
        resizeMode="cover"
        style={[
          styles.avatar,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
          },
          avatarStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLayer: {
    ...StyleSheet.absoluteFill,
  },
  avatar: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: '#F2F2F7',
  },
});
