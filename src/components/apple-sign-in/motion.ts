import {
  ANIMATION_SPEED_MODES,
  DEFAULT_ANIMATION_SPEED,
  DEFAULT_STAGE_SIZE,
  ICON_ARTWORK_FADE_SCALE_DELTA,
  ICON_BOX_SIZE,
  ICON_DURATION_MS,
  ICON_RESTING_SCALE,
  MAX_ANIMATION_SPEED,
  MAX_FRAME_DELTA_MS,
  MIN_ANIMATION_SPEED,
  ORBIT_PHASE_OFFSET_DEGREES,
  ORBIT_PERIOD_MS,
  PARTICLE_ICON_CLEARANCE,
  PARTICLE_INTRO_DURATION_MS,
  PARTICLE_LANES,
  PARTICLES,
  REPULSION_MAX_OFFSET,
  TAU,
} from './constants';
import type { AppleSignInSpeedMode } from './types';

export function clamp01(value: number) {
  'worklet';
  return Math.min(1, Math.max(0, value));
}

export function resolveAnimationSpeed(speed?: number | AppleSignInSpeedMode) {
  'worklet';
  if (speed === 'slow') {
    return ANIMATION_SPEED_MODES.slow;
  }
  if (speed === 'normal') {
    return ANIMATION_SPEED_MODES.normal;
  }
  if (speed === 'fast') {
    return ANIMATION_SPEED_MODES.fast;
  }
  if (typeof speed !== 'number' || !Number.isFinite(speed)) {
    return DEFAULT_ANIMATION_SPEED;
  }

  return Math.min(MAX_ANIMATION_SPEED, Math.max(MIN_ANIMATION_SPEED, speed));
}

export function getPlayheadDeltaMs(
  timeSincePreviousFrame: number | null,
  speed: number | AppleSignInSpeedMode,
) {
  'worklet';
  const frameDeltaMs = Math.min(
    MAX_FRAME_DELTA_MS,
    timeSincePreviousFrame ?? 1000 / 60,
  );
  return frameDeltaMs * resolveAnimationSpeed(speed);
}

export function getStageOverflow(size: number) {
  if (size <= 0) {
    return 0;
  }

  const sizeRatio = size / DEFAULT_STAGE_SIZE;
  let outerRadiusFactor = 0;
  let outerDotFactor = 0;
  for (let index = 0; index < PARTICLES.length; index += 1) {
    const particle = PARTICLES[index];
    if (particle.radiusFactor > outerRadiusFactor) {
      outerRadiusFactor = particle.radiusFactor;
    }
    if (particle.dotRadiusFactor > outerDotFactor) {
      outerDotFactor = particle.dotRadiusFactor;
    }
  }

  const outerOrbit = size * outerRadiusFactor;
  const outerDot = size * outerDotFactor;
  const wrapExtent =
    outerOrbit +
    (ICON_BOX_SIZE * sizeRatio * 1.04) / 2 +
    outerDot +
    PARTICLE_ICON_CLEARANCE * sizeRatio;
  const repulsionExtent =
    outerOrbit + REPULSION_MAX_OFFSET * sizeRatio + outerDot;

  return Math.max(0, Math.ceil(Math.max(wrapExtent, repulsionExtent) - size / 2));
}

export function getStageFieldSize(size: number) {
  return size + 2 * getStageOverflow(size);
}

export function mix(from: number, to: number, progress: number) {
  'worklet';
  return from + (to - from) * progress;
}

export function easeOutCubic(value: number) {
  'worklet';
  const inverse = 1 - clamp01(value);
  return 1 - inverse * inverse * inverse;
}

export function easeInCubic(value: number) {
  'worklet';
  const progress = clamp01(value);
  return progress * progress * progress;
}

export function easeInOutCubic(value: number) {
  'worklet';
  const progress = clamp01(value);
  if (progress < 0.5) {
    return 4 * progress * progress * progress;
  }

  const inverse = -2 * progress + 2;
  return 1 - (inverse * inverse * inverse) / 2;
}

export function easeOutBack(value: number) {
  'worklet';
  const progress = clamp01(value);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const shifted = progress - 1;
  return 1 + c3 * shifted * shifted * shifted + c1 * shifted * shifted;
}

export function smoothstep(edge0: number, edge1: number, value: number) {
  'worklet';
  const progress = clamp01((value - edge0) / (edge1 - edge0));
  return progress * progress * (3 - 2 * progress);
}

