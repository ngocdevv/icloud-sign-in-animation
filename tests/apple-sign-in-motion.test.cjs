const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const sourceDir = path.join(
  __dirname,
  '..',
  'src',
  'components',
  'apple-sign-in',
);
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apple-sign-in-motion-'));

for (const fileName of ['constants.ts', 'motion.ts', 'particlePhysics.ts']) {
  const source = fs.readFileSync(path.join(sourceDir, fileName), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  fs.writeFileSync(path.join(outDir, fileName.replace('.ts', '.js')), output);
}

const constants = require(path.join(outDir, 'constants.js'));
const motion = require(path.join(outDir, 'motion.js'));
const physics = require(path.join(outDir, 'particlePhysics.js'));

test.after(() => fs.rmSync(outDir, { recursive: true, force: true }));

test('particle field uses the four measured lane radii', () => {
  assert.equal(constants.PARTICLE_LANES, 4);
  const expectedPixelRadii = [302.1, 343.97, 380.95, 434.67];

  for (let lane = 0; lane < constants.PARTICLE_LANES; lane += 1) {
    const particle = constants.PARTICLES[lane];
    const pixelRadius =
      particle.radiusFactor * constants.DEFAULT_STAGE_SIZE * 3;
    assert.ok(
      Math.abs(pixelRadius - expectedPixelRadii[lane]) <= 0.02,
      `lane ${lane}: ${pixelRadius}`,
    );
  }
});

test('particle dot sizes match the measured lane radii', () => {
  const expectedPixelRadii = [14.33, 18.52, 17.82, 24.81];
  const dotsPerLane = constants.PARTICLE_COUNT / constants.PARTICLE_LANES;

  for (let slot = 0; slot < dotsPerLane; slot += 1) {
    for (let lane = 0; lane < constants.PARTICLE_LANES; lane += 1) {
      const particle =
        constants.PARTICLES[slot * constants.PARTICLE_LANES + lane];
      const pixelRadius =
        particle.dotRadiusFactor * constants.DEFAULT_STAGE_SIZE * 3;
      assert.ok(
        Math.abs(pixelRadius - expectedPixelRadii[lane]) <= 0.02,
        `slot ${slot}, lane ${lane}: ${pixelRadius}`,
      );
    }
  }
});

test('particle sizes and inner-ring gap match the reference proportions', () => {
  assert.ok(Number.isFinite(constants.AVATAR_SIZE_FACTOR));

  const laneSamples = Array.from({ length: constants.PARTICLE_LANES }, (_, lane) =>
    constants.PARTICLES.filter((_, index) => index % constants.PARTICLE_LANES === lane),
  );
  const median = (values) => {
    const sorted = values.slice().sort((left, right) => left - right);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const innerRadius = median(laneSamples[0].map((particle) => particle.radiusFactor));
  const innerDotRadius = median(
    laneSamples[0].map((particle) => particle.dotRadiusFactor),
  );
  const outerDotRadius = median(
    laneSamples.at(-1).map((particle) => particle.dotRadiusFactor),
  );
  const centerlineGap = innerRadius - constants.AVATAR_SIZE_FACTOR / 2;

  assert.ok(centerlineGap >= 0.05 && centerlineGap <= 0.075);
  assert.ok(innerDotRadius > 0.012);
  assert.ok(outerDotRadius > 0.022);
});

test('each lane is an exact concentric circle with one dot size', () => {
  for (let lane = 0; lane < constants.PARTICLE_LANES; lane += 1) {
    const particles = constants.PARTICLES.filter(
      (_, index) => index % constants.PARTICLE_LANES === lane,
    );
    const radii = particles.map((particle) => particle.radiusFactor);
    const dotRadii = particles.map((particle) => particle.dotRadiusFactor);

    assert.ok(Math.max(...radii) - Math.min(...radii) < 1e-12);
    assert.ok(Math.max(...dotRadii) - Math.min(...dotRadii) < 1e-12);
  }
});

test('concentric lanes use a uniform angle step and alternating half-step phase', () => {
  const dotsPerLane = constants.PARTICLE_COUNT / constants.PARTICLE_LANES;
  const angleStep = constants.TAU / dotsPerLane;

  for (let slot = 0; slot < dotsPerLane; slot += 1) {
    for (let lane = 0; lane < constants.PARTICLE_LANES; lane += 1) {
      const particle = constants.PARTICLES[
        slot * constants.PARTICLE_LANES + lane
      ];
      const expectedAngle =
        slot * angleStep + (lane % 2 === 0 ? 0 : angleStep / 2);

      assert.ok(
        Math.abs(particle.angle - expectedAngle) < 1e-12,
        `slot ${slot}, lane ${lane}`,
      );
    }
  }
});

test('an enlarged icon carrier stays on its selected particle angle', () => {
  const startAngle = Math.PI / 3;
  const firstFrame = motion.getIconFrame(
    constants.ICON_FIRST_START_MS + 500,
    0,
    4,
    constants.ICON_FIRST_START_MS,
    constants.ICON_INTERVAL_MS,
    startAngle,
  );
  const holdFrame = motion.getIconFrame(
    constants.ICON_FIRST_START_MS + 1200,
    0,
    4,
    constants.ICON_FIRST_START_MS,
    constants.ICON_INTERVAL_MS,
    startAngle,
  );

  assert.equal(firstFrame.angle, startAngle);
  assert.equal(holdFrame.angle, startAngle);
});

test('icon carrier grows from the resting size of its outer particle', () => {
  assert.ok(
    Number.isFinite(constants.ICON_RESTING_SCALE),
    'ICON_RESTING_SCALE must define the particle-sized carrier state',
  );

  const frame = motion.getIconFrame(
    constants.ICON_FIRST_START_MS,
    0,
    4,
    constants.ICON_FIRST_START_MS,
    constants.ICON_INTERVAL_MS,
    0,
  );

  assert.ok(
    Math.abs(frame.scale - constants.ICON_RESTING_SCALE) < 1e-9,
    'carrier starts at the resting particle scale',
  );
});

test('resting and peak icon carrier sizes match the reference', () => {
  const outerDots = constants.PARTICLES.filter(
    (_, index) => index % constants.PARTICLE_LANES === constants.PARTICLE_LANES - 1,
  )
    .map((particle) => particle.dotRadiusFactor)
    .sort((left, right) => left - right);
  const medianOuterDiameter =
    outerDots[Math.floor(outerDots.length / 2)] * constants.DEFAULT_STAGE_SIZE * 2;
  const restingCarrierDiameter = constants.ICON_BOX_SIZE * constants.ICON_RESTING_SCALE;
  const peakCarrierRadiusPixels =
    (constants.ICON_BOX_SIZE * 1.04 * 3) / 2;

  assert.ok(Math.abs(restingCarrierDiameter - medianOuterDiameter) <= 0.02);
  assert.ok(Math.abs(peakCarrierRadiusPixels - 141) <= 0.02);
});

test('particle collision radius matches the Atlas entrance scale', () => {
  assert.equal(typeof motion.getParticleVisualRadius, 'function');

  const size = constants.DEFAULT_STAGE_SIZE;
  const dotRadiusFactor = 0.021;
  const introProgress = 0.2;
  const revealDelay = 0.15;
  const entrance = motion.particleEntrance(introProgress, revealDelay, 0);
  const entranceScale = motion.mix(
    0.2,
    1,
    motion.easeOutCubic(entrance),
  );
  const expectedRadius =
    size *
    dotRadiusFactor *
    Math.min(entranceScale, motion.getParticleIntroSizeCap(introProgress, 0));
  const visualRadius = motion.getParticleVisualRadius(
    size,
    dotRadiusFactor,
    introProgress,
    revealDelay,
    0,
  );

  assert.ok(Math.abs(visualRadius - expectedRadius) < 1e-12);
  assert.ok(visualRadius < size * dotRadiusFactor);
});

test('the selected Atlas particle itself expands into the carrier', () => {
  assert.equal(typeof physics.getCarrierParticleRadius, 'function');

  const restingParticleRadius = 8.4;
  assert.equal(
    physics.getCarrierParticleRadius(restingParticleRadius, 1.04, 1, false),
    restingParticleRadius,
  );
  assert.ok(
    Math.abs(
      physics.getCarrierParticleRadius(restingParticleRadius, 1.04, 1, true) -
        (constants.ICON_BOX_SIZE * 1.04) / 2,
    ) < 1e-12,
  );
});

test('the shared Atlas texture has enough resolution for the enlarged particle', () => {
  assert.ok(constants.DOT_TEXTURE_SIZE >= constants.ICON_BOX_SIZE);
  assert.ok(constants.DOT_TEXTURE_RADIUS >= constants.ICON_BOX_SIZE / 2);
});

test('particles nearest an enlarged carrier reduce their visual size', () => {
  assert.equal(typeof physics.getNeighborParticleScale, 'function');

  const particleRadius = 8;
  const carrierRadius = 42;
  const contactDistance =
    particleRadius + carrierRadius + constants.PARTICLE_ICON_CLEARANCE;
  const nearScale = physics.getNeighborParticleScale(
    contactDistance - 4,
    particleRadius,
    carrierRadius,
    1,
    1,
  );
  const farScale = physics.getNeighborParticleScale(
    contactDistance + constants.REPULSION_SOFT_RANGE + 1,
    particleRadius,
    carrierRadius,
    1,
    1,
  );

  assert.equal(nearScale, constants.PARTICLE_NEIGHBOR_MIN_SCALE);
  assert.equal(farScale, 1);
  assert.equal(
    physics.getNeighborParticleScale(
      contactDistance - 4,
      particleRadius,
      carrierRadius,
      0,
      1,
    ),
    1,
  );
});

test('neighbor particle size eases down and restores without snapping', () => {
  assert.equal(typeof physics.approachNeighborParticleScale, 'function');

  const shrunken = physics.approachNeighborParticleScale(
    1,
    constants.PARTICLE_NEIGHBOR_MIN_SCALE,
    1 / 60,
  );
  const restored = physics.approachNeighborParticleScale(shrunken, 1, 1 / 60);

  assert.ok(shrunken < 1);
  assert.ok(shrunken > constants.PARTICLE_NEIGHBOR_MIN_SCALE);
  assert.ok(restored > shrunken);
  assert.ok(restored < 1);
});

test('affected particles stay on their carrier-centered base rays', () => {
  assert.equal(typeof physics.getCarrierRayDisplacement, 'function');

  const angularDelta = constants.TAU / 24;
  const deltaX = 150 * (Math.cos(angularDelta) - 1);
  const deltaY = 150 * Math.sin(angularDelta);
  const particleRadius = 5;
  const carrierRadius = 42;
  const displacement = physics.getCarrierRayDisplacement(
    deltaX,
    deltaY,
    particleRadius,
    carrierRadius,
    1,
    1,
  );
  const resultingDistance = Math.hypot(
    deltaX + displacement.x,
    deltaY + displacement.y,
  );
  const crossProduct = deltaX * displacement.y - deltaY * displacement.x;
  const dotProduct = deltaX * displacement.x + deltaY * displacement.y;

  assert.ok(Math.abs(crossProduct) < 1e-9);
  assert.ok(dotProduct > 0);
  assert.ok(
    Math.abs(
      resultingDistance -
        (particleRadius + carrierRadius + constants.PARTICLE_ICON_CLEARANCE),
    ) < 1e-9,
  );
  assert.deepEqual(
    physics.getCarrierRayDisplacement(
      deltaX,
      deltaY,
      particleRadius,
      carrierRadius,
      0,
      1,
    ),
    { x: 0, y: 0 },
  );
});

test('affected particles slide on their avatar orbit instead of leaving along the carrier ray', () => {
  assert.equal(typeof physics.getOrbitExclusionTarget, 'function');

  const orbitRadius = 150;
  const particleAngle = Math.PI / 12;
  const carrierOrbitRadius = 150;
  const carrierAngle = 0;
  const target = physics.getOrbitExclusionTarget(
    orbitRadius,
    particleAngle,
    carrierOrbitRadius,
    carrierAngle,
    8,
    42,
    1,
    1,
  );

  assert.ok(Math.abs(Math.hypot(target.x, target.y) - orbitRadius) < 1e-6);
  assert.ok(Math.atan2(target.y, target.x) > particleAngle);

  const carrierX = Math.cos(carrierAngle) * carrierOrbitRadius;
  const carrierY = Math.sin(carrierAngle) * carrierOrbitRadius;
  assert.ok(
    Math.hypot(target.x - carrierX, target.y - carrierY) >=
      42 + 8 + constants.PARTICLE_ICON_CLEARANCE - 1e-6,
  );

  const resting = physics.getOrbitExclusionTarget(
    orbitRadius,
    particleAngle,
    carrierOrbitRadius,
    carrierAngle,
    8,
    42,
    0,
    1,
  );
  assert.ok(
    Math.abs(resting.x - Math.cos(particleAngle) * orbitRadius) < 1e-6,
  );
  assert.ok(
    Math.abs(resting.y - Math.sin(particleAngle) * orbitRadius) < 1e-6,
  );
});

test('same-ray inner particle moves inward along the avatar ray', () => {
  const innerRadius = 119;
  const carrierOrbitRadius = 151;
  const target = physics.getOrbitExclusionTarget(
    innerRadius,
    0,
    carrierOrbitRadius,
    0,
    6,
    42,
    1,
    1,
  );

  assert.ok(Math.abs(Math.atan2(target.y, target.x)) < 1e-6);
  assert.ok(Math.hypot(target.x, target.y) < innerRadius);
  assert.ok(
    Math.hypot(target.x - carrierOrbitRadius, target.y) >=
      42 + 6 + constants.PARTICLE_ICON_CLEARANCE - 1e-6,
  );
});

test('adjacent carrier particles receive a small additive outward bias', () => {
  assert.equal(typeof physics.getCarrierNeighborRadialBias, 'function');
  assert.equal(constants.CARRIER_NEIGHBOR_OUTWARD_OFFSET, 12);
  assert.equal(physics.getCarrierNeighborRadialBias(1, 1), 12);
  assert.equal(physics.getCarrierNeighborRadialBias(0.5, 1), 6);
  assert.equal(physics.getCarrierNeighborRadialBias(0, 1), 0);
});

test('center particle moves inward to the reference radius', () => {
  assert.equal(typeof physics.getCarrierCenterInwardBias, 'function');
  assert.equal(constants.CARRIER_CENTER_INWARD_OFFSET, 26);
  assert.equal(physics.getCarrierCenterInwardBias(1, 1), 26);
  assert.equal(physics.getCarrierCenterInwardBias(0.5, 1), 13);
  assert.equal(physics.getCarrierCenterInwardBias(0, 1), 0);

  const centerParticle = constants.PARTICLES[1];
  const outerParticle = constants.PARTICLES[constants.PARTICLE_LANES - 1];
  const inwardRadius =
    constants.DEFAULT_STAGE_SIZE * centerParticle.radiusFactor -
    physics.getCarrierCenterInwardBias(1, 1);
  const outerRadius =
    constants.DEFAULT_STAGE_SIZE * outerParticle.radiusFactor;

  assert.ok(inwardRadius / outerRadius >= 0.61);
  assert.ok(inwardRadius / outerRadius <= 0.63);
});

test('adjacent endpoints satisfy outer orbit and carrier rim together', () => {
  assert.equal(typeof physics.getCarrierNeighborIntersection, 'function');

  const carrierOrbitRadius = 150;
  const radialBias = 12;
  const particleRadius = 5;
  const carrierRadius = 42;
  const point = physics.getCarrierNeighborIntersection(
    carrierOrbitRadius,
    0,
    radialBias,
    1,
    particleRadius,
    carrierRadius,
    1,
  );
  const mirrored = physics.getCarrierNeighborIntersection(
    carrierOrbitRadius,
    0,
    radialBias,
    -1,
    particleRadius,
    carrierRadius,
    1,
  );
  const desiredOrbitRadius = carrierOrbitRadius + radialBias;
  const desiredCarrierDistance =
    carrierRadius + particleRadius + constants.PARTICLE_ICON_CLEARANCE;

  assert.ok(
    Math.abs(Math.hypot(point.x, point.y) - desiredOrbitRadius) < 1e-9,
  );
  assert.ok(
    Math.abs(
      Math.hypot(point.x - carrierOrbitRadius, point.y) -
        desiredCarrierDistance,
    ) < 1e-9,
  );
  assert.ok(Math.abs(point.x - mirrored.x) < 1e-9);
  assert.ok(Math.abs(point.y + mirrored.y) < 1e-9);
});

test('carrier ray worklet dependency is declared before the caller', () => {
  const source = fs.readFileSync(
    path.join(sourceDir, 'particlePhysics.ts'),
    'utf8',
  );
  const dependencyIndex = source.indexOf(
    'export function getRepulsionDisplacement',
  );
  const callerIndex = source.indexOf(
    'export function getCarrierRayDisplacement',
  );

  assert.ok(dependencyIndex >= 0);
  assert.ok(callerIndex > dependencyIndex);
});

test('worklet signatures do not capture imported constants as defaults', () => {
  const source = fs.readFileSync(
    path.join(sourceDir, 'particlePhysics.ts'),
    'utf8',
  );

  assert.doesNotMatch(
    source,
    /clearance:\s*number\s*=\s*PARTICLE_ICON_CLEARANCE/,
  );
});

test('particle pairs reserve the same visible edge gap near a carrier', () => {
  assert.equal(typeof physics.getParticlePairSeparationCorrection, 'function');

  const leftRadius = 5;
  const rightRadius = 7;
  const centerDistance = 11;
  const correction = physics.getParticlePairSeparationCorrection(
    centerDistance,
    leftRadius,
    rightRadius,
    1,
  );
  const resultingEdgeGap =
    centerDistance + correction - leftRadius - rightRadius;

  assert.ok(
    Math.abs(resultingEdgeGap - constants.PARTICLE_PAIR_CLEARANCE) < 1e-9,
  );
  assert.equal(
    physics.getParticlePairSeparationCorrection(
      leftRadius + rightRadius + constants.PARTICLE_PAIR_CLEARANCE + 1,
      leftRadius,
      rightRadius,
      1,
    ),
    0,
  );
});

test('pair separation preserves an active carrier endpoint anchor', () => {
  assert.equal(typeof physics.getParticlePairCorrectionWeights, 'function');
  assert.deepEqual(
    physics.getParticlePairCorrectionWeights(true, false),
    { first: 0, second: 1 },
  );
  assert.deepEqual(
    physics.getParticlePairCorrectionWeights(false, true),
    { first: 1, second: 0 },
  );
  assert.deepEqual(
    physics.getParticlePairCorrectionWeights(false, false),
    { first: 0.5, second: 0.5 },
  );
});

test('repulsion preserves edge clearance around an enlarged carrier', () => {
  assert.equal(typeof physics.getRepulsionDisplacement, 'function');

  const particleRadius = 7;
  const carrierRadius = 42;
  const centerDistance = 30;
  const displacement = physics.getRepulsionDisplacement(
    centerDistance,
    particleRadius,
    carrierRadius,
    1,
    1,
  );
  const resultingEdgeGap =
    centerDistance + displacement - particleRadius - carrierRadius;

  assert.ok(resultingEdgeGap >= constants.PARTICLE_ICON_CLEARANCE);
  assert.equal(
    physics.getRepulsionDisplacement(100, particleRadius, carrierRadius, 1, 1),
    0,
  );
  assert.equal(
    physics.getRepulsionDisplacement(centerDistance, particleRadius, carrierRadius, 0, 1),
    0,
  );
});

test('a growing carrier keeps the fixed rim gap at partial strength', () => {
  const particleRadius = 7;
  const carrierRadius = 28;
  const centerDistance = 25;
  const strength = 0.5;
  const displacement = physics.getRepulsionDisplacement(
    centerDistance,
    particleRadius,
    carrierRadius,
    strength,
    1,
  );
  const resultingEdgeGap =
    centerDistance + displacement - particleRadius - carrierRadius;

  assert.ok(resultingEdgeGap >= constants.PARTICLE_ICON_CLEARANCE);
});

test('circle constraint projects the rendered particle onto the carrier rim', () => {
  assert.equal(typeof physics.getCarrierClearanceCorrection, 'function');

  const particleRadius = 7;
  const carrierRadius = 42;
  const centerDistance = 35;
  const correction = physics.getCarrierClearanceCorrection(
    centerDistance,
    particleRadius,
    carrierRadius,
    1,
    1,
  );
  const projectedEdgeGap =
    centerDistance + correction - particleRadius - carrierRadius;

  assert.ok(
    Math.abs(projectedEdgeGap - constants.PARTICLE_ICON_CLEARANCE) < 1e-9,
  );
  assert.equal(
    physics.getCarrierClearanceCorrection(60, particleRadius, carrierRadius, 1, 1),
    0,
  );
});

test('carrier rim clearance matches the close offset in the reference', () => {
  const heldCarrierRadius = (constants.ICON_BOX_SIZE * 1.04) / 2;
  const clearanceRatio =
    constants.PARTICLE_ICON_CLEARANCE / heldCarrierRadius;

  assert.ok(clearanceRatio >= 0.09 && clearanceRatio <= 0.13);
});

test('repulsion remains active while an enlarged carrier fades out', () => {
  assert.equal(typeof physics.getCarrierRepulsionStrength, 'function');

  const fadingFrame = motion.getIconFrame(
    constants.ICON_FIRST_START_MS + 1600,
    0,
    4,
    constants.ICON_FIRST_START_MS,
    constants.ICON_INTERVAL_MS,
    0,
  );

  assert.ok(fadingFrame.opacity < 0.5);
  assert.ok(fadingFrame.scale > constants.ICON_RESTING_SCALE * 2);
  assert.ok(physics.getCarrierRepulsionStrength(fadingFrame.scale) > 0.3);
});

test('default icon carriers select particles from the outer lane', () => {
  for (let iconIndex = 0; iconIndex < 4; iconIndex += 1) {
    const targetAngle = -Math.PI / 2 + (iconIndex / 4) * Math.PI * 2;
    const particleIndex = motion.findClosestOuterParticleIndex(targetAngle);

    assert.equal(
      particleIndex % constants.PARTICLE_LANES,
      constants.PARTICLE_LANES - 1,
    );
  }
});

test('each carrier has exactly two adjacent particles on the same lane', () => {
  assert.equal(typeof motion.findAdjacentLaneParticleIndices, 'function');

  const carrierIndex = motion.findClosestOuterParticleIndex(-Math.PI / 2);
  const neighbors = motion.findAdjacentLaneParticleIndices(carrierIndex);
  const dotsPerLane = constants.PARTICLE_COUNT / constants.PARTICLE_LANES;
  const carrierSlot = Math.floor(carrierIndex / constants.PARTICLE_LANES);

  assert.equal(neighbors.length, 2);
  for (const neighborIndex of neighbors) {
    assert.equal(
      neighborIndex % constants.PARTICLE_LANES,
      carrierIndex % constants.PARTICLE_LANES,
    );
    const neighborSlot = Math.floor(neighborIndex / constants.PARTICLE_LANES);
    const directDistance = Math.abs(neighborSlot - carrierSlot);
    const circularDistance = Math.min(
      directDistance,
      dotsPerLane - directDistance,
    );
    assert.equal(circularDistance, 1);
  }
});

test('each carrier has two second-outer-lane bridge particles at 22.5 degrees', () => {
  assert.equal(typeof motion.findCarrierBridgeParticleIndices, 'function');

  const carrierIndices = Array.from({ length: 4 }, (_, iconIndex) =>
    motion.findClosestOuterParticleIndex(
      -Math.PI / 2 + (iconIndex / 4) * Math.PI * 2,
    ),
  );

  for (const carrierIndex of carrierIndices) {
    const carrier = constants.PARTICLES[carrierIndex];
    const bridgeIndices = motion.findCarrierBridgeParticleIndices(carrierIndex);
    const angularOffsets = bridgeIndices
      .map((index) => {
        assert.equal(
          index % constants.PARTICLE_LANES,
          constants.PARTICLE_LANES - 2,
        );
        const delta = constants.PARTICLES[index].angle - carrier.angle;
        return Math.atan2(Math.sin(delta), Math.cos(delta));
      })
      .sort((left, right) => left - right);

    assert.equal(bridgeIndices.length, 2);
    assert.ok(Math.abs(angularOffsets[0] + Math.PI / 8) < 1e-9);
    assert.ok(Math.abs(angularOffsets[1] - Math.PI / 8) < 1e-9);
  }
});

test('each carrier has one lane-1 center particle on the same angle', () => {
  assert.equal(typeof motion.findCarrierCenterParticleIndex, 'function');

  for (let iconIndex = 0; iconIndex < 4; iconIndex += 1) {
    const carrierIndex = motion.findClosestOuterParticleIndex(
      -Math.PI / 2 + (iconIndex / 4) * Math.PI * 2,
    );
    const centerIndex = motion.findCarrierCenterParticleIndex(carrierIndex);
    const carrier = constants.PARTICLES[carrierIndex];
    const centerParticle = constants.PARTICLES[centerIndex];
    const delta = centerParticle.angle - carrier.angle;
    const angularDistance = Math.abs(
      Math.atan2(Math.sin(delta), Math.cos(delta)),
    );

    assert.equal(centerIndex % constants.PARTICLE_LANES, 1);
    assert.ok(angularDistance < 1e-9);
  }
});

test('incoming artwork appears as the carrier leaves resting size', () => {
  const earlyFrame = motion.getIconFrame(
    constants.ICON_FIRST_START_MS + 60,
    0,
    4,
    constants.ICON_FIRST_START_MS,
    constants.ICON_INTERVAL_MS,
    0,
  );

  assert.ok(earlyFrame.scale > constants.ICON_RESTING_SCALE + 0.22);
  assert.ok(earlyFrame.glyphOpacity >= 0.75 && earlyFrame.glyphOpacity <= 0.9);
  assert.ok(physics.getCarrierRepulsionStrength(earlyFrame.scale) > 0);
});

test('icon glyph appears only after its carrier starts growing', () => {
  const startFrame = motion.getIconFrame(
    constants.ICON_FIRST_START_MS,
    0,
    4,
    constants.ICON_FIRST_START_MS,
    constants.ICON_INTERVAL_MS,
    0,
  );
  const holdFrame = motion.getIconFrame(
    constants.ICON_FIRST_START_MS + 600,
    0,
    4,
    constants.ICON_FIRST_START_MS,
    constants.ICON_INTERVAL_MS,
    0,
  );

  assert.equal(startFrame.glyphOpacity, 0);
  assert.ok(holdFrame.glyphOpacity > 0.99);
});

test('animation speed defaults to real time and clamps out-of-range values', () => {
  assert.equal(constants.DEFAULT_ANIMATION_SPEED, 1);
  assert.equal(motion.resolveAnimationSpeed(), 1);
  assert.equal(motion.resolveAnimationSpeed(1), 1);
  assert.equal(motion.resolveAnimationSpeed(2), 2);
  assert.equal(motion.resolveAnimationSpeed(0.5), 0.5);
  assert.equal(
    motion.resolveAnimationSpeed(constants.MIN_ANIMATION_SPEED - 1),
    constants.MIN_ANIMATION_SPEED,
  );
  assert.equal(
    motion.resolveAnimationSpeed(constants.MAX_ANIMATION_SPEED + 8),
    constants.MAX_ANIMATION_SPEED,
  );
  assert.equal(motion.resolveAnimationSpeed(Number.NaN), 1);
  assert.equal(motion.resolveAnimationSpeed(Number.POSITIVE_INFINITY), 1);
});

test('named speed modes map onto clamped playback rates', () => {
  assert.deepEqual(constants.ANIMATION_SPEED_MODES, {
    slow: 0.5,
    normal: 1,
    fast: 2,
  });
  assert.equal(motion.resolveAnimationSpeed('slow'), 0.5);
  assert.equal(motion.resolveAnimationSpeed('normal'), 1);
  assert.equal(motion.resolveAnimationSpeed('fast'), 2);
});

test('playhead delta scales with speed and keeps the existing frame clamp', () => {
  const frameMs = 16;
  const spikedMs = 80;

  assert.equal(motion.getPlayheadDeltaMs(frameMs, 1), frameMs);
  assert.equal(motion.getPlayheadDeltaMs(frameMs, 2), frameMs * 2);
  assert.equal(motion.getPlayheadDeltaMs(frameMs, 0.5), frameMs * 0.5);
  assert.equal(
    motion.getPlayheadDeltaMs(spikedMs, 1),
    constants.MAX_FRAME_DELTA_MS,
  );
  assert.equal(
    motion.getPlayheadDeltaMs(spikedMs, 2),
    constants.MAX_FRAME_DELTA_MS * 2,
  );
  assert.equal(
    motion.getPlayheadDeltaMs(null, 1),
    1000 / 60,
  );
});

test('ParticleRing advances the playhead with the resolved speed', () => {
  const types = fs.readFileSync(path.join(sourceDir, 'types.ts'), 'utf8');
  const animation = fs.readFileSync(
    path.join(sourceDir, 'AppleSignInAnimation.tsx'),
    'utf8',
  );
  const ring = fs.readFileSync(path.join(sourceDir, 'ParticleRing.tsx'), 'utf8');

  assert.match(types, /speed\?:\s*number\s*\|\s*AppleSignInSpeedMode/);
  assert.match(animation, /speed\s*=\s*DEFAULT_ANIMATION_SPEED/);
  assert.match(ring, /getPlayheadDeltaMs\(/);
  assert.match(ring, /resolveAnimationSpeed\(/);
  assert.match(
    ring,
    /const playbackSpeed = useDerivedValue\(\(\) =>\s*resolveAnimationSpeed\(speed\)/,
  );
  assert.doesNotMatch(ring, /playbackSpeed\.value\s*=/);
});

test('ParticleRing waits for its Atlas texture before advancing time', () => {
  const ring = fs.readFileSync(path.join(sourceDir, 'ParticleRing.tsx'), 'utf8');
  const textureIndex = ring.indexOf('const texture = useTexture(');
  const callbackIndex = ring.indexOf('useFrameCallback((frame) =>');

  assert.ok(textureIndex >= 0 && textureIndex < callbackIndex);
  assert.match(ring, /if \(!autoPlay \|\| !texture\) \{\s*return;/);
});

test('stage field includes wrapping particles around an enlarged carrier', () => {
  const size = constants.DEFAULT_STAGE_SIZE;
  const sizeRatio = size / constants.DEFAULT_STAGE_SIZE;
  const outerOrbit = Math.max(
    ...constants.PARTICLES.map((particle) => size * particle.radiusFactor),
  );
  const outerDot = Math.max(
    ...constants.PARTICLES.map((particle) => size * particle.dotRadiusFactor),
  );
  const wrapExtent =
    outerOrbit +
    (constants.ICON_BOX_SIZE * sizeRatio * 1.04) / 2 +
    outerDot +
    constants.PARTICLE_ICON_CLEARANCE * sizeRatio;
  const repulsionExtent =
    outerOrbit + constants.REPULSION_MAX_OFFSET * sizeRatio + outerDot;

  const overflow = motion.getStageOverflow(size);
  const fieldHalf = size / 2 + overflow;

  assert.ok(overflow > 0);
  assert.ok(fieldHalf + 1e-9 >= wrapExtent);
  assert.ok(fieldHalf + 1e-9 >= repulsionExtent);
  assert.equal(motion.getStageFieldSize(size), size + 2 * overflow);
});

test('the signed-in stage and Skia canvas use the unclipped field size', () => {
  const animation = fs.readFileSync(
    path.join(sourceDir, 'AppleSignInAnimation.tsx'),
    'utf8',
  );
  const ring = fs.readFileSync(path.join(sourceDir, 'ParticleRing.tsx'), 'utf8');
  const icons = fs.readFileSync(
    path.join(sourceDir, 'FloatingIcons.tsx'),
    'utf8',
  );

  assert.match(animation, /getStageFieldSize\(/);
  assert.match(ring, /getStageFieldSize\(/);
  assert.match(icons, /getStageOverflow\(/);
  assert.doesNotMatch(
    ring,
    /Canvas style=\{\{ width: size, height: size \}\}/,
  );
});

test('reference particle field opens in 0.8 seconds and turns every 12 seconds', () => {
  assert.equal(constants.PARTICLE_INTRO_DURATION_MS, 800);
  assert.equal(constants.ORBIT_PERIOD_MS, 12_000);
});

test('particle radius follows the measured per-frame expansion curve', () => {
  assert.equal(typeof motion.getParticleRadialScale, 'function');
  const samples = [
    [0, 0.3079],
    [100, 0.3451],
    [200, 0.458],
    [300, 0.636],
    [400, 0.8019],
    [500, 0.9117],
    [600, 0.9683],
    [700, 0.992],
    [800, 1],
  ];

  for (const [elapsedMs, expected] of samples) {
    assert.ok(
      Math.abs(motion.getParticleRadialScale(elapsedMs) - expected) <= 0.003,
      `${elapsedMs}ms`,
    );
  }
  assert.equal(motion.getParticleRadialScale(1_200), 1);
});

test('particle expansion uses its measured clock without shortening the avatar crossfade', () => {
  const animation = fs.readFileSync(
    path.join(sourceDir, 'AppleSignInAnimation.tsx'),
    'utf8',
  );

  assert.match(animation, /getParticleRadialScale\(playhead\.value\)/);
  assert.match(
    animation,
    /particleIntroProgress[\s\S]*PARTICLE_INTRO_DURATION_MS/,
  );
  assert.match(
    animation,
    /<CenterContent[\s\S]*introProgress=\{identityProgress\}/,
  );
  assert.match(
    animation,
    /<ParticleRing[\s\S]*introProgress=\{particleIntroProgress\}/,
  );
});

test('particle lattice unwinds through the measured intro angles', () => {
  assert.equal(typeof motion.getParticleOrbitRotation, 'function');
  const degrees = (elapsedMs) =>
    (motion.getParticleOrbitRotation(elapsedMs) * 180) / Math.PI;
  const samples = [
    [150, -64.6],
    [201.7, -57.0],
    [251.7, -47.3],
    [301.7, -37.5],
    [351.7, -29.5],
    [401.7, -23.1],
    [503.3, -13.7],
    [553.3, -10.3],
    [605, -7.4],
    [656.7, -5.0],
    [705, -3.0],
    [753.3, -1.3],
    [800, 0],
  ];

  for (const [elapsedMs, expected] of samples) {
    assert.ok(
      Math.abs(degrees(elapsedMs) - expected) <= 0.35,
      `${elapsedMs}ms: ${degrees(elapsedMs)}°`,
    );
  }
  assert.ok(Math.abs(degrees(1_300) - 14.686) < 1e-9);
});

test('staggered particles rotate clockwise while their alpha appears', () => {
  const degrees = (elapsedMs) =>
    (motion.getParticleOrbitRotation(elapsedMs) * 180) / Math.PI;
  const revealDelay = 0.105;
  const fromProgress = 0.075;
  const toProgress = 0.105;
  const fromAlpha = motion.particleEntrance(fromProgress, revealDelay, 0);
  const toAlpha = motion.particleEntrance(toProgress, revealDelay, 0);
  const fromMs = fromProgress * constants.PARTICLE_INTRO_DURATION_MS;
  const toMs = toProgress * constants.PARTICLE_INTRO_DURATION_MS;
  const clockwiseDelta = Math.atan2(
    Math.sin(motion.getParticleOrbitRotation(toMs) - motion.getParticleOrbitRotation(fromMs)),
    Math.cos(motion.getParticleOrbitRotation(toMs) - motion.getParticleOrbitRotation(fromMs)),
  );

  assert.ok(Math.abs(degrees(0) - -74.027) <= 0.35);
  assert.ok(Math.abs(degrees(100) - -68.808) <= 0.35);
  assert.ok(toAlpha > fromAlpha);
  assert.ok(clockwiseDelta > 0);
});

test('animation uses the measured orbit helper as its single rotation source', () => {
  const animation = fs.readFileSync(
    path.join(sourceDir, 'AppleSignInAnimation.tsx'),
    'utf8',
  );

  assert.match(animation, /getParticleOrbitRotation\(playhead\.value\)/);
  assert.doesNotMatch(animation, /introLandingRotation/);
});

test('service carriers use the measured 0.8/1.5/0.85/1.7 second envelope', () => {
  assert.equal(constants.ICON_FIRST_START_MS, 800);
  assert.equal(constants.ICON_INTERVAL_MS, 1_500);
  assert.equal(constants.ICON_GROW_MS, 290);
  assert.equal(constants.ICON_SHRINK_START_MS, 850);
  assert.equal(constants.ICON_DURATION_MS, 1_700);
});

test('default carriers advance by 45 degrees through the measured outer slots', () => {
  assert.equal(typeof motion.getDefaultIconStartAngle, 'function');
  const expectedCarrierAngles = [-82.5, -37.5, 7.5, 52.5];

  for (let iconIndex = 0; iconIndex < expectedCarrierAngles.length; iconIndex += 1) {
    const targetAngle = motion.getDefaultIconStartAngle(iconIndex);
    const carrierIndex = motion.findClosestOuterParticleIndex(targetAngle);
    const carrierAngle =
      (constants.PARTICLES[carrierIndex].angle * 180) / Math.PI;
    const normalizedAngle = ((carrierAngle + 180) % 360) - 180;

    assert.ok(
      Math.abs(normalizedAngle - expectedCarrierAngles[iconIndex]) < 1e-9,
      `icon ${iconIndex}: ${normalizedAngle}`,
    );
  }
});

test('default icon births advance clockwise through the reference quadrants', () => {
  const expectedScreenAngles = [-82.428, 7.678, 97.886, -172.174];
  const actualScreenAngles = expectedScreenAngles.map((_, iconIndex) => {
    const carrierIndex = motion.findClosestOuterParticleIndex(
      motion.getDefaultIconStartAngle(iconIndex),
    );
    const elapsedMs =
      constants.ICON_FIRST_START_MS +
      iconIndex * constants.ICON_INTERVAL_MS +
      20;
    const screenAngle =
      constants.PARTICLES[carrierIndex].angle +
      motion.getParticleOrbitRotation(elapsedMs);
    return (Math.atan2(Math.sin(screenAngle), Math.cos(screenAngle)) * 180) / Math.PI;
  });

  for (let index = 0; index < actualScreenAngles.length; index += 1) {
    const error = Math.atan2(
      Math.sin(((actualScreenAngles[index] - expectedScreenAngles[index]) * Math.PI) / 180),
      Math.cos(((actualScreenAngles[index] - expectedScreenAngles[index]) * Math.PI) / 180),
    );
    assert.ok(Math.abs((error * 180) / Math.PI) <= 0.5);
    if (index > 0) {
      const clockwiseDelta =
        ((actualScreenAngles[index] - actualScreenAngles[index - 1]) % 360 + 360) % 360;
      assert.ok(Math.abs(clockwiseDelta - 90) <= 0.01);
    }
  }
});

test('demo uses the supplied icon artwork in clockwise order', () => {
  const projectDir = path.join(__dirname, '..');
  const app = fs.readFileSync(path.join(projectDir, 'App.tsx'), 'utf8');
  const iconKeys = ['photos', 'weather', 'app-store', 'messages'];
  let previousIndex = -1;

  for (const key of iconKeys) {
    const sourceIndex = app.indexOf(`key: '${key}'`);
    const assetPath = `./assets/service-icons/${key}.png`;
    assert.ok(sourceIndex > previousIndex, `${key} order`);
    assert.ok(app.includes(`require('${assetPath}')`), assetPath);
    const bytes = fs.readFileSync(path.join(projectDir, assetPath));
    assert.deepEqual(Array.from(bytes.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
    previousIndex = sourceIndex;
  }

  assert.match(app, /icons=\{SERVICE_ICONS\}/);
  assert.match(app, /function CircularServiceIcon/);
  assert.match(
    app,
    /serviceIconMask:\s*\{[\s\S]*?width:\s*90[\s\S]*?height:\s*90[\s\S]*?borderRadius:\s*45[\s\S]*?overflow:\s*'hidden'/,
  );
  assert.match(
    app,
    /serviceIconImage:\s*\{[\s\S]*?width:\s*112[\s\S]*?height:\s*112/,
  );
});

test('animation selects default carriers with the measured 45-degree helper', () => {
  const animation = fs.readFileSync(
    path.join(sourceDir, 'AppleSignInAnimation.tsx'),
    'utf8',
  );

  assert.match(animation, /icon\.startAngle \?\? getDefaultIconStartAngle\(index\)/);
  assert.doesNotMatch(animation, /index \/ resolvedIcons\.length/);
});

test('intro starts with two seed lanes then reveals staggered lanes', () => {
  const readableAt = (progress) =>
    constants.PARTICLES.filter(
      (particle, index) =>
        motion.particleEntrance(
          progress,
          particle.revealDelay,
          index % constants.PARTICLE_LANES,
        ) >= 0.35,
    ).length;

  assert.equal(motion.particleEntrance(0, 0, 0), 0);
  assert.equal(motion.particleEntrance(0, 0, 2), 0);
  assert.ok(Math.abs(motion.particleEntrance(0, 0, 1) - 0.7) < 1e-9);
  assert.ok(Math.abs(motion.particleEntrance(0, 0, 3) - 0.7) < 1e-9);
  assert.equal(readableAt(0), 48);
  assert.equal(readableAt(0.24), 88);
  assert.equal(readableAt(0.34), constants.PARTICLE_COUNT);
});

test('angular particle colors bloom through the first 0.4 seconds', () => {
  assert.equal(typeof motion.getParticleColorBloom, 'function');
  const samples = [
    [0, 0.181],
    [0.125, 0.259],
    [0.1875, 0.469],
    [0.25, 0.603],
    [0.3125, 0.742],
    [0.375, 0.838],
    [0.4375, 0.914],
    [0.5, 0.997],
  ];

  for (const [progress, expected] of samples) {
    assert.ok(
      Math.abs(motion.getParticleColorBloom(progress) - expected) <= 0.004,
      `${progress}`,
    );
  }
});

test('Skia color LUT precompensates the measured screen colors', () => {
  const samples = [
    [0, [0.6481, 0.3644, 0.8077]],
    [0.12, [0.5204, 0.4438, 0.9178]],
    [0.25, [0.5047, 0.7263, 0.9175]],
    [0.38, [0.7629, 0.7879, 0.7529]],
    [0.5, [0.8747, 0.7479, 0.6191]],
    [0.62, [0.8898, 0.6237, 0.5132]],
    [0.75, [0.8345, 0.4229, 0.4616]],
    [0.87, [0.7759, 0.3873, 0.6345]],
  ];

  for (const [at, expected] of samples) {
    const index = Math.floor(at * (constants.COLOR_LUT_SIZE - 1));
    const actual = [
      constants.COLOR_LUT_R[index],
      constants.COLOR_LUT_G[index],
      constants.COLOR_LUT_B[index],
    ];
    for (let channel = 0; channel < 3; channel += 1) {
      assert.ok(
        Math.abs(actual[channel] - expected[channel]) <= 0.008,
        `${at}, channel ${channel}`,
      );
    }
  }
});

test('ParticleRing uses the measured color-bloom helper', () => {
  const ring = fs.readFileSync(path.join(sourceDir, 'ParticleRing.tsx'), 'utf8');

  assert.match(ring, /getParticleColorBloom\(introProgress\.value\)/);
  assert.doesNotMatch(ring, /smoothstep\(0\.08, 0\.62/);
});

test('carrier physics radius ignores the badge grow overshoot', () => {
  assert.equal(typeof physics.getCarrierPhysicsRadius, 'function');
  const held = physics.getCarrierPhysicsRadius(1.04, 1);
  const overshot = physics.getCarrierPhysicsRadius(1.123, 1);
  const growing = physics.getCarrierPhysicsRadius(0.6, 1);

  assert.ok(Math.abs(held - (constants.ICON_BOX_SIZE * 1.04) / 2) < 1e-12);
  assert.equal(overshot, held);
  assert.ok(growing < held);
});

test('same-ray exclusion stays continuous immediately outside the old hard cutoff', () => {
  const onAxis = physics.getOrbitExclusionTarget(
    119,
    0,
    151,
    0,
    6,
    42,
    1,
    1,
  );
  const justOffAxis = physics.getOrbitExclusionTarget(
    119,
    0.021,
    151,
    0,
    6,
    42,
    1,
    1,
  );

  assert.ok(
    Math.hypot(onAxis.x - justOffAxis.x, onAxis.y - justOffAxis.y) < 8,
  );
});

test('pass-two projection ignores far icons and pins the owned center particle', () => {
  assert.equal(typeof physics.applyOrbitExclusionProjection, 'function');

  const farCurrent = { x: 119, y: 0 };
  const ignored = physics.applyOrbitExclusionProjection(
    farCurrent.x,
    farCurrent.y,
    119,
    Math.PI,
    151,
    Math.PI,
    6,
    42,
    1,
    1,
    false,
  );
  assert.deepEqual(ignored, farCurrent);

  const pinned = physics.applyOrbitExclusionProjection(
    119 * Math.cos(0.08),
    119 * Math.sin(0.08),
    119,
    0.08,
    151,
    0,
    6,
    42,
    1,
    1,
    true,
  );
  assert.ok(Math.abs(Math.atan2(pinned.y, pinned.x)) < 1e-9);
  assert.ok(Math.hypot(pinned.x, pinned.y) < 119);
});

test('default stage matches the measured reference radius and avatar', () => {
  assert.equal(constants.DEFAULT_STAGE_SIZE, 331);
  assert.equal(constants.APPLE_SIZE_FACTOR, 0.28);
  const outerParticle = constants.PARTICLES.find(
    (_, index) => index % constants.PARTICLE_LANES === constants.PARTICLE_LANES - 1,
  );
  assert.ok(outerParticle);
  const outerRadius = constants.DEFAULT_STAGE_SIZE * outerParticle.radiusFactor;
  const avatarRadius =
    (constants.DEFAULT_STAGE_SIZE * constants.AVATAR_SIZE_FACTOR) / 2;

  assert.ok(outerRadius >= 144.5 && outerRadius <= 145.5);
  assert.ok(avatarRadius >= 77 && avatarRadius <= 79);
});

test('the padded Skia field does not increase the logical stage layout height', () => {
  const animation = fs.readFileSync(
    path.join(sourceDir, 'AppleSignInAnimation.tsx'),
    'utf8',
  );

  assert.match(animation, /const fieldOverflow = getStageOverflow\(size\)/);
  assert.match(
    animation,
    /<View style={{ width: size, height: size, overflow: 'visible' }}>/,
  );
  assert.match(
    animation,
    /position: 'absolute',[\s\S]*?left: -fieldOverflow,[\s\S]*?top: -fieldOverflow,[\s\S]*?width: fieldSize,[\s\S]*?height: fieldSize/,
  );
});

test('logical stage applies the measured reference-center offset', () => {
  assert.ok(
    Math.abs(constants.STAGE_OFFSET_X_FACTOR - -0.0044) < 0.00005,
  );
  assert.ok(
    Math.abs(constants.STAGE_OFFSET_Y_FACTOR - 0.0276) < 0.00005,
  );

  const animation = fs.readFileSync(
    path.join(sourceDir, 'AppleSignInAnimation.tsx'),
    'utf8',
  );
  assert.match(
    animation,
    /translateX: size \* STAGE_OFFSET_X_FACTOR/,
  );
  assert.match(
    animation,
    /translateY: size \* STAGE_OFFSET_Y_FACTOR/,
  );
});

test('text uses an independent measured vertical offset', () => {
  assert.ok(
    Math.abs(constants.TEXT_OFFSET_Y_FACTOR - 0.0141) < 0.00005,
  );
  const animation = fs.readFileSync(
    path.join(sourceDir, 'AppleSignInAnimation.tsx'),
    'utf8',
  );
  assert.match(
    animation,
    /translateY: size \* TEXT_OFFSET_Y_FACTOR/,
  );
});

test('particle dot size follows the measured inner and outer lane curves', () => {
  assert.equal(typeof motion.getParticleIntroSizeCap, 'function');
  const samples = [
    [0, 0.2, 0.4],
    [0.1875, 0.227, 0.471],
    [0.25, 0.333, 0.532],
    [0.3125, 0.437, 0.606],
    [0.375, 0.548, 0.693],
    [0.4375, 0.654, 0.776],
    [0.5, 0.745, 0.843],
    [0.625, 0.881, 0.934],
    [0.8125, 0.98, 0.99],
    [1, 1, 1],
  ];
  const size = 331;
  const dotRadiusFactor = 0.0245;
  const restRadius = size * dotRadiusFactor;
  for (const [progress, innerExpected, outerExpected] of samples) {
    assert.ok(
      Math.abs(motion.getParticleIntroSizeCap(progress, 0) - innerExpected) <
        1e-9,
    );
    assert.ok(
      Math.abs(motion.getParticleIntroSizeCap(progress, 3) - outerExpected) <
        1e-9,
    );
    const innerRadius = motion.getParticleVisualRadius(
      size,
      dotRadiusFactor,
      progress,
      0,
      0,
    );
    const outerRadius = motion.getParticleVisualRadius(
      size,
      dotRadiusFactor,
      progress,
      0,
      3,
    );
    assert.ok(Math.abs(innerRadius / restRadius - innerExpected) < 1e-9);
    assert.ok(Math.abs(outerRadius / restRadius - outerExpected) < 1e-9);
  }
});

test('center identity preserves Apple until the measured late crossfade', () => {
  assert.equal(typeof motion.getCenterIdentityFrame, 'function');

  const early = motion.getCenterIdentityFrame(0.05);
  assert.ok(early.blueAppleOpacity > 0.99);
  assert.ok(early.blackAppleOpacity < 0.01);
  assert.equal(early.avatarOpacity, 0);

  const navy = motion.getCenterIdentityFrame(0.381);
  assert.ok(Math.abs(navy.blackAppleOpacity - 0.418) <= 0.01);
  assert.equal(navy.avatarOpacity, 0);

  const appleHold = motion.getCenterIdentityFrame(0.765);
  assert.equal(appleHold.appleOpacity, 1);
  assert.ok(appleHold.blackAppleOpacity >= 0.94);
  assert.equal(appleHold.avatarOpacity, 0);

  const avatarLanding = motion.getCenterIdentityFrame(0.952);
  assert.ok(avatarLanding.appleOpacity < 0.1);
  assert.ok(avatarLanding.avatarOpacity > 0.9);
  assert.ok(avatarLanding.appleScale > early.appleScale);
});

test('CenterContent uses the shared measured identity frame', () => {
  const center = fs.readFileSync(path.join(sourceDir, 'CenterContent.tsx'), 'utf8');

  assert.match(center, /getCenterIdentityFrame\(introProgress\.value\)/);
  assert.match(center, /size \* APPLE_SIZE_FACTOR/);
  assert.match(center, /identityFrame\.value\.appleScale/);
  assert.match(center, /identityFrame\.value\.avatarOpacity/);
  assert.match(center, /color="#0669D2"/);
  assert.match(center, /color="#000000"/);
  assert.doesNotMatch(center, /smoothstep\(/);
});

test('service artwork follows carrier scale and fades only near resting size', () => {
  const at = (localMs) =>
    motion.getIconFrame(
      constants.ICON_FIRST_START_MS + localMs,
      0,
      4,
      constants.ICON_FIRST_START_MS,
      constants.ICON_INTERVAL_MS,
      0,
    );

  const floating = fs.readFileSync(path.join(sourceDir, 'FloatingIcons.tsx'), 'utf8');
  assert.equal(constants.ICON_ARTWORK_FADE_SCALE_DELTA, 0.3);

  const entering = at(36.7);
  assert.ok(entering.glyphOpacity >= 0.2 && entering.glyphOpacity <= 0.35);

  const growing = at(60);
  assert.ok(growing.glyphOpacity >= 0.75 && growing.glyphOpacity <= 0.9);

  const held = at(1_600);
  assert.ok(
    held.scale >
      constants.ICON_RESTING_SCALE + constants.ICON_ARTWORK_FADE_SCALE_DELTA,
  );
  assert.equal(held.glyphOpacity, 1);

  const fading = at(1_650);
  assert.ok(fading.glyphOpacity >= 0.55 && fading.glyphOpacity <= 0.8);

  const nearRest = at(1_690);
  assert.ok(
    nearRest.scale <
      constants.ICON_RESTING_SCALE + constants.ICON_ARTWORK_FADE_SCALE_DELTA,
  );
  assert.ok(nearRest.glyphOpacity >= 0.1 && nearRest.glyphOpacity <= 0.25);

  const ended = at(1_700);
  assert.equal(ended.glyphOpacity, 0);
  assert.match(floating, /transform: \[\{ scale: frame\.value\.scale \}\]/);
  assert.doesNotMatch(floating, /0\.72 \+ progress \* 0\.28/);
});

test('service morph progress follows the measured carrier track', () => {
  assert.equal(typeof motion.getIconMorphProgress, 'function');
  const samples = [
    [0, 0],
    [36.7, 0.114],
    [101.7, 0.531],
    [168.3, 0.91],
    [233.3, 0.995],
    [401.7, 0.916],
    [900, 0.9],
    [1203.3, 0.812],
    [1403.3, 0.663],
    [1505, 0.541],
    [1538.3, 0.487],
    [1591.7, 0.395],
    [1690, 0.092],
    [1700, 0],
  ];

  for (const [localMs, expected] of samples) {
    assert.ok(
      Math.abs(motion.getIconMorphProgress(localMs) - expected) <= 0.003,
      `${localMs}ms`,
    );
  }

  const heldFrame = motion.getIconFrame(
    constants.ICON_FIRST_START_MS + 900,
    0,
    4,
    constants.ICON_FIRST_START_MS,
    constants.ICON_INTERVAL_MS,
    0,
  );
  const heldStrength = physics.getCarrierRepulsionStrength(heldFrame.scale);
  assert.ok(Math.abs(heldStrength - 0.9) <= 0.003);
});

test('shared bridge particles retain every carrier owner', () => {
  assert.equal(typeof motion.buildCarrierBridgeOwners, 'function');
  assert.equal(typeof motion.isCarrierBridgeOwner, 'function');
  assert.equal(typeof motion.findStrongestCarrierOwner, 'function');

  const carrierIndices = [0, 1, 2, 3].map((index) =>
    motion.findClosestOuterParticleIndex(
      motion.getDefaultIconStartAngle(index),
    ),
  );
  const firstBridges = motion.findCarrierBridgeParticleIndices(carrierIndices[0]);
  const secondBridges = motion.findCarrierBridgeParticleIndices(carrierIndices[1]);
  const shared = firstBridges.find((index) => secondBridges.includes(index));
  assert.notEqual(shared, undefined);

  const owners = motion.buildCarrierBridgeOwners(carrierIndices);
  assert.deepEqual(owners[shared], [0, 1]);
  assert.equal(motion.isCarrierBridgeOwner(owners[shared], 0), true);
  assert.equal(motion.isCarrierBridgeOwner(owners[shared], 1), true);
  assert.equal(motion.isCarrierBridgeOwner(owners[shared], 2), false);
  assert.equal(motion.findStrongestCarrierOwner(owners[shared], [0.9, 0.2]), 0);
  assert.equal(motion.findStrongestCarrierOwner(owners[shared], [0.1, 0.8]), 1);
  assert.equal(motion.findStrongestCarrierOwner(owners[shared], [0, 0]), -1);
});

test('reference carrier response reproduces every measured local displacement', () => {
  assert.equal(typeof physics.getReferenceCarrierParticleResponse, 'function');
  const carrierIndex = motion.findClosestOuterParticleIndex(-Math.PI / 2);
  const carrierAngle = constants.PARTICLES[carrierIndex].angle;
  const wrap = (angle) =>
    Math.atan2(Math.sin(angle), Math.cos(angle));
  const findOnLane = (lane, relativeDegrees) => {
    const target = carrierAngle + (relativeDegrees * Math.PI) / 180;
    let closestIndex = lane;
    let closestDistance = Infinity;
    for (
      let index = lane;
      index < constants.PARTICLES.length;
      index += constants.PARTICLE_LANES
    ) {
      const distance = Math.abs(
        wrap(constants.PARTICLES[index].angle - target),
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    }
    return closestIndex;
  };
  const assertResponse = (
    lane,
    relativeDegrees,
    radialPixels,
    tangentialPixels,
    scale,
  ) => {
    const particleIndex = findOnLane(lane, relativeDegrees);
    const response = physics.getReferenceCarrierParticleResponse(
      particleIndex,
      carrierIndex,
      1,
      1,
    );
    assert.ok(Math.abs(response.radialOffset * 3 - radialPixels) < 1e-9);
    assert.ok(
      Math.abs(response.tangentialOffset * 3 - tangentialPixels) < 1e-9,
    );
    assert.ok(Math.abs(response.scale - scale) < 1e-9);
  };

  assertResponse(0, -7.5, -17.4, -15.1, 0.735);
  assertResponse(0, 7.5, -17.4, 15.1, 0.735);
  assertResponse(0, -22.5, -9.6, -11.2, 0.738);
  assertResponse(0, 22.5, -9.6, 11.2, 0.738);
  assertResponse(1, 0, -81.6, 0, 0.75);
  assertResponse(1, -15, -21.2, -22.6, 0.75);
  assertResponse(1, 15, -21.2, 22.6, 0.75);
  assertResponse(2, -7.5, 33.2, -120.9, 0.75);
  assertResponse(2, 7.5, 33.2, 120.9, 0.75);
  assertResponse(3, -15, 43.1, -45.2, 0.7);
  assertResponse(3, 15, 43.1, 45.2, 0.7);
  assertResponse(3, -30, 0, 0, 1);
  assertResponse(3, 30, 0, 0, 1);

  const half = physics.getReferenceCarrierParticleResponse(
    findOnLane(2, 7.5),
    carrierIndex,
    0.5,
    1,
  );
  assert.ok(Math.abs(half.radialOffset * 3 - 16.6) < 1e-9);
  assert.ok(Math.abs(half.tangentialOffset * 3 - 60.45) < 1e-9);
  assert.equal(half.scale, 0.875);
});

test('ParticleRing renders the measured response directly without residual drift', () => {
  const ring = fs.readFileSync(path.join(sourceDir, 'ParticleRing.tsx'), 'utf8');

  assert.match(ring, /getReferenceCarrierParticleResponse\(/);
  assert.match(
    ring,
    /radialOffsetX \+= Math\.cos\(angle\) \* response\.radialOffset/,
  );
  assert.match(
    ring,
    /tangentialOffsetX \+= -Math\.sin\(angle\) \* response\.tangentialOffset/,
  );
  assert.match(ring, /particleScale = Math\.min\(particleScale, response\.scale\)/);
  assert.doesNotMatch(ring, /useSharedValue<ParticlePhysicsState>/);
  assert.doesNotMatch(ring, /SPRING_STIFFNESS/);
  assert.doesNotMatch(ring, /getOrbitExclusionTarget\(/);
  assert.doesNotMatch(ring, /applyOrbitExclusionProjection\(/);
});
