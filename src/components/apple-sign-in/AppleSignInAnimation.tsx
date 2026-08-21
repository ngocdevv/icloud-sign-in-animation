import React, { useMemo } from 'react';
import { processColor, StyleSheet, View } from 'react-native';
import {
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

import {
  DEFAULT_ANIMATION_SPEED,
  DEFAULT_STAGE_SIZE,
  INTRO_DURATION_MS,
  PARTICLE_INTRO_DURATION_MS,
  STAGE_OFFSET_X_FACTOR,
  STAGE_OFFSET_Y_FACTOR,
  TEXT_OFFSET_Y_FACTOR,
} from './constants';
import { CenterContent } from './CenterContent';
import { FloatingIcons } from './FloatingIcons';
import {
  clamp01,
  findClosestOuterParticleIndex,
  getDefaultIconStartAngle,
  getParticleOrbitRotation,
  getParticleRadialScale,
  getStageFieldSize,
  getStageOverflow,
} from './motion';
import { ParticleRing } from './ParticleRing';
import { TextContent } from './TextContent';
import type {
  AppleSignInAnimationProps,
  AppleSignInIcon,
  AppleServiceIconKind,
} from './types';

type CarrierRgb = readonly [number, number, number];

const DEFAULT_CARRIER_RGB: Record<AppleServiceIconKind, CarrierRgb> = {
  icloud: [0.33, 0.74, 0.95],
  files: [0.42, 0.62, 0.94],
  'app-store': [0.09, 0.56, 0.93],
  messages: [0.18, 0.86, 0.33],
};

function resolveCarrierRgb(icon: AppleSignInIcon): CarrierRgb {
  const fallback = DEFAULT_CARRIER_RGB[icon.kind ?? 'icloud'];
  if (!icon.carrierColor) {
    return fallback;
  }

  const processed = processColor(icon.carrierColor);
  if (typeof processed !== 'number') {
    return fallback;
  }

  const color = processed >>> 0;
  return [
    ((color >>> 16) & 0xff) / 255,
    ((color >>> 8) & 0xff) / 255,
    (color & 0xff) / 255,
  ];
}

const DEFAULT_ICONS: AppleSignInIcon[] = [
  { key: 'icloud', kind: 'icloud', accessibilityLabel: 'iCloud' },
  { key: 'files', kind: 'files', accessibilityLabel: 'Files' },
  { key: 'app-store', kind: 'app-store', accessibilityLabel: 'App Store' },
  { key: 'messages', kind: 'messages', accessibilityLabel: 'Messages' },
];

export function AppleSignInAnimation({
  avatarSource,
  userName,
  icons = DEFAULT_ICONS,
  size = DEFAULT_STAGE_SIZE,
  style,
  autoPlay = true,
  speed = DEFAULT_ANIMATION_SPEED,
}: AppleSignInAnimationProps) {
  const playhead = useSharedValue(0);
  const identityProgress = useDerivedValue(() =>
    clamp01(playhead.value / INTRO_DURATION_MS),
  );
  const particleIntroProgress = useDerivedValue(() =>
    clamp01(playhead.value / PARTICLE_INTRO_DURATION_MS),
  );
  const radialScale = useDerivedValue(() =>
    getParticleRadialScale(playhead.value),
  );
  const orbitRotation = useDerivedValue(() =>
    getParticleOrbitRotation(playhead.value),
  );

  const resolvedIcons = icons.length > 0 ? icons : DEFAULT_ICONS;
  const iconParticleIndices = useMemo(
    () =>
      resolvedIcons.map(
        (icon, index) =>
          findClosestOuterParticleIndex(
            icon.startAngle ?? getDefaultIconStartAngle(index),
          ),
      ),
    [resolvedIcons],
  );
  const iconCarrierColors = useMemo(
    () => resolvedIcons.map(resolveCarrierRgb),
    [resolvedIcons],
  );

  const fieldSize = getStageFieldSize(size);
  const fieldOverflow = getStageOverflow(size);

  return (
    <View style={[styles.container, style]}>
      <View style={{ width: size, height: size, overflow: 'visible' }}>
        <View
          style={{
            width: size,
            height: size,
            transform: [
              { translateX: size * STAGE_OFFSET_X_FACTOR },
              { translateY: size * STAGE_OFFSET_Y_FACTOR },
            ],
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: -fieldOverflow,
              top: -fieldOverflow,
              width: fieldSize,
              height: fieldSize,
            }}
          >
            <ParticleRing
              size={size}
              playhead={playhead}
              introProgress={particleIntroProgress}
              radialScale={radialScale}
              orbitRotation={orbitRotation}
              iconParticleIndices={iconParticleIndices}
              iconCarrierColors={iconCarrierColors}
              autoPlay={autoPlay}
              speed={speed}
            />
            <CenterContent
              avatarSource={avatarSource}
              introProgress={identityProgress}
              size={size}
            />
            <FloatingIcons
              icons={resolvedIcons}
              iconParticleIndices={iconParticleIndices}
              playhead={playhead}
              radialScale={radialScale}
              orbitRotation={orbitRotation}
              size={size}
            />
          </View>
        </View>
      </View>

      <View
        style={[
          styles.textSpacing,
          { transform: [{ translateY: size * TEXT_OFFSET_Y_FACTOR }] },
        ]}
      >
        <TextContent userName={userName} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textSpacing: {
    marginTop: 48,
  },
});
