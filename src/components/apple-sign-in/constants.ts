export const TAU = Math.PI * 2;

export const DEFAULT_STAGE_SIZE = 331;
export const STAGE_OFFSET_X_FACTOR = -0.0044;
export const STAGE_OFFSET_Y_FACTOR = 0.0276;
export const TEXT_OFFSET_Y_FACTOR = 0.0141;
export const PARTICLE_COUNT = 96;
export const PARTICLE_LANES = 4;
export const DOT_TEXTURE_SIZE = 128;
export const DOT_TEXTURE_RADIUS = 63;
export const AVATAR_SIZE_FACTOR = 0.47;
export const APPLE_SIZE_FACTOR = 0.28;

export const INTRO_DURATION_MS = 1050;
export const PARTICLE_INTRO_DURATION_MS = 800;
export const ORBIT_PERIOD_MS = 12000;
export const ORBIT_PHASE_OFFSET_DEGREES = -0.314;
export const MAX_FRAME_DELTA_MS = 32;
export const DEFAULT_ANIMATION_SPEED = 1;
export const MIN_ANIMATION_SPEED = 0.25;
export const MAX_ANIMATION_SPEED = 4;
export const ANIMATION_SPEED_MODES = {
  slow: 0.5,
  normal: 1,
  fast: 2,
} as const;

export const ICON_FIRST_START_MS = 800;
export const ICON_INTERVAL_MS = 1500;
export const ICON_DURATION_MS = 1700;
export const ICON_GROW_MS = 290;
export const ICON_SHRINK_START_MS = 850;
export const ICON_RESTING_SCALE = 0.182995745;
export const ICON_ARTWORK_FADE_SCALE_DELTA = 0.3;
export const ICON_BOX_SIZE = 90.384615385;

export const PARTICLE_ICON_CLEARANCE = 5;
export const PARTICLE_PAIR_CLEARANCE = 5;
export const CARRIER_NEIGHBOR_OUTWARD_OFFSET = 12;
export const CARRIER_BRIDGE_OUTWARD_OFFSET = 14;
export const CARRIER_CENTER_INWARD_OFFSET = 26;
export const PARTICLE_NEIGHBOR_MIN_SCALE = 0.58;
export const PARTICLE_NEIGHBOR_SCALE_RESPONSE = 14;
export const REPULSION_MAX_OFFSET = 46;
export const REPULSION_SOFT_RANGE = 20;
export const SPRING_STIFFNESS = 96;
export const SPRING_DAMPING = 18;

export const INTRO_BLUE = [0.24, 0.53, 0.92] as const;

export interface ParticleMeta {
  angle: number;
  radiusFactor: number;
  dotRadiusFactor: number;
  revealDelay: number;
}

// Measurements from the reference put the first row just outside the avatar,
// followed by three outward rows on exact concentric circles.
const laneRadii = [
  0.304229607,
  0.346394763,
  0.383635448,
  0.437734139,
] as const;
// Apparent lane radii measured at the native 3× framebuffer.
const laneDotRadii = [
  0.014431017,
  0.018650554,
  0.017945619,
  0.024984894,
] as const;

export const PARTICLES: ParticleMeta[] = (() => {
  const particles: ParticleMeta[] = [];
  const dotsPerLane = PARTICLE_COUNT / PARTICLE_LANES;

  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const lane = index % PARTICLE_LANES;
    const slot = Math.floor(index / PARTICLE_LANES);
    const baseAngle = (slot / dotsPerLane) * TAU;
    // Alternating half-step phase creates the clean radial lattice in the
    // reference: every dot stays on an exact concentric circular arc.
    const lanePhase = lane % 2 === 0 ? 0 : TAU / dotsPerLane / 2;
    const angle = baseAngle + lanePhase;

    particles.push({
      angle,
      radiusFactor: laneRadii[lane],
      dotRadiusFactor: laneDotRadii[lane],
      // The modular order creates an angle/index-based growing wave instead of
      // revealing all 96 particles at once.
      revealDelay: (((slot * 5 + lane * 11) % dotsPerLane) / dotsPerLane) * 0.42,
    });
  }

  return particles;
})();

type ColorStop = {
  at: number;
  rgb: readonly [number, number, number];
};

const COLOR_STOPS: ColorStop[] = [
  { at: 0, rgb: [0.6481, 0.3644, 0.8077] },
  { at: 0.12, rgb: [0.5204, 0.4438, 0.9178] },
  { at: 0.25, rgb: [0.5047, 0.7263, 0.9175] },
  { at: 0.38, rgb: [0.7629, 0.7879, 0.7529] },
  { at: 0.5, rgb: [0.8747, 0.7479, 0.6191] },
  { at: 0.62, rgb: [0.8898, 0.6237, 0.5132] },
  { at: 0.75, rgb: [0.8345, 0.4229, 0.4616] },
  { at: 0.87, rgb: [0.7759, 0.3873, 0.6345] },
  { at: 1, rgb: [0.6481, 0.3644, 0.8077] },
];

export const COLOR_LUT_SIZE = 256;
export const COLOR_LUT_R: number[] = [];
export const COLOR_LUT_G: number[] = [];
export const COLOR_LUT_B: number[] = [];

for (let index = 0; index < COLOR_LUT_SIZE; index += 1) {
  const at = index / (COLOR_LUT_SIZE - 1);
  let stopIndex = 0;

  while (
    stopIndex < COLOR_STOPS.length - 2 &&
    at > COLOR_STOPS[stopIndex + 1].at
  ) {
    stopIndex += 1;
  }

  const from = COLOR_STOPS[stopIndex];
  const to = COLOR_STOPS[stopIndex + 1];
  const progress = (at - from.at) / (to.at - from.at);

  COLOR_LUT_R.push(from.rgb[0] + (to.rgb[0] - from.rgb[0]) * progress);
  COLOR_LUT_G.push(from.rgb[1] + (to.rgb[1] - from.rgb[1]) * progress);
  COLOR_LUT_B.push(from.rgb[2] + (to.rgb[2] - from.rgb[2]) * progress);
}
