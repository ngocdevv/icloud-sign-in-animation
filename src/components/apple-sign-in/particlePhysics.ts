import {
  CARRIER_BRIDGE_OUTWARD_OFFSET,
  CARRIER_CENTER_INWARD_OFFSET,
  CARRIER_NEIGHBOR_OUTWARD_OFFSET,
  ICON_BOX_SIZE,
  ICON_RESTING_SCALE,
  PARTICLE_ICON_CLEARANCE,
  PARTICLE_LANES,
  PARTICLE_NEIGHBOR_MIN_SCALE,
  PARTICLE_NEIGHBOR_SCALE_RESPONSE,
  PARTICLE_PAIR_CLEARANCE,
  PARTICLES,
  REPULSION_MAX_OFFSET,
  REPULSION_SOFT_RANGE,
} from './constants';

function clampUnit(value: number) {
  'worklet';
  return Math.min(1, Math.max(0, value));
}

export function getReferenceCarrierParticleResponse(
  particleIndex: number,
  carrierIndex: number,
  strength: number,
  sizeRatio: number,
) {
  'worklet';
  const activeStrength = clampUnit(strength);
  const ratio = Math.max(0, sizeRatio);
  if (
    activeStrength <= 0 ||
    ratio <= 0 ||
    particleIndex < 0 ||
    particleIndex >= PARTICLES.length ||
    carrierIndex < 0 ||
    carrierIndex >= PARTICLES.length
  ) {
    return { radialOffset: 0, tangentialOffset: 0, scale: 1 };
  }

  const lane = particleIndex % PARTICLE_LANES;
  const angularDelta = Math.atan2(
    Math.sin(PARTICLES[particleIndex].angle - PARTICLES[carrierIndex].angle),
    Math.cos(PARTICLES[particleIndex].angle - PARTICLES[carrierIndex].angle),
  );
  const absoluteDelta = Math.abs(angularDelta);
  const halfStep = Math.PI / 24;
  const fullStep = Math.PI / 12;
  const tolerance = 0.001;
  const direction = angularDelta < 0 ? -1 : 1;
  let radialPixels = 0;
  let tangentialPixels = 0;
  let peakScale = 1;

  if (lane === 0 && Math.abs(absoluteDelta - halfStep) <= tolerance) {
    radialPixels = -17.4;
    tangentialPixels = direction * 15.1;
    peakScale = 0.735;
  } else if (
    lane === 0 &&
    Math.abs(absoluteDelta - halfStep * 3) <= tolerance
  ) {
    radialPixels = -9.6;
    tangentialPixels = direction * 11.2;
    peakScale = 0.738;
  } else if (lane === 1 && absoluteDelta <= tolerance) {
    radialPixels = -81.6;
    peakScale = 0.75;
  } else if (
    lane === 1 &&
    Math.abs(absoluteDelta - fullStep) <= tolerance
  ) {
    radialPixels = -21.2;
    tangentialPixels = direction * 22.6;
    peakScale = 0.75;
  } else if (
    lane === 2 &&
    Math.abs(absoluteDelta - halfStep) <= tolerance
  ) {
    radialPixels = 33.2;
    tangentialPixels = direction * 120.9;
    peakScale = 0.75;
  } else if (
    lane === 3 &&
    Math.abs(absoluteDelta - fullStep) <= tolerance
  ) {
    radialPixels = 43.1;
    tangentialPixels = direction * 45.2;
    peakScale = 0.7;
  }

  return {
    radialOffset: (radialPixels / 3) * ratio * activeStrength,
    tangentialOffset: (tangentialPixels / 3) * ratio * activeStrength,
    scale: 1 - (1 - peakScale) * activeStrength,
  };
}

export function getCarrierRepulsionStrength(scale: number) {
  'worklet';
  return clampUnit(
    (scale - ICON_RESTING_SCALE) / (1.04 - ICON_RESTING_SCALE),
  );
}

export function getCarrierNeighborRadialBias(
  strength: number,
  sizeRatio: number,
) {
  'worklet';
  if (sizeRatio <= 0) {
    return 0;
  }
  return CARRIER_NEIGHBOR_OUTWARD_OFFSET * sizeRatio * clampUnit(strength);
}

export function getCarrierBridgeRadialBias(
  strength: number,
  sizeRatio: number,
) {
  'worklet';
  if (sizeRatio <= 0) {
    return 0;
  }
  return CARRIER_BRIDGE_OUTWARD_OFFSET * sizeRatio * clampUnit(strength);
}