export function positiveModulo(value: number, divisor: number) {
  'worklet';
  return ((value % divisor) + divisor) % divisor;
}

export function getCenterIdentityFrame(introProgress: number) {
  'worklet';
  const progress = clamp01(introProgress);
  const appleGrow = smoothstep(0, 0.62, progress);
  const appleToAvatar = smoothstep(0.78, 0.98, progress);
  const blueToBlack = clamp01((progress - 0.08) / 0.72);

  return {
    appleOpacity: 1 - appleToAvatar,
    appleScale: mix(0.42, 1.03, appleGrow),
    blueAppleOpacity: 1 - blueToBlack,
    blackAppleOpacity: blueToBlack,
    avatarOpacity: appleToAvatar,
    avatarScale: mix(0.74, 1, appleToAvatar),
  };
}

function interpolateMeasuredTrack(
  value: number,
  times: readonly number[],
  values: readonly number[],
) {
  'worklet';
  if (value <= times[0]) {
    return values[0];
  }

  for (let index = 1; index < times.length; index += 1) {
    const toTime = times[index];
    if (value <= toTime) {
      const fromTime = times[index - 1];
      const progress = clamp01((value - fromTime) / (toTime - fromTime));
      return mix(values[index - 1], values[index], progress);
    }
  }

  return values[values.length - 1];
}

const PARTICLE_RADIAL_TIMES_MS = [
  0,
  50,
  100,
  150,
  200,
  250,
  300,
  350,
  400,
  450,
  500,
  550,
  600,
  650,
  700,
  750,
  800,
] as const;

const PARTICLE_RADIAL_SCALE = [
  0.307917,
  0.317723,
  0.345109,
  0.385948,
  0.457981,
  0.543629,
  0.635995,
  0.7246,
  0.801949,
  0.864439,
  0.911718,
  0.945457,
  0.96833,
  0.983003,
  0.991954,
  0.997012,
  1,
] as const;

export function getParticleRadialScale(elapsedMs: number) {
  'worklet';
  return interpolateMeasuredTrack(
    Math.max(0, elapsedMs),
    PARTICLE_RADIAL_TIMES_MS,
    PARTICLE_RADIAL_SCALE,
  );
}

const PARTICLE_ROTATION_TIMES_MS = [
  0,
  16.667,
  33.333,
  50,
  66.667,
  83.333,
  100,
  116.667,
  135,
  150,
  201.7,
  251.7,
  301.7,
  351.7,
  401.7,
  503.3,
  553.3,
  605,
  656.7,
  705,
  753.3,
  800,
] as const;

const PARTICLE_ROTATION_DEGREES = [
  -73.7132,
  -73.0679,
  -72.3491,
  -71.5324,
  -70.6177,
  -69.605,
  -68.4943,
  -67.3151,
  -65.8897,
  -64.6,
  -57,
  -47.3,
  -37.5,
  -29.5,
  -23.1,
  -13.7,
  -10.3,
  -7.4,
  -5,
  -3,
  -1.3,
  0,
] as const;

export function getParticleOrbitRotation(elapsedMs: number) {
  'worklet';
  if (elapsedMs < PARTICLE_INTRO_DURATION_MS) {
    const introMs = Math.max(0, elapsedMs);
    for (
      let index = 1;
      index < PARTICLE_ROTATION_TIMES_MS.length;
      index += 1
    ) {
      const toTime = PARTICLE_ROTATION_TIMES_MS[index];
      if (introMs <= toTime) {
        const fromTime = PARTICLE_ROTATION_TIMES_MS[index - 1];
        const progress = clamp01((introMs - fromTime) / (toTime - fromTime));
        const degrees = mix(
          PARTICLE_ROTATION_DEGREES[index - 1],
          PARTICLE_ROTATION_DEGREES[index],
          progress,
        );
        return ((degrees + ORBIT_PHASE_OFFSET_DEGREES) * Math.PI) / 180;
      }
    }
  }

  return (
    (ORBIT_PHASE_OFFSET_DEGREES * Math.PI) / 180 +
    ((elapsedMs - PARTICLE_INTRO_DURATION_MS) / ORBIT_PERIOD_MS) * TAU
  );
}

const PARTICLE_SIZE_TIMES_MS = [
  0,
  150,
  200,
  250,
  300,
  350,
  400,
  500,
  650,
  800,
] as const;

const PARTICLE_INNER_SIZE_SCALE = [
  0.2,
  0.227,
  0.333,
  0.437,
  0.548,
  0.654,
  0.745,
  0.881,
  0.98,
  1,
] as const;

