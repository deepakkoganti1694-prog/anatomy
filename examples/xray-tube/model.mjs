export const XRAY = {
  Z: 74,
  kv: [40, 150],
  ma: [50, 500],
  anodeAngle: 12,
  disc: 100,
  trackRadius: 42,
  gap: 22,
  rpm: 3000,
  spinUp: 0.38,
  brake: 0.7,
  filterAl: 2.5,
  kEdge: 69.5,
  lines: [
    [57.98, 0.58],
    [59.32, 1],
    [67.24, 0.34],
    [69.1, 0.09],
  ],
  work: 4.54,
  richardson: 60,
  emitArea: 0.1,
  efficiency: 1.1e-9,
  spot: { effective: 1, actual: 1 / Math.sin((12 * Math.PI) / 180) },
};

export const xrayElectron = (kv) => {
  const gamma = 1 + kv / 510.999;
  const beta = Math.sqrt(1 - 1 / (gamma * gamma));
  return { gamma, beta, speed: beta * 299792.458 };
};

export const xrayEfficiency = (kv) => XRAY.efficiency * XRAY.Z * kv * 1000;

export const xrayCutoff = (kv) => 1239.84 / kv;

export function xrayFilament(ma) {
  const want = ma / 1000 / XRAY.emitArea;
  const wk = XRAY.work / 8.617333e-5;
  let low = 1500;
  let high = 3600;
  for (let step = 0; step < 50; step++) {
    const t = (low + high) / 2;
    if (XRAY.richardson * t * t * Math.exp(-wk / t) < want) low = t;
    else high = t;
  }
  return (low + high) / 2 - 273.15;
}

const xrayMuAl = (energy) => 0.15 + 3.44 * (20 / energy) ** 3;
export const xrayFilter = (energy) => Math.exp(-xrayMuAl(energy) * 2.699 * (XRAY.filterAl / 10));

export const xrayBrems = (energy, kv) => (energy >= kv ? 0 : (XRAY.Z * (kv - energy)) / energy / 74 * xrayFilter(energy));

export function xrayLines(kv) {
  if (kv <= XRAY.kEdge) return [];
  const strength = 1.9 * ((kv / XRAY.kEdge - 1) / (100 / XRAY.kEdge - 1)) ** 0.8;
  const peak100 = xrayPeak(100);
  return XRAY.lines.map(([energy, share]) => [energy, strength * share * peak100 * xrayFilter(energy) / xrayFilter(59.32)]);
}

export function xrayPeak(kv) {
  let best = 0;
  for (let energy = 1; energy < kv; energy += 0.5) best = Math.max(best, xrayBrems(energy, kv));
  return best;
}

export function xrayTotal(kv) {
  let sum = 0;
  for (let energy = 0.5; energy < kv; energy += 0.5) sum += xrayBrems(energy, kv) * 0.5;
  return sum;
}

export function xrayState(kv, ma) {
  const power = kv * ma;
  const share = xrayEfficiency(kv);
  return {
    kv,
    ma,
    power,
    share,
    xray: power * share,
    heat: power * (1 - share),
    cutoff: xrayCutoff(kv),
    electron: xrayElectron(kv),
    filament: xrayFilament(ma),
    lines: kv > XRAY.kEdge,
  };
}
