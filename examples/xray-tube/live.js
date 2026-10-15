const D = __DATA__;
const root = document.querySelector(".xr");
const stage = root.querySelector(".xr-stage");
const svg = stage.querySelector("svg");
const readout = root.querySelector("[data-readout]");
const said = stage.querySelector(".xr-said");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const part = (name) => svg.querySelector(`[data-part="${name}"]`);
const slots = part("slots");
const ribs = part("rotor-ribs");
const electrons = part("electrons");
const cone = part("cone");
const fronts = part("fronts");
const spectrum = part("spectrum");
const spectrumFill = part("spectrum-fill");
const kLines = part("lines");
const lcdKv = part("lcd-kv");
const lcdMa = part("lcd-ma");
const kvPointer = part("kv-pointer");
const maPointer = part("ma-pointer");
const lamp = part("lamp").querySelector(".iso-solid");
const TAU = Math.PI * 2;
const clampTo = (value, low, high) => Math.min(high, Math.max(low, value));
const ramp = (a, b, x) => {
  const t = clampTo((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const fmt = (value) => Math.round(value).toLocaleString("en-US");
const f1 = (value) => Math.round(value * 10) / 10;
const MA_STEPS = [50, 80, 100, 125, 160, 200, 250, 320, 400, 500];
const EXPOSE = 1.6;
const READY_RPM = 0.95 * XRAY.rpm;

const frontPaths = [0, 1, 2].map(() => {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "xr-front");
  fronts.replaceWith(path);
  return path;
});
const frontGroup = frontPaths[0].parentNode;
for (const path of frontPaths) frontGroup.insertBefore(path, frontGroup.lastElementChild);

const axisPoint = (s, r, t) => iso([s, D.ax.o[1] + r * Math.cos(t), D.ax.o[2] + r * Math.sin(t)], D.P);
const bevelS = (r) => D.disc.at + 4 + (D.disc.r - r) * D.disc.tan;
const view = (() => {
  const a = (D.P.azimuth ?? 45) * Math.PI / 180;
  const e = (D.P.elevation ?? 30) * Math.PI / 180;
  return [Math.cos(a) * Math.cos(e), Math.sin(a) * Math.cos(e), Math.sin(e)];
})();
const facing = (t) => Math.cos(t) * view[1] + Math.sin(t) * view[2];
const line = (a, b) => `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`;

function drawSlots(angle, alpha) {
  if (alpha < 0.02) {
    if (slots.style.opacity !== "0") slots.style.opacity = "0";
    return;
  }
  slots.style.opacity = alpha.toFixed(3);
  let d = "";
  for (let index = 0; index < D.disc.slots; index++) {
    const t = angle + (index / D.disc.slots) * TAU;
    d += line(axisPoint(bevelS(30.4), 30.4, t), axisPoint(bevelS(D.disc.r), D.disc.r, t));
  }
  slots.firstElementChild.setAttribute("d", d);
}

const ribPaths = [];
function drawRibs(angle, alpha) {
  ribs.style.opacity = alpha < 0.02 ? "0" : alpha.toFixed(3);
  if (alpha < 0.02) return;
  const groups = new Map();
  for (let index = 0; index < D.rotor.ribs; index++) {
    const t = angle + (index / D.rotor.ribs) * TAU;
    const share = ramp(0.1, 0.55, facing(t));
    if (share <= 0.02) continue;
    const key = Math.round(share * 20) / 20;
    groups.set(key, (groups.get(key) ?? "") + line(axisPoint(D.rotor.s0, D.rotor.r, t), axisPoint(D.rotor.s1, D.rotor.r, t)));
  }
  ribs.innerHTML = [...groups].map(([alphaKey, d]) => `<g opacity="${alphaKey}"><path class="iso-line" data-tone="lo" d="${d}"/></g>`).join("");
}

const energyX = (energy) => D.screen.x0 + (energy / 150) * (D.screen.x1 - D.screen.x0);
let shownSpectrum = -1;
function drawSpectrum(kv) {
  const key = Math.round(kv * 2) / 2;
  if (key === shownSpectrum) return;
  shownSpectrum = key;
  const lines = xrayLines(key);
  const peak = Math.max(xrayPeak(key), ...lines.map(([, height]) => height));
  const scale = ((D.screen.base - D.screen.top) * D.screen.lift) / (peak || 1);
  let d = `M${f1(energyX(4))} ${f1(D.screen.base)}`;
  for (let energy = 4; energy <= key; energy += 1) d += `L${f1(energyX(energy))} ${f1(D.screen.base - xrayBrems(energy, key) * scale)}`;
  d += `L${f1(energyX(key))} ${f1(D.screen.base)}`;
  spectrum.setAttribute("d", d);
  spectrumFill.setAttribute("d", d + "Z");
  kLines.setAttribute(
    "d",
    lines
      .map(([energy, height]) => {
        const curveAt = (at) => D.screen.base - xrayBrems(at, key) * scale;
        const y0 = curveAt(energy);
        return `M${f1(energyX(energy - 0.9))} ${f1(curveAt(energy - 0.9))}L${f1(energyX(energy))} ${f1(y0 - height * scale)}L${f1(energyX(energy + 0.9))} ${f1(curveAt(energy + 0.9))}`;
      })
      .join(""),
  );
}

const pointerD = (cx, cy, angle) => `M${f1(cx + Math.sin(angle) * 1.4)} ${f1(cy - Math.cos(angle) * 1.4)}L${f1(cx + Math.sin(angle) * 6.4)} ${f1(cy - Math.cos(angle) * 6.4)}`;
const knobAngle = (value, [lo, hi]) => ((value - lo) / (hi - lo) * 2 - 1) * D.knobs.sweep * Math.PI / 180;

const glide = () => ({ x: 0, v: 0 });
function ease(state, target, dt, seconds, calm) {
  if (calm) {
    state.x = target;
    state.v = 0;
    return false;
  }
  const w = 1 / seconds;
  for (let step = 0; step < 4; step++) {
    const h = dt / 4;
    state.v += (w * w * (target - state.x) - 2 * w * state.v) * h;
    state.x += state.v * h;
  }
  if (Math.abs(target - state.x) < 1e-4 && Math.abs(state.v) < 1e-4) {
    state.x = target;
    state.v = 0;
    return false;
  }
  return true;
}

const set = { kv: 100, ma: 200 };
const kv = { x: 100, v: 0 };
const ma = { x: 200, v: 0 };
const beam = glide();
const filament = { x: 0.35, v: 0 };
let rpm = 0;
let angle = 0;
let heat = 0;
let phase = "ready";
let phaseAt = 0;
let clock = 0;
let flow = 0;
let wave = 0;
let frame = 0;
let last = 0;
let visible = false;
let touring = !still.matches;
let tourClock = 0;
let tourStep = -1;
let idleTimer = 0;
let lastSaid = "";
let lastValue = "";

const TOUR = [
  [60, 160],
  [100, 200],
  [140, 250],
  [80, 320],
];
const TOUR_CYCLE = 8.4;

function expose() {
  if (phase === "ready" || phase === "brake") {
    phase = "prep";
    phaseAt = clock;
    announce("prep: anode spinning up, filament heating");
  }
}
function stop() {
  if (phase === "prep" || phase === "expose") {
    phase = "brake";
    phaseAt = clock;
    announce("exposure ended, anode braking");
  }
}
function announce(text) {
  if (text === lastSaid) return;
  lastSaid = text;
  said.textContent = text;
}

function describe() {
  const text = `${phase === "expose" ? "Exposing" : phase === "prep" ? "Preparing" : phase === "brake" ? "Anode braking" : "Ready"}, ${set.kv} kV, ${set.ma} mA`;
  if (text === lastValue) return;
  lastValue = text;
  stage.setAttribute("aria-valuenow", String(set.kv));
  stage.setAttribute("aria-valuetext", text);
}

function say() {
  let text;
  if (phase === "prep") text = `prep · anode ${fmt(rpm)} rpm`;
  else if (phase === "expose") text = `${Math.round(kv.x)} kV · ${Math.round(ma.x)} mA · ${(xrayEfficiency(kv.x) * 100).toFixed(2)}% → X-rays`;
  else if (phase === "brake") text = `braking · anode ${fmt(rpm)} rpm`;
  else text = `ready · ${Math.round(kv.x)} kV · ${Math.round(ma.x)} mA`;
  if (readout.textContent !== text) readout.textContent = text;
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  clock += dt;
  if (touring) {
    tourClock += dt;
    const step = Math.floor(tourClock / TOUR_CYCLE) % TOUR.length;
    const into = tourClock % TOUR_CYCLE;
    if (step !== tourStep) {
      tourStep = step;
      [set.kv, set.ma] = TOUR[step];
    }
    if (into > 1.2 && into < 1.2 + dt + 1e-6 && phase !== "prep" && phase !== "expose") expose();
  }
  let moving = ease(kv, set.kv, dt, 0.18, calm);
  moving = ease(ma, set.ma, dt, 0.18, calm) || moving;

  if (phase === "prep") {
    rpm += (XRAY.rpm - rpm) * (1 - Math.exp(-dt / XRAY.spinUp));
    moving = ease(filament, 1, dt, 0.25, calm) || moving;
    if (calm) rpm = XRAY.rpm;
    if (rpm >= READY_RPM && filament.x > 0.97) {
      phase = "expose";
      phaseAt = clock;
      announce(`exposing at ${set.kv} kV and ${set.ma} mA`);
    }
  } else if (phase === "expose") {
    rpm += (XRAY.rpm - rpm) * (1 - Math.exp(-dt / XRAY.spinUp));
    ease(filament, 1, dt, 0.25, calm);
    heat += kv.x * ma.x * dt;
    if (clock - phaseAt >= EXPOSE) {
      phase = "brake";
      phaseAt = clock;
      announce("exposure ended, anode braking");
    }
  } else {
    ease(filament, 0.35, dt, 0.6, calm);
    rpm *= Math.exp(-dt / XRAY.brake);
    if (calm || rpm < 25) rpm = 0;
    if (phase === "brake" && rpm === 0) {
      phase = "ready";
      phaseAt = clock;
      announce("ready");
    }
  }
  const on = phase === "expose";
  ease(beam, on ? 1 : 0, dt, on ? 0.05 : 0.09, calm);
  heat *= Math.exp(-dt / 5);
  if (phase !== "expose" && heat < 250) heat = 0;
  angle = (angle + (rpm / 60) * TAU * dt) % TAU;
  const { beta } = xrayElectron(kv.x);
  flow = (flow + dt * (0.9 + 2.6 * beta)) % 1;
  wave = (wave + dt * 0.9) % 1;
  draw(calm);
  describe();
  const settled = !touring && phase === "ready" && !moving && beam.x === 0 && rpm === 0 && Math.abs(filament.x - 0.35) < 1e-3 && heat === 0;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}

let turned = "";
function draw(calm) {
  const spin = ramp(60, 240, rpm);
  const pose = `${angle.toFixed(4)}|${spin.toFixed(3)}`;
  if (pose !== turned) {
    turned = pose;
    drawSlots(angle, 1 - spin);
    drawRibs(angle, 1 - spin);
  }
  const intensity = Math.sqrt((xrayTotal(kv.x) * ma.x) / (xrayTotal(150) * 500));
  const power = (kv.x * ma.x) / 1000;
  stage.style.setProperty("--xr-beam", beam.x.toFixed(3));
  stage.style.setProperty("--xr-cone", (0.05 + 0.12 * intensity).toFixed(3));
  stage.style.setProperty("--xr-dose", (0.06 + 0.3 * intensity).toFixed(3));
  stage.style.setProperty("--xr-filament", (ramp(0.3, 1, filament.x) * (0.45 + 0.55 * ramp(50, 500, ma.x))).toFixed(3));
  stage.style.setProperty("--xr-spot", (beam.x * (0.45 + 0.55 * ramp(4, 60, power))).toFixed(3));
  stage.style.setProperty("--xr-track", (ramp(0, 1, 1 - Math.exp(-heat / 40000)) * 0.85).toFixed(3));
  stage.style.setProperty("--xr-trace", (0.32 + 0.68 * beam.x).toFixed(3));
  if (beam.x > 0.002) {
    const count = Math.round(3 + ma.x / 45);
    const [x0, y0] = D.electron.from;
    const [x1, y1] = D.electron.to;
    let d = "";
    for (let index = 0; index < count; index++) {
      const u = calm ? (index + 0.5) / count : (flow + index / count) % 1;
      d += `M${f1(x0 + (x1 - x0) * u)} ${f1(y0 + (y1 - y0) * u)}h0`;
    }
    electrons.setAttribute("d", d);
    frontPaths.forEach((path, index) => {
      const t = calm ? (index + 1) / 4 : (wave + index / 3) % 1;
      const corners = D.field.map(([x, y]) => [D.spot[0] + (x - D.spot[0]) * t, D.spot[1] + (y - D.spot[1]) * t]);
      path.setAttribute("d", `M${corners.map(([x, y]) => `${f1(x)} ${f1(y)}`).join("L")}Z`);
      path.style.opacity = (ramp(0.04, 0.22, t) * (1 - ramp(0.7, 0.98, t)) * (0.4 + 0.6 * intensity)).toFixed(3);
    });
  }
  drawSpectrum(kv.x);
  const kvText = `${Math.round(kv.x)} kV`;
  const maText = `${Math.round(ma.x)} mA`;
  if (lcdKv.textContent !== kvText) lcdKv.textContent = kvText;
  if (lcdMa.textContent !== maText) lcdMa.textContent = maText;
  kvPointer.setAttribute("d", pointerD(D.knobs.kv.x, D.knobs.kv.y, knobAngle(kv.x, D.knobs.kv.range)));
  maPointer.setAttribute("d", pointerD(D.knobs.ma.x, D.knobs.ma.y, knobAngle(ma.x, D.knobs.ma.range)));
  const lit = phase === "expose";
  if (lit !== lamp.hasAttribute("data-lit")) {
    lamp.toggleAttribute("data-lit", lit);
  }
  say();
}

const run = () => {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};
const quiet = () => {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    touring = !still.matches;
    tourClock = TOUR_CYCLE * Math.max(0, tourStep + 1) - 0.4;
    run();
  }, 3600);
  run();
};
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  const box = svg.getBoundingClientRect();
  const share = clampTo(((event.clientX - box.left) / box.width - 0.12) / 0.76, 0, 1);
  set.kv = Math.round(XRAY.kv[0] + share * (XRAY.kv[1] - XRAY.kv[0]));
  quiet();
});
stage.addEventListener("pointerleave", () => quiet());
stage.addEventListener("click", () => {
  quiet();
  if (phase === "prep" || phase === "expose") stop();
  else expose();
});
stage.addEventListener("focus", () => {
  quiet();
  said.textContent = `${phase === "ready" ? "Ready" : phase}, ${set.kv} kV, ${set.ma} mA`;
});
stage.addEventListener("keydown", (event) => {
  const big = event.shiftKey;
  const maIndex = MA_STEPS.reduce((best, value, index) => (Math.abs(value - set.ma) < Math.abs(MA_STEPS[best] - set.ma) ? index : best), 0);
  const from = touring ? Math.round(kv.x) : set.kv;
  let handled = true;
  if (event.key === "ArrowRight") set.kv = clampTo(from + (big ? 20 : 5), ...XRAY.kv);
  else if (event.key === "ArrowLeft") set.kv = clampTo(from - (big ? 20 : 5), ...XRAY.kv);
  else if (event.key === "ArrowUp") set.ma = MA_STEPS[Math.min(MA_STEPS.length - 1, maIndex + (big ? 3 : 1))];
  else if (event.key === "ArrowDown") set.ma = MA_STEPS[Math.max(0, maIndex - (big ? 3 : 1))];
  else if (event.key === "Home") set.kv = XRAY.kv[0];
  else if (event.key === "End") set.kv = XRAY.kv[1];
  else if (event.key === " " || event.key === "Enter") phase === "prep" || phase === "expose" ? stop() : expose();
  else if (event.key === "Escape") stop();
  else handled = false;
  if (!handled) return;
  event.preventDefault();
  quiet();
});
draw(still.matches);
