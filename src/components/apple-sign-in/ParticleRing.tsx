import React, { useMemo } from 'react';
import {
  Atlas,
  Canvas,
  Circle,
  FilterMode,
  MipmapMode,
  rect,
  useColorBuffer,
  useRSXformBuffer,
  useTexture,
} from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useFrameCallback,
  type SharedValue,
} from 'react-native-reanimated';

import {
  COLOR_LUT_B,
  COLOR_LUT_G,
  COLOR_LUT_R,
  COLOR_LUT_SIZE,
  DEFAULT_STAGE_SIZE,
  DOT_TEXTURE_RADIUS,
  DOT_TEXTURE_SIZE,
  ICON_FIRST_START_MS,
  ICON_INTERVAL_MS,
  INTRO_BLUE,
  PARTICLE_COUNT,
  PARTICLE_LANES,
  PARTICLES,
  TAU,
} from './constants';
import {
  getIconFrame,
  getParticleColorBloom,
  getParticleVisualRadius,
  getPlayheadDeltaMs,
  getStageFieldSize,
  mix,
  particleEntrance,
  positiveModulo,
  resolveAnimationSpeed,
} from './motion';
import {
  getCarrierParticleRadius,
  getCarrierRepulsionStrength,
  getReferenceCarrierParticleResponse,
} from './particlePhysics';
import type { AppleSignInSpeedMode } from './types';

interface ParticleRingProps {
  size: number;
  playhead: SharedValue<number>;
  introProgress: SharedValue<number>;
  radialScale: SharedValue<number>;
  orbitRotation: SharedValue<number>;
  iconParticleIndices: number[];
  iconCarrierColors: readonly (readonly [number, number, number])[];
  autoPlay: boolean;
  speed: number | AppleSignInSpeedMode;
}

