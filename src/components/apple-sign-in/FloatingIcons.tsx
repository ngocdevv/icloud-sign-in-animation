import React from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import {
  DEFAULT_STAGE_SIZE,
  ICON_BOX_SIZE,
  ICON_FIRST_START_MS,
  ICON_INTERVAL_MS,
  PARTICLES,
} from './constants';
import { getIconFrame, getStageOverflow } from './motion';
import type {
  AppleServiceIconKind,
  AppleSignInIcon,
} from './types';

interface FloatingIconsProps {
  icons: AppleSignInIcon[];
  iconParticleIndices: number[];
  playhead: SharedValue<number>;
  radialScale: SharedValue<number>;
  orbitRotation: SharedValue<number>;
  size: number;
}

interface FloatingIconItemProps {
  icon: AppleSignInIcon;
  index: number;
  count: number;
  particleIndex: number;
  playhead: SharedValue<number>;
  radialScale: SharedValue<number>;
  orbitRotation: SharedValue<number>;
  size: number;
}

function DefaultServiceIcon({
  kind,
  scale,
}: {
  kind: AppleServiceIconKind;
  scale: number;
}) {
  if (kind === 'icloud') {
    return (
      <View style={{ transform: [{ scale }] }}>
        <Ionicons name="cloud" size={52} color="white" />
      </View>
    );
  }

  if (kind === 'files') {
    return (
      <View style={[styles.glyphArtwork, { transform: [{ scale }] }]}>
        <Ionicons name="folder" size={54} color="white" />
        <View style={styles.folderShine} />
      </View>
    );
  }

  if (kind === 'app-store') {
    return (
      <View style={[styles.appStoreGlyph, { transform: [{ scale }] }]}>
        <View style={[styles.appStoreStroke, styles.appStoreLeftStroke]} />
        <View style={[styles.appStoreStroke, styles.appStoreRightStroke]} />
        <View style={styles.appStoreCrossbar} />
      </View>
    );
  }

  return (
    <View style={{ transform: [{ scale }] }}>
      <Ionicons name="chatbubble" size={51} color="white" />
    </View>
  );
}

function FloatingIconItem({
  icon,
  index,
  count,
  particleIndex,
  playhead,
  radialScale,
  orbitRotation,
  size,
}: FloatingIconItemProps) {
  const sizeRatio = size / DEFAULT_STAGE_SIZE;
  const boxSize = ICON_BOX_SIZE * sizeRatio;
  const origin = size / 2 + getStageOverflow(size);
  const particle = PARTICLES[particleIndex];
  const kind = icon.kind ?? 'icloud';

  const frame = useDerivedValue(() =>
    getIconFrame(
      playhead.value,
      index,
      count,
      ICON_FIRST_START_MS,
      ICON_INTERVAL_MS,
      particle.angle,
    ),
  );

  const animatedStyle = useAnimatedStyle(() => {
    const angle = particle.angle + orbitRotation.value;
    const orbitRadius = size * particle.radiusFactor * radialScale.value;

    return {
      transform: [
        { translateX: Math.cos(angle) * orbitRadius },
        { translateY: Math.sin(angle) * orbitRadius },
      ],
    };
  });

  const glyphStyle = useAnimatedStyle(() => {
    return {
      opacity: frame.value.glyphOpacity,
      transform: [{ scale: frame.value.scale }],
    };
  });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.carrierParticle,
        {
          width: boxSize,
          height: boxSize,
          left: origin - boxSize / 2,
          top: origin - boxSize / 2,
        },
        animatedStyle,
      ]}
    >
      <Animated.View style={[styles.glyphContainer, glyphStyle]}>
        {icon.element ?? <DefaultServiceIcon kind={kind} scale={sizeRatio} />}
      </Animated.View>
    </Animated.View>
  );
}

export function FloatingIcons({
  icons,
  iconParticleIndices,
  playhead,
  radialScale,
  orbitRotation,
  size,
}: FloatingIconsProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {icons.map((icon, index) => (
        <FloatingIconItem
          key={icon.key}
          icon={icon}
          index={index}
          count={icons.length}
          particleIndex={iconParticleIndices[index]}
          playhead={playhead}
          radialScale={radialScale}
          orbitRotation={orbitRotation}
          size={size}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  carrierParticle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphArtwork: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  appStoreGlyph: {
    width: 58,
    height: 58,
  },
  appStoreStroke: {
    position: 'absolute',
    top: 3,
    left: 25,
    width: 8,
    height: 52,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  appStoreLeftStroke: {
    left: 12,
    transform: [{ rotate: '30deg' }],
  },
  appStoreRightStroke: {
    left: 38,
    transform: [{ rotate: '-30deg' }],
  },
  appStoreCrossbar: {
    position: 'absolute',
    left: 8,
    top: 34,
    width: 42,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  folderShine: {
    position: 'absolute',
    width: 36,
    height: 2,
    top: 20,
    borderRadius: 2,
    backgroundColor: 'rgba(108,159,239,0.45)',
  },
});