export function getCarrierCenterInwardBias(
  strength: number,
  sizeRatio: number,
) {
  'worklet';
  if (sizeRatio <= 0) {
    return 0;
  }
  return CARRIER_CENTER_INWARD_OFFSET * sizeRatio * clampUnit(strength);
}

export function getCarrierNeighborIntersection(
  carrierOrbitRadius: number,
  carrierAngle: number,
  radialBias: number,
  direction: number,
  particleRadius: number,
  carrierRadius: number,
  sizeRatio: number,
  clearance?: number,
) {
  'worklet';
  const carrierOrbit = Math.max(0.001, carrierOrbitRadius);
  const particleOrbit = Math.max(0.001, carrierOrbit + radialBias);
  const carrierDistance =
    Math.max(0, carrierRadius) +
    Math.max(0, particleRadius) +
    Math.max(0, clearance ?? PARTICLE_ICON_CLEARANCE) * Math.max(0, sizeRatio);
  const cosine = Math.min(
    1,
    Math.max(
      -1,
      (particleOrbit * particleOrbit +
        carrierOrbit * carrierOrbit -
        carrierDistance * carrierDistance) /
        (2 * particleOrbit * carrierOrbit),
    ),
  );
  const angularOffset = Math.acos(cosine) * (direction < 0 ? -1 : 1);
  const particleAngle = carrierAngle + angularOffset;

  return {
    x: Math.cos(particleAngle) * particleOrbit,
    y: Math.sin(particleAngle) * particleOrbit,
  };
}

export function getCarrierBridgeTarget(
  baseX: number,
  baseY: number,
  carrierOrbitRadius: number,
  carrierAngle: number,
  direction: number,
  particleRadius: number,
  carrierRadius: number,
  strength: number,
  sizeRatio: number,
) {
  'worklet';
  const activeStrength = clampUnit(strength);
  if (activeStrength <= 0 || sizeRatio <= 0) {
    return { x: baseX, y: baseY };
  }

  const target = getCarrierNeighborIntersection(
    carrierOrbitRadius,
    carrierAngle,
    getCarrierBridgeRadialBias(activeStrength, sizeRatio),
    direction,
    particleRadius,
    carrierRadius,
    sizeRatio,
  );

  return {
    x: baseX + (target.x - baseX) * activeStrength,
    y: baseY + (target.y - baseY) * activeStrength,
  };
}

export function getOrbitExclusionTarget(
  orbitRadius: number,
  particleAngle: number,
  carrierOrbitRadius: number,
  carrierAngle: number,
  particleRadius: number,
  carrierRadius: number,
  strength: number,
  sizeRatio: number,
  clearance?: number,
) {
  'worklet';
  const activeStrength = clampUnit(strength);
  const orbit = Math.max(0.001, orbitRadius);
  const baseX = Math.cos(particleAngle) * orbit;
  const baseY = Math.sin(particleAngle) * orbit;
  if (activeStrength <= 0 || sizeRatio <= 0) {
    return { x: baseX, y: baseY };
  }

  const carrierOrbit = Math.max(0.001, carrierOrbitRadius);
  const carrierX = Math.cos(carrierAngle) * carrierOrbit;
  const carrierY = Math.sin(carrierAngle) * carrierOrbit;
  const exclusionRadius =
    Math.max(0, carrierRadius) +
    Math.max(0, particleRadius) +
    Math.max(0, clearance ?? PARTICLE_ICON_CLEARANCE) * sizeRatio;
  const baseSeparation = Math.sqrt(
    (baseX - carrierX) * (baseX - carrierX) +
      (baseY - carrierY) * (baseY - carrierY),
  );
  if (baseSeparation >= exclusionRadius) {
    return { x: baseX, y: baseY };
  }

  const angularDelta = Math.atan2(
    Math.sin(particleAngle - carrierAngle),
    Math.cos(particleAngle - carrierAngle),
  );
  const inwardRadius = Math.max(0.001, carrierOrbit - exclusionRadius);
  const targetRadius = Math.min(orbit, inwardRadius);
  const mixedRadius = orbit + (targetRadius - orbit) * activeStrength;
  const inwardX = Math.cos(carrierAngle) * mixedRadius;
  const inwardY = Math.sin(carrierAngle) * mixedRadius;

  const direction = angularDelta < 0 ? -1 : 1;
  const cosine = Math.min(
    1,
    Math.max(
      -1,
      (orbit * orbit +
        carrierOrbit * carrierOrbit -
        exclusionRadius * exclusionRadius) /
        (2 * orbit * carrierOrbit),
    ),
  );
  const targetAngle = carrierAngle + Math.acos(cosine) * direction;
  const angularStep = Math.atan2(
    Math.sin(targetAngle - particleAngle),
    Math.cos(targetAngle - particleAngle),
  );
  const mixedAngle = particleAngle + angularStep * activeStrength;
  const orbitX = Math.cos(mixedAngle) * orbit;
  const orbitY = Math.sin(mixedAngle) * orbit;
  const blendProgress = clampUnit(Math.abs(angularDelta) / 0.14);
  const align = 1 - blendProgress * blendProgress * (3 - 2 * blendProgress);

  return {
    x: orbitX + (inwardX - orbitX) * align,
    y: orbitY + (inwardY - orbitY) * align,
  };
}

