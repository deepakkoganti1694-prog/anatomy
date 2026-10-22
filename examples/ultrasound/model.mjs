export const US = {
  c: 1540,
  f: 3.5,
  alpha: 0.5,
  radius: 50,
  fov: 64,
  lines: 128,
  samples: 256,
  depth: 120,
  press: 3,
  elements: 128,
  active: 32,
  focus: 60,
  range: 60,
  gel: { left: -92, right: 92, bottom: 134 },
  Z: { tissue: 1.63, fat: 1.38, fluid: 1.48, nylon: 2.9, calcium: 7.8, lens: 1.5, air: 0.0004 },
  fat: 14,
  calcium: { x: -30, d: 38, r: 4.5 },
  cyst: { x: 8, d: 72, r: 11 },
  wires: [30, 50, 70, 90, 110].map((d) => ({ x: 40, d, r: 0.6 })),
  speckle: -39,
  shadow: -26,
};

const usRad = (deg) => (deg * Math.PI) / 180;
export const usReflect = (a, b) => ((b - a) / (b + a)) ** 2;
export const usRoundTrip = (mm) => (2 * mm) / 1000 / US.c * 1e6;
export const usLineTime = () => usRoundTrip(US.depth);
export const usFrameRate = () => 1e6 / (usLineTime() * US.lines);
export const usWavelength = () => US.c / (US.f * 1e6) * 1000;
export const usPitch = () => (2 * US.radius * usRad(US.fov / 2)) / US.elements;
export const usAperture = () => usPitch() * US.active;
export const usLossPerMm = () => (2 * US.alpha * US.f) / 10;

export function usAngle(line) {
  return usRad(-US.fov / 2 + (US.fov * (line + 0.5)) / US.lines);
}

export function usPoint(theta, s) {
  const r = US.radius + s;
  return [r * Math.sin(theta), -(US.radius - US.press) + r * Math.cos(theta)];
}

export function usHalfWidth(s, focus = US.focus) {
  const edge = usAperture() / 2;
  const waist = (usWavelength() * focus) / usAperture() / 2;
  return Math.hypot(edge * (1 - s / focus), waist);
}

function usChord(theta, cx, cd, r) {
  const ux = Math.sin(theta);
  const ud = Math.cos(theta);
  const ox = 0;
  const od = -(US.radius - US.press);
  const px = cx - ox;
  const pd = cd - od;
  const along = px * ux + pd * ud;
  const off = Math.abs(px * ud - pd * ux);
  if (off >= r) return null;
  const half = Math.sqrt(r * r - off * off);
  return [along - half - US.radius, along + half - US.radius, off];
}

export function usEchoes(theta, focus = US.focus) {
  const out = [];
  const fatS = (US.fat + US.radius - US.press) / Math.cos(theta) - US.radius;
  out.push({ s: fatS, kind: "fat", label: "fat", reflect: usReflect(US.Z.fat, US.Z.tissue) });
  let blocked = Infinity;
  const calcium = usChord(theta, US.calcium.x, US.calcium.d, US.calcium.r);
  if (calcium) {
    out.push({ s: calcium[0], kind: "calcium", label: "calcium", reflect: usReflect(US.Z.tissue, US.Z.calcium) });
    blocked = calcium[0];
  }
  const cyst = usChord(theta, US.cyst.x, US.cyst.d, US.cyst.r);
  if (cyst) {
    out.push({ s: cyst[0], kind: "cyst", label: "cyst wall", reflect: usReflect(US.Z.tissue, US.Z.fluid) });
    out.push({ s: cyst[1], kind: "cyst", label: "cyst wall", reflect: usReflect(US.Z.fluid, US.Z.tissue) });
  }
  for (const [index, wire] of US.wires.entries()) {
    const hit = usChord(theta, wire.x, wire.d, Math.max(wire.r, 0.5));
    const along = usChord(theta, wire.x, wire.d, 400);
    if (!along) continue;
    const s = (along[0] + along[1]) / 2;
    const width = usHalfWidth(s, focus);
    const share = Math.exp(-((along[2] / width) ** 2) * 1.4);
    if (share < 0.08 && !hit) continue;
    out.push({ s, kind: "wire", index, label: "nylon wire", reflect: usReflect(US.Z.tissue, US.Z.nylon) * share });
  }
  return out
    .filter((echo) => echo.s > 0 && echo.s <= US.depth && (echo.s <= blocked || echo.kind === "calcium"))
    .sort((a, b) => a.s - b.s)
    .map((echo) => ({ ...echo, dB: 10 * Math.log10(echo.reflect), time: usRoundTrip(echo.s) }));
}