export function ParticleRing({
  size,
  playhead,
  introProgress,
  radialScale,
  orbitRotation,
  iconParticleIndices,
  iconCarrierColors,
  autoPlay,
  speed,
}: ParticleRingProps) {
  const playbackSpeed = useDerivedValue(() => resolveAnimationSpeed(speed));
  const fieldSize = getStageFieldSize(size);
  const center = fieldSize / 2;
  const sizeRatio = size / DEFAULT_STAGE_SIZE;
  const carrierSlotByParticle = useMemo(() => {
    const slots = new Array(PARTICLE_COUNT).fill(-1);
    for (let iconIndex = 0; iconIndex < iconParticleIndices.length; iconIndex += 1) {
      slots[iconParticleIndices[iconIndex]] = iconIndex;
    }
    return slots;
  }, [iconParticleIndices]);

  const colorBloom = useDerivedValue(() =>
    getParticleColorBloom(introProgress.value),
  );

  const texture = useTexture(
    <Circle
      cx={DOT_TEXTURE_SIZE / 2}
      cy={DOT_TEXTURE_SIZE / 2}
      r={DOT_TEXTURE_RADIUS}
      color="white"
    />,
    { width: DOT_TEXTURE_SIZE, height: DOT_TEXTURE_SIZE },
  );

  // The frame callback only advances the clock. Every particle position is a
  // pure function of that clock, so replay cannot inherit spring velocity.
  useFrameCallback((frame) => {
    'worklet';
    if (!autoPlay || !texture) {
      return;
    }

    playhead.value += getPlayheadDeltaMs(
      frame.timeSincePreviousFrame,
      playbackSpeed.value,
    );
  });

  const sprites = useMemo(() => {
    const result = [];
    for (let index = 0; index < PARTICLE_COUNT; index += 1) {
      result.push(rect(0, 0, DOT_TEXTURE_SIZE, DOT_TEXTURE_SIZE));
    }
    return result;
  }, []);

  const transforms = useRSXformBuffer(PARTICLE_COUNT, (transform, index) => {
    'worklet';
    const particle = PARTICLES[index];
    const angle = particle.angle + orbitRotation.value;
    const radius = size * particle.radiusFactor * radialScale.value;
    let radialOffsetX = 0;
    let radialOffsetY = 0;
    let tangentialOffsetX = 0;
    let tangentialOffsetY = 0;
    let particleScale = 1;

    for (let iconIndex = 0; iconIndex < iconParticleIndices.length; iconIndex += 1) {
      const carrierIndex = iconParticleIndices[iconIndex];
      const carrier = PARTICLES[carrierIndex];
      const iconFrame = getIconFrame(
        playhead.value,
        iconIndex,
        iconParticleIndices.length,
        ICON_FIRST_START_MS,
        ICON_INTERVAL_MS,
        carrier.angle,
      );
      const strength = getCarrierRepulsionStrength(iconFrame.scale);
      const response = getReferenceCarrierParticleResponse(
        index,
        carrierIndex,
        strength,
        sizeRatio,
      );
      radialOffsetX += Math.cos(angle) * response.radialOffset;
      radialOffsetY += Math.sin(angle) * response.radialOffset;
      tangentialOffsetX += -Math.sin(angle) * response.tangentialOffset;
      tangentialOffsetY += Math.cos(angle) * response.tangentialOffset;
      particleScale = Math.min(particleScale, response.scale);
    }

    const baseParticleRadius =
      getParticleVisualRadius(
        size,
        particle.dotRadiusFactor,
        introProgress.value,
        particle.revealDelay,
        index % PARTICLE_LANES,
      ) * particleScale;
    const carrierSlot = carrierSlotByParticle[index];
    let particleRadius = baseParticleRadius;
    if (carrierSlot >= 0) {
      const active =
        playhead.value >= ICON_FIRST_START_MS + carrierSlot * ICON_INTERVAL_MS;
      const carrierFrame = getIconFrame(
        playhead.value,
        carrierSlot,
        iconParticleIndices.length,
        ICON_FIRST_START_MS,
        ICON_INTERVAL_MS,
        particle.angle,
      );
      particleRadius = getCarrierParticleRadius(
        baseParticleRadius,
        carrierFrame.scale,
        sizeRatio,
        active,
      );
    }

    const textureScale = particleRadius / DOT_TEXTURE_RADIUS;
    const x =
      center +
      Math.cos(angle) * radius +
      radialOffsetX +
      tangentialOffsetX;
    const y =
      center +
      Math.sin(angle) * radius +
      radialOffsetY +
      tangentialOffsetY;

    transform.set(
      textureScale,
      0,
      x - (DOT_TEXTURE_SIZE / 2) * textureScale,
      y - (DOT_TEXTURE_SIZE / 2) * textureScale,
    );
  });

  const colors = useColorBuffer(PARTICLE_COUNT, (color, index) => {
    'worklet';
    const particle = PARTICLES[index];
    const angle = particle.angle + orbitRotation.value;
    const radius = size * particle.radiusFactor * radialScale.value;
    let renderedX = Math.cos(angle) * radius;
    let renderedY = Math.sin(angle) * radius;

    for (let iconIndex = 0; iconIndex < iconParticleIndices.length; iconIndex += 1) {
      const carrierIndex = iconParticleIndices[iconIndex];
      const carrier = PARTICLES[carrierIndex];
      const iconFrame = getIconFrame(
        playhead.value,
        iconIndex,
        iconParticleIndices.length,
        ICON_FIRST_START_MS,
        ICON_INTERVAL_MS,
        carrier.angle,
      );
      const response = getReferenceCarrierParticleResponse(
        index,
        carrierIndex,
        getCarrierRepulsionStrength(iconFrame.scale),
        sizeRatio,
      );
      renderedX +=
        Math.cos(angle) * response.radialOffset -
        Math.sin(angle) * response.tangentialOffset;
      renderedY +=
        Math.sin(angle) * response.radialOffset +
        Math.cos(angle) * response.tangentialOffset;
    }

    const entrance = particleEntrance(
      introProgress.value,
      particle.revealDelay,
      index % PARTICLE_LANES,
    );
    const renderedAngle = Math.atan2(renderedY, renderedX);
    const normalizedAngle = positiveModulo(renderedAngle, TAU) / TAU;
    const lutIndex = Math.min(
      COLOR_LUT_SIZE - 1,
      Math.floor(normalizedAngle * (COLOR_LUT_SIZE - 1)),
    );
    const bloom = colorBloom.value;

    let red = mix(INTRO_BLUE[0], COLOR_LUT_R[lutIndex], bloom);
    let green = mix(INTRO_BLUE[1], COLOR_LUT_G[lutIndex], bloom);
    let blue = mix(INTRO_BLUE[2], COLOR_LUT_B[lutIndex], bloom);
    let alpha = entrance * 0.96;
    const carrierSlot = carrierSlotByParticle[index];

    if (
      carrierSlot >= 0 &&
      playhead.value >= ICON_FIRST_START_MS + carrierSlot * ICON_INTERVAL_MS
    ) {
      const carrierFrame = getIconFrame(
        playhead.value,
        carrierSlot,
        iconParticleIndices.length,
        ICON_FIRST_START_MS,
        ICON_INTERVAL_MS,
        particle.angle,
      );
      const carrierColor = iconCarrierColors[carrierSlot];
      const colorProgress = carrierFrame.glyphOpacity;
      if (carrierColor) {
        red = mix(red, carrierColor[0], colorProgress);
        green = mix(green, carrierColor[1], colorProgress);
        blue = mix(blue, carrierColor[2], colorProgress);
      }
      alpha = Math.max(alpha, carrierFrame.opacity * 0.96);
    }

    color[0] = red;
    color[1] = green;
    color[2] = blue;
    color[3] = alpha;
  });

  return (
    <Canvas style={{ width: fieldSize, height: fieldSize }} pointerEvents="none">
      <Atlas
        image={texture}
        sprites={sprites}
        transforms={transforms}
        colors={colors}
        colorBlendMode="modulate"
        sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.Linear }}
      />
    </Canvas>
  );
}