export function applyOrbitExclusionProjection(
  currentX: number,
  currentY: number,
  orbitRadius: number,
  particleAngle: number,
  carrierOrbitRadius: number,
  carrierAngle: number,
  particleRadius: number,
  carrierRadius: number,
  strength: number,
  sizeRatio: number,
  pinToCarrier: boolean,
) {
  'worklet';
  const activeStrength = clampUnit(strength);
  if (activeStrength <= 0 || sizeRatio <= 0) {
    return { x: currentX, y: currentY };
  }

  const carrierOrbit = Math.max(0.001, carrierOrbitRadius);
  const carrierX = Math.cos(carrierAngle) * carrierOrbit;
  const carrierY = Math.sin(carrierAngle) * carrierOrbit;
  const exclusionRadius =
    Math.max(0, carrierRadius) +
    Math.max(0, particleRadius) +
    PARTICLE_ICON_CLEARANCE * sizeRatio;
  const currentSeparation = Math.sqrt(
    (currentX - carrierX) * (currentX - carrierX) +
      (currentY - carrierY) * (currentY - carrierY),
  );

  if (!pinToCarrier && currentSeparation >= exclusionRadius) {
    return { x: currentX, y: currentY };
  }

  return getOrbitExclusionTarget(
    orbitRadius,
    pinToCarrier ? carrierAngle : particleAngle,
    carrierOrbitRadius,
    carrierAngle,
    particleRadius,
    carrierRadius,
    activeStrength,
    sizeRatio,
  );
}

export function getCarrierPhysicsRadius(scale: number, sizeRatio: number) {
  'worklet';
  if (sizeRatio <= 0) {
    return 0;
  }

  return (
    (ICON_BOX_SIZE * sizeRatio * Math.min(1.04, Math.max(0, scale))) / 2
  );
}

export function getCarrierParticleRadius(
  particleRadius: number,
  carrierScale: number,
  sizeRatio: number,
  active: boolean,
) {
  'worklet';
  if (!active || sizeRatio <= 0) {
    return Math.max(0, particleRadius);
  }

  return Math.max(
    Math.max(0, particleRadius),
    (ICON_BOX_SIZE * sizeRatio * Math.max(0, carrierScale)) / 2,
  );
}

export function getNeighborParticleScale(
  centerDistance: number,
  particleRadius: number,
  carrierRadius: number,
  strength: number,
  sizeRatio: number,
) {
  'worklet';
  const activeStrength = clampUnit(strength);
  if (activeStrength <= 0 || sizeRatio <= 0) {
    return 1;
  }

  const contactDistance =
    Math.max(0, particleRadius) +
    Math.max(0, carrierRadius) +
    PARTICLE_ICON_CLEARANCE * sizeRatio;
  const influenceRange = Math.max(REPULSION_SOFT_RANGE * sizeRatio, 0.001);
  const proximity =
    1 - clampUnit((Math.max(0, centerDistance) - contactDistance) / influenceRange);
  const shrinkProgress = activeStrength * proximity * proximity;

  return 1 - (1 - PARTICLE_NEIGHBOR_MIN_SCALE) * shrinkProgress;
}