export function usTgcCurve(sliders) {
  const band = US.depth / sliders.length;
  return (s) => {
    const at = Math.max(0, Math.min(sliders.length - 1, s / band - 0.5));
    const low = Math.floor(at);
    const high = Math.min(sliders.length - 1, low + 1);
    return sliders[low] + (sliders[high] - sliders[low]) * (at - low);
  };
}

export const usTgcMatched = (count = 8) => Array.from({ length: count }, (_, index) => usLossPerMm() * ((index + 0.5) * (US.depth / count)));

function usRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function usTissue(seed = 7) {
  const random = usRandom(seed);
  const raw = new Float32Array(US.lines * US.samples);
  for (let index = 0; index < raw.length; index++) raw[index] = Math.sqrt(-2 * Math.log(1 - random() * 0.999999));
  return raw;
}

export function usImage(raw, { focus = US.focus, gain = 0, tgc = usTgcMatched() } = {}) {
  const { lines, samples, depth } = US;
  const ds = depth / samples;
  const dTheta = usRad(US.fov) / lines;
  const curve = usTgcCurve(tgc);
  const axial = new Float32Array(raw.length);
  for (let line = 0; line < lines; line++) {
    for (let j = 0; j < samples; j++) {
      const a = raw[line * samples + Math.max(0, j - 1)];
      const b = raw[line * samples + j];
      const c = raw[line * samples + Math.min(samples - 1, j + 1)];
      axial[line * samples + j] = 0.25 * a + 0.5 * b + 0.25 * c;
    }
  }
  const smooth = new Float32Array(raw.length);
  for (let j = 0; j < samples; j++) {
    const s = (j + 0.5) * ds;
    const spacing = (US.radius + s) * dTheta;
    const sigma = Math.max(0.6, usHalfWidth(s, focus) / spacing / 1.6);
    const reach = Math.ceil(sigma * 2.5);
    const weights = Array.from({ length: 2 * reach + 1 }, (_, k) => Math.exp(-0.5 * ((k - reach) / sigma) ** 2));
    const total = weights.reduce((sum, w) => sum + w, 0);
    const norm = Math.sqrt(weights.reduce((sum, w) => sum + w * w, 0)) / total;
    for (let line = 0; line < lines; line++) {
      let sum = 0;
      for (let k = -reach; k <= reach; k++) {
        const other = Math.min(lines - 1, Math.max(0, line + k));
        sum += weights[k + reach] * (axial[other * samples + j] - 1.18);
      }
      smooth[line * samples + j] = 1.18 + (sum / total) * (0.55 / norm) * 0.6;
    }
  }
  const out = new Float32Array(raw.length);
  const loss = usLossPerMm();
  for (let line = 0; line < lines; line++) {
    const theta = usAngle(line);
    const echoes = usEchoes(theta, focus);
    const calcium = usChord(theta, US.calcium.x, US.calcium.d, US.calcium.r);
    const cyst = usChord(theta, US.cyst.x, US.cyst.d, US.cyst.r);
    for (let j = 0; j < samples; j++) {
      const s = (j + 0.5) * ds;
      const inFluid = cyst && s > cyst[0] && s < cyst[1];
      const fluidPath = cyst ? Math.max(0, Math.min(s, cyst[1]) - cyst[0]) : 0;
      let level = inFluid ? -Infinity : US.speckle + 20 * Math.log10(Math.max(1e-3, smooth[line * samples + j]));
      if (s < usFatDepth(theta)) level -= 4;
      let peak = -Infinity;
      for (const echo of echoes) {
        const dz = (s - echo.s) / 0.7;
        if (Math.abs(dz) > 4) continue;
        peak = Math.max(peak, echo.dB + 20 * Math.log10(Math.exp(-dz * dz)) + 3);
      }
      level = 10 * Math.log10(10 ** (level / 10) + 10 ** (peak / 10));
      if (calcium && s > calcium[0] + 1.2) level += US.shadow;
      level += -loss * (s - fluidPath) + curve(s) + gain;
      out[line * samples + j] = Math.max(0, Math.min(1, (level + US.range) / US.range));
    }
  }
  return out;
}

export const usFatDepth = (theta) => (US.fat + US.radius - US.press) / Math.cos(theta) - US.radius;