const PARTICLE_OUTER_SIZE_SCALE = [
  0.4,
  0.471,
  0.532,
  0.606,
  0.693,
  0.776,
  0.843,
  0.934,
  0.99,
  1,
] as const;

export function getParticleIntroSizeCap(
  introProgress: number,
  lane: number,
) {
  'worklet';
  return interpolateMeasuredTrack(
    clamp01(introProgress) * PARTICLE_INTRO_DURATION_MS,
    PARTICLE_SIZE_TIMES_MS,
    lane >= 2 ? PARTICLE_OUTER_SIZE_SCALE : PARTICLE_INNER_SIZE_SCALE,
  );
}

const PARTICLE_COLOR_TIMES_MS = [
  0,
  100,
  150,
  200,
  250,
  300,
  350,
  400,
  800,
] as const;

const PARTICLE_COLOR_PROGRESS = [
  0.180758,
  0.259296,
  0.468568,
  0.602909,
  0.74193,
  0.837831,
  0.913511,
  0.997463,
  1,
] as const;

export function getParticleColorBloom(introProgress: number) {
  'worklet';
  return interpolateMeasuredTrack(
    clamp01(introProgress) * PARTICLE_INTRO_DURATION_MS,
    PARTICLE_COLOR_TIMES_MS,
    PARTICLE_COLOR_PROGRESS,
  );
}

export function particleEntrance(
  introProgress: number,
  revealDelay: number,
  lane: number,
) {
  'worklet';
  const progress = clamp01(introProgress);
  const settledContrast = mix(0.7, 1, smoothstep(0, 0.25, progress));
  if (lane % 2 === 1) {
    return settledContrast;
  }

  const revealStart = Math.max(0, revealDelay) * (2 / 3);
  const reveal = smoothstep(revealStart, revealStart + 0.04, progress);
  return settledContrast * reveal;
}

export function getParticleVisualRadius(
  size: number,
  dotRadiusFactor: number,
  introProgress: number,
  revealDelay: number,
  lane: number,
) {
  'worklet';
  void revealDelay;
  const entranceScale = getParticleIntroSizeCap(introProgress, lane);
  return size * dotRadiusFactor * entranceScale;
}

export interface IconFrame {
  angle: number;
  glyphOpacity: number;
  opacity: number;
  scale: number;
}

export function getDefaultIconStartAngle(iconIndex: number) {
  return -Math.PI / 2 + iconIndex * (Math.PI / 4);
}

export function findClosestOuterParticleIndex(targetAngle: number) {
  const outerLane = PARTICLE_LANES - 1;
  let closestIndex = outerLane;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (let index = outerLane; index < PARTICLES.length; index += PARTICLE_LANES) {
    const delta = PARTICLES[index].angle - targetAngle;
    const angularDistance = Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta)));

    if (angularDistance < closestDistance) {
      closestDistance = angularDistance;
      closestIndex = index;
    }
  }

  return closestIndex;
}

export function findAdjacentLaneParticleIndices(carrierIndex: number) {
  const dotsPerLane = PARTICLES.length / PARTICLE_LANES;
  const lane = carrierIndex % PARTICLE_LANES;
  const slot = Math.floor(carrierIndex / PARTICLE_LANES);
  const previousSlot = (slot - 1 + dotsPerLane) % dotsPerLane;
  const nextSlot = (slot + 1) % dotsPerLane;

  return [
    previousSlot * PARTICLE_LANES + lane,
    nextSlot * PARTICLE_LANES + lane,
  ];
}

export function findCarrierBridgeParticleIndices(carrierIndex: number) {
  const bridgeLane = Math.max(0, PARTICLE_LANES - 2);
  const carrierAngle = PARTICLES[carrierIndex].angle;
  const angularOffset = Math.PI / 8;
  const result: number[] = [];

  for (const direction of [-1, 1]) {
    const targetAngle = carrierAngle + direction * angularOffset;
    let closestIndex = bridgeLane;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (
      let index = bridgeLane;
      index < PARTICLES.length;
      index += PARTICLE_LANES
    ) {
      const delta = PARTICLES[index].angle - targetAngle;
      const distance = Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta)));
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    }
    result.push(closestIndex);
  }

  return result;
}