export function approachNeighborParticleScale(
  currentScale: number,
  targetScale: number,
  deltaSeconds: number,
) {
  'worklet';
  const current = Math.min(1, Math.max(PARTICLE_NEIGHBOR_MIN_SCALE, currentScale));
  const target = Math.min(1, Math.max(PARTICLE_NEIGHBOR_MIN_SCALE, targetScale));
  const delta = Math.min(0.05, Math.max(0, deltaSeconds));
  const response = 1 - Math.exp(-PARTICLE_NEIGHBOR_SCALE_RESPONSE * delta);
  return current + (target - current) * response;
}

export function getParticlePairSeparationCorrection(
  centerDistance: number,
  firstRadius: number,
  secondRadius: number,
  sizeRatio: number,
) {
  'worklet';
  if (sizeRatio <= 0) {
    return 0;
  }

  const minimumCenterDistance =
    Math.max(0, firstRadius) +
    Math.max(0, secondRadius) +
    PARTICLE_PAIR_CLEARANCE * sizeRatio;
  return Math.max(0, minimumCenterDistance - Math.max(0, centerDistance));
}

export function getParticlePairCorrectionWeights(
  firstAnchored: boolean,
  secondAnchored: boolean,
) {
  'worklet';
  if (firstAnchored && !secondAnchored) {
    return { first: 0, second: 1 };
  }
  if (!firstAnchored && secondAnchored) {
    return { first: 1, second: 0 };
  }
  return { first: 0.5, second: 0.5 };
}

function getCarrierMinimumCenterDistance(
  particleRadius: number,
  carrierRadius: number,
  strength: number,
  sizeRatio: number,
  clearance?: number,
) {
  'worklet';
  const activeStrength = clampUnit(strength);
  if (activeStrength <= 0 || sizeRatio <= 0) {
    return 0;
  }

  return (
    Math.max(0, particleRadius) +
    Math.max(0, carrierRadius) +
    Math.max(0, clearance ?? PARTICLE_ICON_CLEARANCE) * sizeRatio
  );
}

export function getCarrierClearanceCorrection(
  centerDistance: number,
  particleRadius: number,
  carrierRadius: number,
  strength: number,
  sizeRatio: number,
  clearance?: number,
) {
  'worklet';
  const minimumCenterDistance = getCarrierMinimumCenterDistance(
    particleRadius,
    carrierRadius,
    strength,
    sizeRatio,
    clearance,
  );

  if (minimumCenterDistance <= 0) {
    return 0;
  }

  return Math.max(0, minimumCenterDistance - Math.max(0, centerDistance));
}

export function getRepulsionDisplacement(
  centerDistance: number,
  particleRadius: number,
  carrierRadius: number,
  strength: number,
  sizeRatio: number,
  clearance?: number,
) {
  'worklet';
  const activeStrength = clampUnit(strength);
  if (activeStrength <= 0 || sizeRatio <= 0) {
    return 0;
  }

  const softRange = REPULSION_SOFT_RANGE * sizeRatio;
  const minimumCenterDistance = getCarrierMinimumCenterDistance(
    particleRadius,
    carrierRadius,
    activeStrength,
    sizeRatio,
    clearance,
  );
  const distance = Math.max(0, centerDistance);

  if (distance >= minimumCenterDistance + softRange) {
    return 0;
  }

  // Start the spring before contact, but never attenuate actual penetration:
  // the hard constraint must reserve the carrier's full current visual radius.
  const requiredDisplacement = getCarrierClearanceCorrection(
    distance,
    particleRadius,
    carrierRadius,
    activeStrength,
    sizeRatio,
    clearance,
  );
  const proximity =
    1 - clampUnit((distance - minimumCenterDistance) / Math.max(softRange, 0.001));
  const anticipation = softRange * 0.15 * proximity * proximity;

  return Math.min(
    REPULSION_MAX_OFFSET * sizeRatio,
    Math.max(requiredDisplacement, anticipation * activeStrength),
  );
}

export function getCarrierRayDisplacement(
  deltaX: number,
  deltaY: number,
  particleRadius: number,
  carrierRadius: number,
  strength: number,
  sizeRatio: number,
  clearance?: number,
) {
  'worklet';
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const displacement = getRepulsionDisplacement(
    distance,
    particleRadius,
    carrierRadius,
    strength,
    sizeRatio,
    clearance,
  );
  if (displacement <= 0) {
    return { x: 0, y: 0 };
  }

  const safeDistance = Math.max(distance, 0.001);
  return {
    x: (deltaX / safeDistance) * displacement,
    y: (deltaY / safeDistance) * displacement,
  };
}
