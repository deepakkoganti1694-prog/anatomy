const D = __DATA__;
const root = document.querySelector(".us");
const stage = root.querySelector(".us-stage");
const backSvg = stage.querySelector(".us-back");
const canvas = stage.querySelector(".us-canvas");
const ctx = canvas.getContext("2d");
const readout = root.querySelector("[data-readout]");
const say = root.querySelector(".us-say");
const chapterButtons = [...root.querySelectorAll(".us-chapter")];
const still = matchMedia("(prefers-reduced-motion: reduce)");
const part = (name) => stage.querySelector(`[data-part="${name}"]`);
const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
const NS = "http://www.w3.org/2000/svg";
const clampTo = (value, low, high) => Math.min(high, Math.max(low, value));
const ramp = (a, b, x) => {
  const t = clampTo((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const f2 = (value) => Math.round(value * 100) / 100;
const fmt = (value, digits = 1) => value.toFixed(digits);

const el = {
  beam: part("beam"),
  scanline: part("scanline"),
  echoes: part("echoes"),
  pulse: part("pulse"),
  firing: part("firing"),
  cursor: part("cursor"),
  focusMark: part("focus-mark"),
  tgcCurve: part("tgc-curve"),
  rate: part("lcd-rate"),
  depth: part("lcd-depth"),
  focus: part("lcd-focus"),
  gain: part("lcd-gain"),
  state: part("lcd-state"),
  gainPointer: part("gain-pointer"),
  focusPointer: part("focus-pointer"),
  couplant: [...stage.querySelectorAll('[data-part="couplant"]')],
  flash: Object.fromEntries([...stage.querySelectorAll("[data-flash]")].map((node) => [node.dataset.flash, node])),
  tgc: D.tgc.rows.map((_, index) => part(`tgc${index}`)),
};

const defs = document.createElementNS(NS, "defs");
backSvg.insertBefore(defs, backSvg.firstChild);
let gradients = 0;
const pool = (parent, count, className, ink) =>
  Array.from({ length: count }, () => {
    const id = `us-soft-${gradients++}`;
    const gradient = document.createElementNS(NS, "linearGradient");
    gradient.setAttribute("id", id);
    gradient.setAttribute("gradientUnits", "userSpaceOnUse");
    gradient.innerHTML = [[0, 0], [0.22, 1], [0.78, 1], [1, 0]].map(([offset, opacity]) => `<stop offset="${offset}" style="stop-color:var(${ink});stop-opacity:${opacity}"/>`).join("");
    defs.appendChild(gradient);
    const node = document.createElementNS(NS, "path");
    node.setAttribute("class", className);
    node.style.stroke = `url(#${id})`;
    node.soft = gradient;
    parent.appendChild(node);
    return node;
  });
const softEnds = (node, d) => {
  node.setAttribute("d", d);
  const numbers = d ? d.match(/-?\d+(?:\.\d+)?/g) : null;
  if (!numbers || numbers.length < 4) return;
  const g = node.soft;
  g.setAttribute("x1", numbers[0]);
  g.setAttribute("y1", numbers[1]);
  g.setAttribute("x2", numbers[numbers.length - 2]);
  g.setAttribute("y2", numbers[numbers.length - 1]);
};
const pulseGlow = pool(el.pulse, 1, "us-pulse-glow", "--us-pulse")[0];
const pulseArcs = pool(el.pulse, 3, "us-pulse", "--us-pulse");
const echoArcs = pool(el.echoes, 12, "us-echo", "--us-echo");
const fatFlash = el.flash.fat;
delete el.flash.fat;
const firingParent = el.firing.parentNode;
const firingLevels = [0.25, 0.55, 1].map((level) => {
  const node = document.createElementNS(NS, "path");
  node.setAttribute("class", "iso-line us-firing");
  node.setAttribute("data-tone", "lit");
  node.style.opacity = String(level);
  firingParent.appendChild(node);
  return node;
});
el.firing.remove();

const Rc = US.radius;
const apexD = -(US.radius - US.press);
const lineAngle = (line) => usAngle(clampTo(line, 0, US.lines - 1));
const lineOf = (theta) => clampTo(Math.round((theta / (US.fov * RAD) + 0.5) * US.lines - 0.5), 0, US.lines - 1);
const onLine = (theta, s, lateral = 0) => {
  const r = Rc + s;
  return [r * Math.sin(theta) + lateral * Math.cos(theta), apexD + r * Math.cos(theta) - lateral * Math.sin(theta)];
};
const trace = (points, closed = false) => points.map(([x, y], index) => `${index ? "L" : "M"}${f2(x)} ${f2(y)}`).join("") + (closed ? "Z" : "");

const settings = { focus: US.focus, gain: 0, line: 20 };
const tgcFlat = Array(8).fill(6);
const tgcMatched = usTgcMatched();
const tgcNow = tgcFlat.slice();

const raw = usTissue(7);
const FAN = (() => {
  const pxPerMm = 2.2;
  const u0 = -D.screen.fanHalf;
  const v0 = D.screen.vTop;
  const w = Math.ceil(2 * D.screen.fanHalf * pxPerMm);
  const h = Math.ceil((US.depth - v0) * pxPerMm);
  return { pxPerMm, u0, v0, w, h };
})();
function fanCanvas(image) {
  const off = document.createElement("canvas");
  off.width = FAN.w;
  off.height = FAN.h;
  const g = off.getContext("2d");
  const data = g.createImageData(FAN.w, FAN.h);
  const half = (US.fov / 2) * RAD;
  const { lines, samples, depth } = US;
  for (let py = 0; py < FAN.h; py++) {
    const v = FAN.v0 + (py + 0.5) / FAN.pxPerMm;
    for (let px = 0; px < FAN.w; px++) {
      const u = FAN.u0 + (px + 0.5) / FAN.pxPerMm;
      const r = Math.hypot(u, v + Rc);
      const theta = Math.atan2(u, v + Rc);
      const edge = Math.min(r - Rc, Rc + depth - r, (half - Math.abs(theta)) * r) * FAN.pxPerMm;
      if (edge <= -0.5) continue;
      const fl = clampTo((theta / (2 * half) + 0.5) * lines - 0.5, 0, lines - 1);
      const fs = clampTo(((r - Rc) / depth) * samples - 0.5, 0, samples - 1);
      const l0 = Math.floor(fl);
      const s0 = Math.floor(fs);
      const l1 = Math.min(lines - 1, l0 + 1);
      const s1 = Math.min(samples - 1, s0 + 1);
      const a = fl - l0;
      const b = fs - s0;
      const value =
        (image[l0 * samples + s0] * (1 - b) + image[l0 * samples + s1] * b) * (1 - a) + (image[l1 * samples + s0] * (1 - b) + image[l1 * samples + s1] * b) * a;
      const grey = Math.round(255 * Math.pow(value, 1.15));
      const index = (py * FAN.w + px) * 4;
      data.data[index] = grey;
      data.data[index + 1] = grey;
      data.data[index + 2] = Math.min(255, grey + 3);
      data.data[index + 3] = Math.round(255 * clampTo(edge + 0.5, 0, 1));
    }
  }
  g.putImageData(data, 0, 0);
  return off;
}
const fans = { flat: null, matched: null };
function rebuild() {
  fans.flat = fanCanvas(usImage(raw, { focus: settings.focus, gain: settings.gain, tgc: tgcFlat }));
  fans.matched = fanCanvas(usImage(raw, { focus: settings.focus, gain: settings.gain, tgc: tgcMatched }));
  screenDirty = true;
}
let rebuildTimer = 0;
const rebuildSoon = () => {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(rebuild, 140);
};

const V = 22;
const WARP = 4;
const STORY_LINE = 20;
function timeline(focus) {
  const theta = lineAngle(STORY_LINE);
  const echoes = usEchoes(theta, focus);
  const hard = echoes.find((echo) => echo.kind === "calcium") ?? echoes[echoes.length - 1];
  const launch = 5.2;
  const hit = launch + hard.s / V;
  const warpAt = launch + (2 * hard.s) / V + 0.5;
  const tauEnd = launch + (2 * US.depth) / V;
  const lineEnd = warpAt + (tauEnd - warpAt) / WARP;
  const starts = [0, 3, launch, hit, warpAt, lineEnd + 0.3, lineEnd + 4.3, lineEnd + 7.6];
  return { theta, echoes, hard, launch, hit, warpAt, tauEnd, lineEnd, starts, end: lineEnd + 15 };
}
let T = timeline(settings.focus);

let mode = still.matches ? "still" : "story";
let clock = 0;
let storyT = 0;
let playing = !still.matches;
let chapter = -1;
let inspect = { line: STORY_LINE, start: 0 };
let sweep = 0;
let fade = 0;
let tgcBlend = 0;
let screenDirty = true;
let frame = 0;
let last = 0;
let visible = false;
let idleTimer = 0;
let lastValue = "";
const reveal = { from: 0, to: -1, line: -1, depth: 0, all: false, alpha: 1 };

const tauOf = (t) => (t < T.warpAt ? t : T.warpAt + (t - T.warpAt) * WARP);

function setChapter(index) {
  if (index === chapter) return;
  chapter = index;
  chapterButtons.forEach((button, at) => {
    button.toggleAttribute("data-on", at === index);
    button.toggleAttribute("data-done", at < index);
    if (at === index) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  if (index >= 0) say.textContent = CHAPTER_TEXT[index];
}
const CHAPTER_TEXT = D.chapters.map((item) => item.say);

function beamPath(theta, focus) {
  const left = [];
  const right = [];
  for (let s = 0; s <= US.depth; s += 4) {
    const w = usHalfWidth(s, focus) * 1.15;
    left.push(onLine(theta, s, -w));
    right.push(onLine(theta, s, w));
  }
  return trace([...left, ...right.reverse()], true);
}

function wavefront(theta, s, focus, offset = 0) {
  const w = usHalfWidth(s, focus);
  const rho = Math.max(Math.abs(focus - s), w * 1.05);
  const sign = s < focus ? 1 : -1;
  const points = [];
  for (let k = -8; k <= 8; k++) {
    const u = (k / 8) * w;
    const a = s + offset + sign * (rho - Math.sqrt(Math.max(0, rho * rho - u * u)));
    points.push(onLine(theta, a, u));
  }
  return trace(points);
}

function echoArc(theta, echo, radius) {
  const centre = onLine(theta, echo.s);
  const back = Math.atan2(-Math.sin(theta), -Math.cos(theta));
  const spread = 0.9;
  const points = [];
  for (let k = 0; k <= 18; k++) {
    const a = back - spread + (2 * spread * k) / 18;
    points.push([centre[0] + radius * Math.sin(a), centre[1] + radius * Math.cos(a)]);
  }
  return trace(points);
}

function elementTicks(indices) {
  return indices
    .map((index) => {
      const t = usAngle(index);
      const a = [(Rc - 1.6) * Math.sin(t), -(apexD + (Rc - 1.6) * Math.cos(t))];
      const b = [(Rc - 4) * Math.sin(t), -(apexD + (Rc - 4) * Math.cos(t))];
      return `M${f2(a[0])} ${f2(a[1])}L${f2(b[0])} ${f2(b[1])}`;
    })
    .join("");
}

function apertureOf(line) {
  const start = clampTo(line - US.active / 2, 0, US.elements - US.active);
  return Array.from({ length: US.active }, (_, k) => start + k);
}

function fireTimes(line, focus) {
  const theta = lineAngle(line);
  const target = Rc + focus;
  const dist = apertureOf(line).map((element) => {
    const delta = usAngle(element) - theta;
    return Math.sqrt(Rc * Rc + target * target - 2 * Rc * target * Math.cos(delta));
  });
  const max = Math.max(...dist);
  const min = Math.min(...dist);
  return dist.map((value) => (max - value) / (max - min || 1));
}

function drawFiring(levels) {
  const groups = [[], [], []];
  for (const [element, value] of levels) {
    if (value < 0.08) continue;
    groups[value < 0.35 ? 0 : value < 0.7 ? 1 : 2].push(element);
  }
  firingLevels.forEach((node, index) => node.setAttribute("d", elementTicks(groups[index])));
}

function flashAll(levels) {
  for (const [key, node] of Object.entries(el.flash)) node.style.opacity = String(f2((levels[key] ?? 0) * 0.55));
}

function shot(theta, tau, launch, focus, echoes, { speed = V, dim = 1 } = {}) {
  const travel = (tau - launch) * speed;
  const pulse = [];
  const flashes = {};
  const blocked = echoes.find((echo) => echo.kind === "calcium");
  if (travel >= 0 && travel <= US.depth + 6) {
    const strength = blocked && travel > blocked.s ? 0.18 : 1;
    const fadeOut = 1 - ramp(US.depth - 10, US.depth + 6, travel);
    const atten = Math.pow(10, (-usLossPerMm() * travel) / 2 / 20 / 2);
    pulse.push(...[0, -1.8, -3.6].map((offset, index) => ({ d: wavefront(theta, Math.max(0.5, travel), focus, offset), alpha: dim * strength * fadeOut * (0.35 + 0.65 * atten) * [1, 0.5, 0.22][index] })));
  }
  const arcs = [];
  let received = 0;
  for (const echo of echoes) {
    const age = tau - launch - echo.s / speed;
    if (age < 0) continue;
    const key = echo.kind === "wire" ? `wire${echo.index}` : echo.kind;
    flashes[key] = Math.max(flashes[key] ?? 0, Math.exp(-age * 2.4));
    const radius = age * speed;
    if (radius > echo.s + 2) {
      received = Math.max(received, Math.exp(-(radius - echo.s) / 6) * (0.35 + 0.65 * ramp(-30, -4, echo.dB)));
      continue;
    }
    const strength = ramp(-32, -2, echo.dB);
    const alpha = dim * (0.25 + 0.75 * strength) * (1 - ramp(echo.s - 6, echo.s + 2, radius) * 0.6);
    arcs.push({ d: echoArc(theta, echo, Math.max(0.3, radius)), alpha });
    if (radius > 2.2) arcs.push({ d: echoArc(theta, echo, radius - 2), alpha: alpha * 0.4 });
  }
  return { pulse, arcs, flashes, received, travel };
}

function paintShot(result, theta = 0) {
  const lead = result?.pulse[0];
  softEnds(pulseGlow, lead ? lead.d : "");
  pulseGlow.style.opacity = lead ? f2(lead.alpha * 0.22) : "0";
  const fat = result?.flashes.fat ?? 0;
  if (fat > 0.01) {
    const s = usFatDepth(theta);
    const [cx] = onLine(theta, s);
    const w = (usHalfWidth(s, settings.focus) * 1.15) / Math.cos(theta);
    fatFlash.setAttribute("d", `M${f2(cx - w)} ${f2(US.fat - 0.7)}H${f2(cx + w)}V${f2(US.fat + 0.7)}H${f2(cx - w)}Z`);
  }
  fatFlash.style.opacity = f2(fat * 0.8);
  pulseArcs.forEach((node, index) => {
    const item = result?.pulse[index];
    softEnds(node, item ? item.d : "");
    node.style.opacity = item ? f2(item.alpha) : "0";
  });
  echoArcs.forEach((node, index) => {
    const item = result?.arcs[index];
    softEnds(node, item ? item.d : "");
    node.style.opacity = item ? f2(item.alpha) : "0";
  });
  flashAll(result?.flashes ?? {});
}

function paintLine(theta, focus, alpha = 1) {
  el.beam.setAttribute("d", alpha > 0.01 ? beamPath(theta, focus) : "");
  el.beam.style.opacity = f2(0.08 * alpha);
  el.scanline.setAttribute("d", alpha > 0.01 ? trace([onLine(theta, -2), onLine(theta, US.depth)]) : "");
  el.scanline.style.opacity = f2(0.5 * alpha);
  const cursor = alpha > 0.01 ? screenLine(theta) : "";
  if (el.cursor.getAttribute("d") !== cursor) el.cursor.setAttribute("d", cursor);
  el.cursor.style.opacity = f2(alpha);
}

const screenPoint = (u, v) => [D.screen.cx + u * D.screen.scale, D.screen.top + v * D.screen.scale];
function screenLine(theta) {
  const a = screenPoint(Rc * Math.sin(theta), Rc * Math.cos(theta) - Rc);
  const b = screenPoint((Rc + US.depth) * Math.sin(theta), (Rc + US.depth) * Math.cos(theta) - Rc);
  return `M${f2(a[0])} ${f2(a[1])}L${f2(b[0])} ${f2(b[1])}`;
}

function paintPanel() {
  const curve = usTgcCurve(tgcNow);
  const points = [];
  for (let s = 0; s <= US.depth; s += 6) points.push([5 + (curve(s) / 48) * 9, screenPoint(0, s)[1]]);
  el.tgcCurve.setAttribute("d", trace(points));
  const [, fy] = screenPoint(0, settings.focus);
  const x = D.screen.scaleX - 1;
  el.focusMark.setAttribute("d", `M${f2(x)} ${f2(fy)}l-3 -1.8v3.6Z`);
  el.focus.textContent = `F ${fmt(settings.focus / 10, 1)} cm`;
  el.gain.textContent = `G ${settings.gain >= 0 ? "+" : ""}${Math.round(settings.gain)} dB`;
  tgcNow.forEach((value, index) => el.tgc[index].setAttribute("transform", translateAlong(D.P, [(value / 48) * D.tgc.travel, 0, 0])));
  const knob = (id, angle) => {
    const { x: kx, y: ky, r, h } = D.knobs[id];
    const tip = [kx + (r - 1.6) * Math.sin(angle), ky - (r - 1.6) * Math.cos(angle)];
    const tail = [kx + 1.4 * Math.sin(angle), ky - 1.4 * Math.cos(angle)];
    return lineOnTop(tail, tip, D.deck + h, D.P);
  };
  el.gainPointer.setAttribute("d", knob("gain", (settings.gain / 24) * 135 * RAD));
  el.focusPointer.setAttribute("d", knob("focus", ((settings.focus - 30) / 70 * 2 - 1) * 135 * RAD));
}

function sizeCanvas() {
  const box = stage.getBoundingClientRect();
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(box.width * ratio));
  const h = Math.max(1, Math.round(box.height * ratio));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    screenDirty = true;
  }
}

function paintScreen() {
  if (!screenDirty) return;
  screenDirty = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!fans.matched || reveal.alpha <= 0.002) return;
  const k = canvas.width / D.W;
  const [a, b, c, d, e, f] = D.screen.matrix;
  ctx.save();
  ctx.setTransform(a * k, b * k, c * k, d * k, e * k, f * k);
  ctx.beginPath();
  ctx.rect(0, 0, D.screen.w, D.screen.h);
  ctx.clip();
  const [ax, ay] = screenPoint(0, -Rc);
  const scale = D.screen.scale;
  const wedge = (thetaA, thetaB, depth) => {
    ctx.moveTo(ax + Rc * scale * Math.sin(thetaA), ay + Rc * scale * Math.cos(thetaA));
    ctx.arc(ax, ay, (Rc + depth) * scale, Math.PI / 2 - thetaA, Math.PI / 2 - thetaB, true);
    ctx.arc(ax, ay, Rc * scale, Math.PI / 2 - thetaB, Math.PI / 2 - thetaA, false);
    ctx.closePath();
  };
  const step = (US.fov * RAD) / US.lines;
  ctx.beginPath();
  if (reveal.all) wedge(-US.fov / 2 * RAD - step, US.fov / 2 * RAD + step, US.depth + 2);
  else {
    if (reveal.to >= reveal.from) wedge(lineAngle(reveal.from) - step / 2, lineAngle(reveal.to) + step / 2, US.depth + 2);
    if (reveal.line >= 0 && reveal.depth > 0) wedge(lineAngle(reveal.line) - step * 2.5, lineAngle(reveal.line) + step * 2.5, reveal.depth);
  }
  ctx.clip();
  const [x0, y0] = screenPoint(FAN.u0, FAN.v0);
  const w = (FAN.w / FAN.pxPerMm) * scale;
  const h = (FAN.h / FAN.pxPerMm) * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = reveal.alpha * (1 - tgcBlend);
  if (ctx.globalAlpha > 0.002) ctx.drawImage(fans.flat, x0, y0, w, h);
  ctx.globalAlpha = reveal.alpha * tgcBlend;
  if (ctx.globalAlpha > 0.002) ctx.drawImage(fans.matched, x0, y0, w, h);
  ctx.restore();
}

function strongest(theta) {
  const echoes = usEchoes(theta, settings.focus).filter((echo) => echo.kind !== "fat");
  if (!echoes.length) return null;
  return echoes.reduce((best, echo) => (echo.reflect > best.reflect ? echo : best));
}

function describe(text) {
  if (text === lastValue) return;
  lastValue = text;
  stage.setAttribute("aria-valuetext", text);
}

function storyFrame(dt, calm) {
  if (playing) storyT += dt;
  if (storyT >= T.end) storyT = 0;
  const t = storyT;
  const index = T.starts.reduce((found, start, at) => (t >= start ? at : found), 0);
  setChapter(index);
  const next = index + 1 < T.starts.length ? T.starts[index + 1] : T.end;
  chapterButtons[index].style.setProperty("--us-progress", f2((t - T.starts[index]) / (next - T.starts[index])));
  let text = "";
  const theta = T.theta;
  const glow = 0.5 + 0.5 * Math.sin(t * 5);
  el.couplant.forEach((node) => node.toggleAttribute("data-on", index === 0));
  el.couplant.forEach((node) => node.style.setProperty("--us-glow", f2(index === 0 ? 0.4 + 0.6 * glow : 0)));
  reveal.all = false;
  reveal.alpha = index === 0 ? 1 - ramp(0, 1.2, t) : 1;
  if (index === 0) {
    if (t > 1.2) {
      reveal.from = 0;
      reveal.to = -1;
      reveal.line = -1;
    } else reveal.all = true;
    tgcBlend = 1 - ramp(0, 1.2, t);
    tgcNow.forEach((_, row) => (tgcNow[row] = tgcFlat[row] + (tgcMatched[row] - tgcFlat[row]) * tgcBlend));
    paintShot(null);
    paintLine(theta, settings.focus, ramp(1.4, 2.6, t));
    drawFiring([]);
    text = "couple · air would reflect 99.9%";
  } else if (index === 1) {
    tgcBlend = 0;
    tgcNow.forEach((_, row) => (tgcNow[row] = tgcFlat[row]));
    const local = t - T.starts[1];
    const times = fireTimes(STORY_LINE, settings.focus);
    const span = T.launch - T.starts[1] - 0.6;
    drawFiring(apertureOf(STORY_LINE).map((element, k) => {
      const age = local - 0.3 - times[k] * span;
      return [element, age < 0 ? 0 : Math.exp(-age * 2.2)];
    }));
    paintLine(theta, settings.focus, 1);
    paintShot(null);
    text = `transmit · ${US.active} crystals · ${US.f} MHz`;
  } else if (index <= 4) {
    const tau = tauOf(t);
    const result = shot(theta, tau, T.launch, settings.focus, T.echoes);
    paintShot(result, theta);
    paintLine(theta, settings.focus, 1);
    el.cursor.style.opacity = "0.3";
    drawFiring(apertureOf(STORY_LINE).map((element) => [element, result.received + (tau - T.launch < 0.25 ? 1 - (tau - T.launch) / 0.25 : 0)]));
    reveal.line = STORY_LINE;
    reveal.depth = clampTo(((tau - T.launch) * V) / 2, 0, US.depth);
    if (index === 2) text = `travel · ${fmt(result.travel / 10)} cm · ${Math.round((result.travel / 1000 / US.c) * 1e6)} µs`;
    else if (index === 3) text = `echo · ${T.hard.label} ${fmt(T.hard.s / 10)} cm · ${Math.round(T.hard.reflect * 100)}%`;
    else text = `listen · ${fmt(reveal.depth / 10)} cm · ${Math.round(usRoundTrip(reveal.depth))} µs`;
  } else if (index === 5) {
    const local = (t - T.starts[5]) / (T.starts[6] - T.starts[5]);
    const line = Math.min(US.lines - 1, Math.floor(local * US.lines));
    reveal.from = 0;
    reveal.to = line;
    reveal.line = STORY_LINE;
    reveal.depth = US.depth;
    paintShot(null);
    drawFiring(apertureOf(line).map((element) => [element, 0.7]));
    paintLine(lineAngle(line), settings.focus, 1);
    text = `image · line ${line + 1} of ${US.lines}`;
  } else if (index === 6) {
    reveal.all = true;
    tgcBlend = ramp(0.3, 2.6, t - T.starts[6]);
    tgcNow.forEach((_, row) => (tgcNow[row] = tgcFlat[row] + (tgcMatched[row] - tgcFlat[row]) * ramp(0.2 + row * 0.12, 1.6 + row * 0.12, t - T.starts[6])));
    paintShot(null);
    drawFiring([]);
    paintLine(theta, settings.focus, 1 - ramp(0, 0.5, t - T.starts[6]));
    text = `time-gain · +${Math.round(usTgcCurve(tgcNow)(US.depth))} dB at 12 cm`;
  } else {
    reveal.all = true;
    tgcBlend = 1;
    tgcNow.forEach((_, row) => (tgcNow[row] = tgcMatched[row]));
    sweep = (sweep + dt / 1.6) % 1;
    const line = Math.floor(sweep * US.lines);
    paintShot(null);
    drawFiring(apertureOf(line).map((element) => [element, 0.6]));
    paintLine(lineAngle(line), settings.focus, ramp(0, 0.6, t - T.starts[7]) * (1 - ramp(T.end - 0.8, T.end, t)));
    text = `live · ${Math.round(usFrameRate())} frames/s · ${US.lines} lines`;
  }
  screenDirty = true;
  describe(`Story, chapter ${index + 1} of ${D.chapters.length}: ${D.chapters[index].name}`);
  return text;
}

function inspectFrame(dt) {
  setChapter(-1);
  chapterButtons.forEach((button) => button.removeAttribute("data-on"));
  const theta = lineAngle(inspect.line);
  const echoes = usEchoes(theta, settings.focus);
  const period = (2 * US.depth) / 40 + 0.5;
  const tau = ((clock - inspect.start) % period);
  const result = shot(theta, tau, 0, settings.focus, echoes, { speed: 40 });
  paintShot(result, theta);
  paintLine(theta, settings.focus, 1);
  drawFiring(apertureOf(inspect.line).map((element) => [element, result.received + (tau < 0.2 ? 1 - tau / 0.2 : 0)]));
  reveal.all = true;
  reveal.alpha = 1;
  tgcBlend = 1;
  tgcNow.forEach((_, row) => (tgcNow[row] = tgcMatched[row]));
  screenDirty = true;
  const top = strongest(theta);
  describe(`Line ${inspect.line + 1}: ${top ? `${top.label} at ${fmt(top.s / 10)} centimetres` : "soft tissue only"}`);
  return `line ${inspect.line + 1} · ${top ? `${top.label} ${fmt(top.s / 10)} cm · ${top.reflect < 0.01 ? fmt(top.reflect * 100, 2) : Math.round(top.reflect * 100)}%` : "tissue only"}`;
}

function stillFrame() {
  setChapter(7);
  reveal.all = true;
  reveal.alpha = 1;
  tgcBlend = 1;
  tgcNow.forEach((_, row) => (tgcNow[row] = tgcMatched[row]));
  paintShot(null);
  drawFiring(apertureOf(inspect.line).map((element) => [element, 0.6]));
  paintLine(lineAngle(inspect.line), settings.focus, 1);
  screenDirty = true;
  const top = strongest(lineAngle(inspect.line));
  return `line ${inspect.line + 1} · ${top ? `${top.label} ${fmt(top.s / 10)} cm` : "tissue only"}`;
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  clock += dt;
  sizeCanvas();
  const text = mode === "inspect" && !calm ? inspectFrame(dt) : mode === "story" && !calm ? storyFrame(dt, calm) : stillFrame();
  if (readout.textContent !== text) readout.textContent = text;
  paintPanel();
  paintScreen();
  const idle = calm || (mode === "story" && !playing);
  frame = visible && !idle ? requestAnimationFrame(tick) : 0;
}

const run = () => {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};
const resumeLater = () => {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (still.matches) return;
    mode = "story";
    playing = true;
    run();
  }, 3600);
};