export function buildCarrierBridgeOwners(carrierIndices: number[]) {
  const owners: number[][] = [];
  for (let index = 0; index < PARTICLES.length; index += 1) {
    owners.push([]);
  }

  for (let iconIndex = 0; iconIndex < carrierIndices.length; iconIndex += 1) {
    const bridges = findCarrierBridgeParticleIndices(carrierIndices[iconIndex]);
    owners[bridges[0]].push(iconIndex);
    owners[bridges[1]].push(iconIndex);
  }

  return owners;
}

export function isCarrierBridgeOwner(owners: number[], iconIndex: number) {
  'worklet';
  for (let ownerIndex = 0; ownerIndex < owners.length; ownerIndex += 1) {
    if (owners[ownerIndex] === iconIndex) {
      return true;
    }
  }
  return false;
}

export function findStrongestCarrierOwner(
  owners: number[],
  strengths: number[],
) {
  'worklet';
  let strongestOwner = -1;
  let strongestValue = 0;
  for (let ownerIndex = 0; ownerIndex < owners.length; ownerIndex += 1) {
    const owner = owners[ownerIndex];
    const strength =
      owner >= 0 && owner < strengths.length ? strengths[owner] : 0;
    if (strength > strongestValue) {
      strongestValue = strength;
      strongestOwner = owner;
    }
  }
  return strongestOwner;
}

export function findCarrierCenterParticleIndex(carrierIndex: number) {
  const centerLane = Math.max(0, PARTICLE_LANES - 3);
  const carrierAngle = PARTICLES[carrierIndex].angle;
  let closestIndex = centerLane;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (
    let index = centerLane;
    index < PARTICLES.length;
    index += PARTICLE_LANES
  ) {
    const delta = PARTICLES[index].angle - carrierAngle;
    const distance = Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta)));
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  }

  return closestIndex;
}

const ICON_MORPH_TIMES_MS = [
  0,
  36.7,
  101.7,
  168.3,
  233.3,
  401.7,
  900,
  1203.3,
  1403.3,
  1505,
  1538.3,
  1591.7,
  1690,
  1700,
] as const;

const ICON_MORPH_PROGRESS = [
  0,
  0.114,
  0.531,
  0.91,
  0.995,
  0.916,
  0.9,
  0.812,
  0.663,
  0.541,
  0.487,
  0.395,
  0.092,
  0,
] as const;

export function getIconMorphProgress(localMs: number) {
  'worklet';
  if (localMs <= ICON_MORPH_TIMES_MS[0]) {
    return ICON_MORPH_PROGRESS[0];
  }

  for (let index = 1; index < ICON_MORPH_TIMES_MS.length; index += 1) {
    const toTime = ICON_MORPH_TIMES_MS[index];
    if (localMs <= toTime) {
      const fromTime = ICON_MORPH_TIMES_MS[index - 1];
      const progress = clamp01((localMs - fromTime) / (toTime - fromTime));
      return mix(
        ICON_MORPH_PROGRESS[index - 1],
        ICON_MORPH_PROGRESS[index],
        progress,
      );
    }
  }

  return 0;
}

export function getIconFrame(
  elapsedMs: number,
  iconIndex: number,
  iconCount: number,
  firstStartMs: number,
  intervalMs: number,
  startAngle: number,
): IconFrame {
  'worklet';

  const firstAppearance = firstStartMs + iconIndex * intervalMs;
  if (iconCount === 0 || elapsedMs < firstAppearance) {
    return {
      angle: startAngle,
      glyphOpacity: 0,
      opacity: 0,
      scale: ICON_RESTING_SCALE,
    };
  }

  const cycleDuration = intervalMs * iconCount;
  const localMs = positiveModulo(elapsedMs - firstAppearance, cycleDuration);
  if (localMs > ICON_DURATION_MS) {
    return {
      angle: startAngle,
      glyphOpacity: 0,
      opacity: 0,
      scale: ICON_RESTING_SCALE,
    };
  }

  const opacityIn = smoothstep(0, 150, localMs);
  const opacityOut =
    1 - smoothstep(ICON_DURATION_MS - 300, ICON_DURATION_MS, localMs);

  const scale = mix(
    ICON_RESTING_SCALE,
    1.04,
    getIconMorphProgress(localMs),
  );
  const glyphOpacity = smoothstep(
    ICON_RESTING_SCALE,
    ICON_RESTING_SCALE + ICON_ARTWORK_FADE_SCALE_DELTA,
    scale,
  );

  return {
    angle: startAngle,
    glyphOpacity,
    opacity: opacityIn * opacityOut,
    scale,
  };
}