new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);
new ResizeObserver(() => {
  screenDirty = true;
  if (!frame) requestAnimationFrame(tick);
}).observe(stage);

function invert([a, b, c, d, e, f], x, y) {
  const det = a * d - b * c;
  const px = x - e;
  const py = y - f;
  return [(d * px - c * py) / det, (-b * px + a * py) / det];
}
function lineFromPointer(event) {
  const box = backSvg.getBoundingClientRect();
  const x = ((event.clientX - box.left) / box.width) * D.W;
  const y = ((event.clientY - box.top) / box.height) * D.H;
  const [gx, gy] = invert(D.gelMatrix, x, y);
  const gd = gy;
  if (gx > US.gel.left - 20 && gx < US.gel.right + 20 && gd > -60 && gd < US.gel.bottom + 10) return lineOf(Math.atan2(gx, gd - apexD));
  const [sx, sy] = invert(D.screen.matrix, x, y);
  if (sx > 0 && sx < D.screen.w && sy > 0 && sy < D.screen.h) {
    const u = (sx - D.screen.cx) / D.screen.scale;
    const v = (sy - D.screen.top) / D.screen.scale;
    return lineOf(Math.atan2(u, v + Rc));
  }
  return null;
}
function takeOver(line) {
  if (line === null) return;
  if (mode !== "inspect" || line !== inspect.line) inspect = { line, start: clock };
  mode = "inspect";
  resumeLater();
  run();
}
stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  takeOver(lineFromPointer(event));
});
stage.addEventListener("pointerdown", (event) => takeOver(lineFromPointer(event)));
stage.addEventListener("pointerleave", () => resumeLater());
stage.addEventListener("keydown", (event) => {
  const big = event.shiftKey;
  let handled = true;
  const current = mode === "inspect" ? inspect.line : mode === "story" ? STORY_LINE : inspect.line;
  if (event.key === "ArrowRight") takeOver(clampTo(current + (big ? 8 : 1), 0, US.lines - 1));
  else if (event.key === "ArrowLeft") takeOver(clampTo(current - (big ? 8 : 1), 0, US.lines - 1));
  else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    settings.focus = clampTo(settings.focus + (event.key === "ArrowUp" ? -5 : 5), 30, 100);
    T = timeline(settings.focus);
    rebuildSoon();
    if (mode !== "inspect") takeOver(current);
  } else if (event.key === " " || event.key === "Enter") {
    if (mode === "story") playing = !playing;
    else {
      mode = "story";
      playing = true;
    }
    clearTimeout(idleTimer);
    run();
  } else if (event.key === "Home") {
    mode = "story";
    storyT = 0;
    playing = true;
    run();
  } else handled = false;
  if (!handled) return;
  event.preventDefault();
});
chapterButtons.forEach((button, index) =>
  button.addEventListener("click", () => {
    clearTimeout(idleTimer);
    mode = "story";
    playing = true;
    storyT = T.starts[index] + 0.01;
    run();
  }),
);
still.addEventListener?.("change", () => {
  mode = still.matches ? "still" : "story";
  playing = !still.matches;
  run();
});

rebuild();
sizeCanvas();
requestAnimationFrame(tick);
