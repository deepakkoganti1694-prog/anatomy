import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../kit/tube.mjs";
import * as A from "../../kit/audit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const DEG = Math.PI / 180;
const TAN = Math.tan(M.XRAY.anodeAngle * DEG);

const W = 760;
const H = 640;
const AZIMUTH = 48;
const ELEVATION = 30;

const ZA = 152;
const TANK = { x: -292, y: -72, w: 476, d: 144, r: 10 };
const TANK_H = 44;
const FOOT_H = 8;
const FRONT = TANK.y + TANK.d;
const END = TANK.x + TANK.w;

const GLASS = [
  [-206, 17],
  [-202, 24, 1],
  [-197, 26, 1],
  [-130, 26, 1],
  [-122, 31, 1],
  [-114, 46, 1],
  [-106, 62, 1],
  [-99, 71, 1],
  [-92, 74, 1],
  [-8, 74, 1],
  [4, 72, 1],
  [16, 62, 1],
  [26, 48, 1],
  [34, 39, 1],
  [42, 35.5, 1],
  [50, 35, 1],
  [90, 35, 1],
  [96, 31],
];
const GLASS_WALL = 2.5;
const GLASS_TOP = 74;

const DISC_AT = -88;
const DISC_R = 50;
const TRACK_R = M.XRAY.trackRadius;
const bevelS = (r) => DISC_AT + 4 + (DISC_R - r) * TAN;
const SPOT_S = bevelS(TRACK_R);
const SPOT = [SPOT_S, 0, ZA - TRACK_R];
const CUP_X = SPOT_S + M.XRAY.gap;
const CUP = { x: CUP_X, y: -9, w: 12, d: 18, r: 2.6 };
const CUP_H = 12;
const CUP_Z = ZA - TRACK_R - CUP_H / 2;
const CUP_TOP = CUP_Z + CUP_H;
const ARM_X = CUP.x + CUP.w / 2;

const STATOR = { s0: -190, s1: -156, rIn: 28.5, rOut: 44, end: 3, endIn: 26.6, endOut: 41 };
const ROTOR = { s0: -196, s1: -134, r: 19, split: STATOR.s1 + STATOR.end };
const STEM_R = 5;

const ANODE_CAP = { s0: -230, s1: -206, r: 18, collar: [-226, -212], collarR: 24 };
const CATHODE_CAP = { s0: 96, s1: 122, r: 32, collar: [102, 116], collarR: 38 };
const ANODE_PLUG = { boss: [-238, -230], bossR: 12, shell: [-248, -238], shellR: 10, boot: [-256, -248] };
const CATHODE_PLUG = { boss: [122, 130], bossR: 13, shell: [130, 140], shellR: 10, boot: [140, 148] };
const CABLE_R = 5;
const BUSHING_H = 34;
const ELBOW_R = 8;
const ELBOW_REACH = Math.sqrt(ELBOW_R ** 2 - 6.2 ** 2);
const BUSHINGS = { anode: -256 - ELBOW_REACH, cathode: 148 + ELBOW_REACH };

const DETECTOR = { x: -136, y: -50, w: 116, d: 100, r: 4 };
const DETECTOR_H = 7;
const BEAM = { anode: M.XRAY.anodeAngle, cathode: 16, side: 14 };

const POSTS = {
  anode: { x: (ANODE_CAP.collar[0] + ANODE_CAP.collar[1]) / 2, host: ANODE_CAP.collarR },
  stator: { x: (STATOR.s0 + STATOR.s1) / 2, host: STATOR.rOut },
  cathode: { x: (CATHODE_CAP.collar[0] + CATHODE_CAP.collar[1]) / 2, host: CATHODE_CAP.collarR },
};
const PAD_R = 6;
const PAD_H = 6;

const PANEL = {
  screen: { x0: -270, x1: -170, z0: -8, z1: -36 },
  kv: { x: -138, z: -22 },
  ma: { x: -98, z: -22 },
  button: { x: -60, z: -22 },
  lamp: { x: -34, z: -22 },
  plate: { x: 2, w: 66, z0: -33, z1: -13 },
};
const KNOB = { skirt: 10.5, r: 8, s1: 8, scale: 13.2, sweep: 135 };

const P = k.fitProjection(
  [
    ...k.boxCorners(TANK, -TANK_H - FOOT_H, 0),
    ...Array.from({ length: 24 }, (_, index) => {
      const t = (index / 24) * Math.PI * 2;
      return [-50, GLASS_TOP * Math.cos(t), ZA + GLASS_TOP * Math.sin(t)];
    }),
    [BUSHINGS.anode, 0, ZA + CABLE_R + 2],
    [BUSHINGS.cathode, 0, ZA + CABLE_R + 2],
  ],
  W,
  H,
  { pad: 40, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const FADE = [0.04, 0.42];
const RIB_FADE = [0.1, 0.55];
const f1 = (value) => Math.round(value * 10) / 10;
const AX = G.frameOf([0, 0, ZA], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const ax = (s, r = 0, deg = 0) => G.pointOf(AX, s, r, deg * DEG);
const UP = (x, y, z = 0) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const OUT = (x, z, y = FRONT) => G.frameOf([x, y, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const face = (y) => k.sideMatrix([0, y], 0, P, "left");

const R = A.recorder(P);
const record = R.solid;
const STAND = { owner: "stand.frame" };
function put(name, centre, svg, shapes, { bias = 0, extra = {} } = {}) {
  return R.put({ at: centre, bias, svg, name, shapes: shapes.map(record), ...extra });
}

function turned(base, profile, style = {}, { inner = "", extra = "", bias = 0, bevel = 0, owner, smooth, F = AX, steps } = {}) {
  const name = R.nameFor(base);
  const paths = G.solidOf(profile, F, P, { bevel, ...(smooth === undefined ? {} : { smooth }), ...(steps ? { steps } : {}) });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  put(name, G.pointOf(F, mid, 0, 0), S(paths, { tone: "hi", ...style, inner }) + extra, [A.solid(F, profile, { name, owner })], { bias });
  return name;
}

function discAt(base, F, s0, s1, r, style = {}, { inner = "", extra = "", bias = 0, bevel = 0, owner } = {}) {
  const name = R.nameFor(base);
  put(name, G.pointOf(F, (s0 + s1) / 2, 0, 0), S(G.disc(s0, s1, r, F, P, { bevel }), { tone: "hi", ...style, inner }) + extra, [A.disc(F, s0, s1, r, { name, owner })], { bias });
  return name;
}

function ringAt(base, F, s0, s1, rIn, rOut, style = {}, { inner = "", extra = "", bias = 0, owner } = {}) {
  const name = R.nameFor(base);
  const shape = A.ring(F, s0, s1, rIn, rOut, { name, owner });
  put(name, G.pointOf(F, (s0 + s1) / 2, (rIn + rOut) / 2, -90 * DEG), S(G.ringBand(s0, s1, rIn, rOut, F, P), { tone: "mid", ...style, inner }) + extra, [shape], { bias });
  return shape;
}

const back = [];
const front = [];
const stops = (kind) => `<stop offset="0" class="xr-stop-${kind}-core"/><stop offset=".28" class="xr-stop-${kind}-body" stop-opacity=".9"/><stop offset=".62" class="xr-stop-${kind}-rim" stop-opacity=".32"/><stop offset="1" class="xr-stop-${kind}-rim" stop-opacity="0"/>`;
back.push(`<defs><radialGradient id="xr-filament">${stops("fil")}</radialGradient><radialGradient id="xr-spot">${stops("spot")}</radialGradient></defs>`);

back.push(`<path class="iso-halo" d="${k.haloOf(TANK, -TANK_H - FOOT_H, TANK_H, P)}"/>`);
const FEET = [...k.corners(TANK, 28), [TANK.x + TANK.w / 2, TANK.y + 28], [TANK.x + TANK.w / 2, TANK.y + TANK.d - 28]].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
for (const [x, y] of FEET) {
  back.push(S(k.cylinder(x, y, 11, -TANK_H - FOOT_H, 2, P, 28), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 8, -TANK_H - FOOT_H + 2, FOOT_H - 2, P, 28), { tone: "mid" }));
  record(A.cylinder(x, y, 11, -TANK_H - FOOT_H, 2, { name: "stand.foot-pad", ...STAND }));
  record(A.cylinder(x, y, 8, -TANK_H - FOOT_H + 2, FOOT_H - 2, { name: "stand.foot", ...STAND }));
}
back.push(S(k.slabOf(TANK, -TANK_H, TANK_H, P, 8, 1.6), { tone: "mid", inner: Ln(k.sideSeam(TANK, -7, P, 8), { tone: "faint" }) }));
record(A.slab(TANK, -TANK_H, TANK_H, { name: "stand.tank", ...STAND }));
back.push(Ln(k.planOutline(k.insetPlan(TANK, 6), 0, P), { tone: "lo" }));
const TANK_SCREWS = k.corners(TANK, 13);
back.push(Ln(TANK_SCREWS.map(([x, y]) => k.ring(x, y, 2.6, 0, P, 16)).join(""), { tone: "lo" }));
back.push(Dots(TANK_SCREWS.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));

const STRIP = { x: TANK.x + 22, y: FRONT - 17, w: 150, d: 7, r: 1 };
back.push(S(k.slabOf(STRIP, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
const TICKS = k.topTicks(STRIP.x + 4, STRIP.x + STRIP.w - 4, 5, 5, STRIP.y + 0.8, 0.6, [2, 3.8], P);
back.push(Ln(TICKS.minor, { tone: "lo" }), Ln(TICKS.major, { tone: "mid" }));
back.push(Dots([at([STRIP.x + 2, STRIP.y + 3.5, 0.6]), at([STRIP.x + STRIP.w - 2, STRIP.y + 3.5, 0.6])], { size: 0.45 }));

const TOP_PLATE = { x: 20, y: FRONT - 34, w: 54, d: 22, r: 1.5 };
back.push(S(k.slabOf(TOP_PLATE, 0, 0.8, P, 3), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(TOP_PLATE, 1.6), 0.8, P, 3), { tone: "faint" }));
back.push(k.faceTextSvg(k.topMatrix([TOP_PLATE.x + 5, TOP_PLATE.y + 8.6], 0.8, P, "x"), "XR 150 kV", { size: 4.2, tone: "lo" }));
back.push(Ln([0, 1].map((row) => k.onTop([[TOP_PLATE.x + 5, TOP_PLATE.y + 13 + row * 3.4], [TOP_PLATE.x + (row ? 30 : 44), TOP_PLATE.y + 13 + row * 3.4]], 0.8, P)).join(""), { tone: "lo", free: true }));
back.push(Dots([at([TOP_PLATE.x + 2.6, TOP_PLATE.y + TOP_PLATE.d / 2, 0.8]), at([TOP_PLATE.x + TOP_PLATE.w - 2.6, TOP_PLATE.y + TOP_PLATE.d / 2, 0.8])], { size: 0.45 }));

const vent = (y0, y1, z, h) => {
  const r = h / 2;
  const left = -y1;
  const right = -y0;
  const steps = 6;
  const arc = (cx, from) => Array.from({ length: steps + 1 }, (_, index) => {
    const t = from + (Math.PI * index) / steps;
    return [cx + r * Math.cos(t), z + r * Math.sin(t)];
  });
  const points = [...arc(right - r, -Math.PI / 2), ...arc(left + r, Math.PI / 2)];
  return k.pathOf(points, true);
};
back.push(`<g transform="${k.sideMatrix([END, 0], 0, P, "right")}">${Ln([10, 17, 24, 31].map((z) => vent(-46, 46, z, 3)).join(""), { tone: "lo" })}</g>`);

const SCREEN = PANEL.screen;
const SX0 = SCREEN.x0;
const SX1 = SCREEN.x1;
const SY0 = -SCREEN.z0;
const SY1 = -SCREEN.z1;
const RECESS = 1.6;
const rect = (x0, y0, x1, y1, r) => {
  const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r };
  return k.pathOf(k.roundedPlan(plan, 4), true);
};
{
  const corner = (x, z, y) => at([x, y, z]);
  const quads = [
    [[SX0, SCREEN.z1], [SX1, SCREEN.z1], 0],
    [[SX0, SCREEN.z0], [SX0, SCREEN.z1], 2],
  ];
  const walls = quads
    .map(([[xa, za], [xb, zb], shade]) => `<path class="iso-shade" data-shade="${shade}" d="${k.pathOf([corner(xa, za, FRONT), corner(xb, zb, FRONT), corner(xb, zb, FRONT - RECESS), corner(xa, za, FRONT - RECESS)], true)}"/>`)
    .join("");
  back.push(`<g class="xr-screen-wall">${walls}</g>`);
}
const EAXIS = { x0: SX0 + 7, x1: SX1 - 6, base: SY1 - 6, top: SY0 + 9 };
const energyX = (energy) => EAXIS.x0 + (energy / 150) * (EAXIS.x1 - EAXIS.x0);
const screenTicks = () => {
  const minor = [];
  const major = [];
  for (let energy = 0; energy <= 150; energy += 10) (energy % 50 ? minor : major).push(`M${f1(energyX(energy))} ${f1(EAXIS.base)}v${energy % 50 ? 1.4 : 2.6}`);
  return { minor: minor.join(""), major: major.join("") };
};
const SPECTRUM_LIFT = 0.86;
function spectrumPaths(kv) {
  const peak = Math.max(M.xrayPeak(kv), ...M.xrayLines(kv).map(([, height]) => height));
  const scale = ((EAXIS.base - EAXIS.top) * SPECTRUM_LIFT) / (peak || 1);
  const points = [];
  for (let energy = 4; energy <= kv; energy += 1) points.push([energyX(energy), EAXIS.base - M.xrayBrems(energy, kv) * scale]);
  points.push([energyX(kv), EAXIS.base]);
  const curve = `M${f1(energyX(4))} ${f1(EAXIS.base)}` + points.map(([x, y]) => `L${f1(x)} ${f1(y)}`).join("");
  const lines = M.xrayLines(kv)
    .map(([energy, height]) => {
      const curveAt = (at) => EAXIS.base - M.xrayBrems(at, kv) * scale;
      const y0 = curveAt(energy);
      return `M${f1(energyX(energy - 0.9))} ${f1(curveAt(energy - 0.9))}L${f1(energyX(energy))} ${f1(y0 - height * scale)}L${f1(energyX(energy + 0.9))} ${f1(curveAt(energy + 0.9))}`;
    })
    .join("");
  return { curve, lines };
}
const SPECTRUM0 = spectrumPaths(100);
const SCREEN_TICKS = screenTicks();
back.push(
  `<g transform="${face(FRONT - RECESS)}">` +
    `<clipPath id="xr-screen-clip"><path d="${rect(SX0, SY0, SX1, SY1, 1.6)}"/></clipPath>` +
    `<g clip-path="url(#xr-screen-clip)">` +
    `<path class="xr-screen" d="${rect(SX0 - 2, SY0 - 2, SX1 + 2, SY1 + 2, 0)}"/>` +
    `<path class="xr-trace-fill" data-part="spectrum-fill" d="${SPECTRUM0.curve}Z"/>` +
    Ln(`M${f1(EAXIS.x0)} ${f1(EAXIS.base)}H${f1(EAXIS.x1)}`, { tone: "mid", className: "xr-lcd-line" }) +
    Ln(SCREEN_TICKS.minor, { tone: "lo", className: "xr-lcd-line" }) +
    Ln(SCREEN_TICKS.major, { tone: "mid", className: "xr-lcd-line" }) +
    `<path class="iso-line xr-trace" data-tone="hi" data-part="spectrum" d="${SPECTRUM0.curve}"/>` +
    `<path class="iso-line xr-trace" data-tone="hi" data-part="lines" d="${SPECTRUM0.lines}"/>` +
    `<text class="xr-lcd" data-part="lcd-kv" x="${f1(SX0 + 5)}" y="${f1(SY0 + 6.8)}">100 kV</text>` +
    `<text class="xr-lcd" data-part="lcd-ma" x="${f1(SX1 - 5)}" y="${f1(SY0 + 6.8)}" text-anchor="end">200 mA</text>` +
    `</g></g>`,
);
back.push(`<g transform="${face(FRONT)}">${Ln(rect(SX0, SY0, SX1, SY1, 1.6), { tone: "lo" })}${Ln(rect(SX0 - 3.2, SY0 - 3.2, SX1 + 3.2, SY1 + 3.2, 2.6), { tone: "faint" })}</g>`);
back.push(Dots([[SX0 - 1.6, SY0 - 1.6], [SX1 + 1.6, SY0 - 1.6], [SX0 - 1.6, SY1 + 1.6], [SX1 + 1.6, SY1 + 1.6]].map(([x, y]) => at([x, FRONT, -y])), { size: 0.45 }));

const knobAngle = (value, [lo, hi]) => ((value - lo) / (hi - lo) * 2 - 1) * KNOB.sweep * DEG;
const pointerD = (cx, cy, angle, r0, r1) => `M${f1(cx + Math.sin(angle) * r0)} ${f1(cy - Math.cos(angle) * r0)}L${f1(cx + Math.sin(angle) * r1)} ${f1(cy - Math.cos(angle) * r1)}`;
const circleD = (cx, cy, r, steps = 48) => k.pathOf(Array.from({ length: steps }, (_, index) => [cx + r * Math.cos((index / steps) * Math.PI * 2), cy + r * Math.sin((index / steps) * Math.PI * 2)]), true);
function knob(id, { x, z }, range, value) {
  const F = OUT(x, z);
  const cy = -z;
  const minor = [];
  const major = [];
  for (let index = 0; index <= 10; index++) {
    const angle = ((index / 10) * 2 - 1) * KNOB.sweep * DEG;
    (index % 5 ? minor : major).push(pointerD(x, cy, angle, KNOB.scale, KNOB.scale + (index % 5 ? 1.8 : 3)));
  }
  back.push(`<g transform="${face(FRONT)}">${Ln(circleD(x, cy, KNOB.scale), { tone: "faint" })}${Ln(minor.join(""), { tone: "lo" })}${Ln(major.join(""), { tone: "mid" })}</g>`);
  back.push(S(G.disc(0, 1.6, KNOB.skirt, F, P, { bevel: 0.4 }), { tone: "mid" }));
  const ribs = G.ribsOf(F, 1.6, KNOB.s1, KNOB.r, 36, P, { fade: RIB_FADE });
  back.push(S(G.disc(1.6, KNOB.s1, KNOB.r, F, P, { bevel: 0.6 }), { tone: "hi", inner: k.fadedSvg(ribs, { tone: "lo" }) }));
  const angle = knobAngle(value, range);
  back.push(`<g transform="${face(FRONT + KNOB.s1)}">${Ln(circleD(x, cy, 5.2, 36), { tone: "faint" })}<path class="iso-line" data-tone="hi" data-part="${id}-pointer" data-free="start" d="${pointerD(x, cy, angle, 1.4, 6.4)}" style="stroke-width:1.1"/></g>`);
  back.push(Dots([at([x, FRONT + KNOB.s1, z])], { size: 0.55, tone: "hi" }));
  record(A.disc(F, 0, KNOB.s1, KNOB.skirt, { name: `stand.knob-${id}`, ...STAND }));
}
knob("kv", PANEL.kv, M.XRAY.kv, 100);
knob("ma", PANEL.ma, M.XRAY.ma, 200);
{
  const { x, z } = PANEL.button;
  const F = OUT(x, z);
  back.push(S(G.ringBand(0, 3, 6.4, 9.4, F, P), { tone: "mid" }));
  back.push(`<g data-part="button">${S(G.disc(0, 4.4, 5.6, F, P, { bevel: 0.5 }), { tone: "hi" })}</g>`);
  record(A.ring(F, 0, 3, 6.4, 9.4, { name: "stand.button-guard", ...STAND }));
  record(A.disc(F, 0, 4.4, 5.6, { name: "stand.button", ...STAND }));
}
{
  const { x, z } = PANEL.lamp;
  const F = OUT(x, z);
  back.push(S(G.disc(0, 1.6, 5.4, F, P, { bevel: 0.4 }), { tone: "mid" }));
  back.push(`<g data-part="lamp">${S(G.sphereOf(G.pointOf(F, 1.6, 0, 0), 3.8, P, { steps: 32 }), { tone: "hi" })}</g>`);
  record(A.disc(F, 0, 1.6, 5.4, { name: "stand.lamp-bezel", ...STAND }));
  record(A.ball(G.pointOf(F, 1.6, 0, 0), 3.8, { name: "stand.lamp", ...STAND }));
}
{
  const { x, w, z0, z1 } = PANEL.plate;
  const plan = { x, y: FRONT, w, d: 0.8, r: 0.4 };
  back.push(S(k.slabOf(plan, z0, z1 - z0, P, 2), { tone: "mid", crease: "none" }));
  record(A.slab(plan, z0, z1 - z0, { name: "stand.panel-plate", ...STAND }, 2));
  const rules = [[x + 5, x + w - 8], [x + 5, x + w - 22], [x + 5, x + w - 14]];
  back.push(`<g transform="${face(FRONT + 0.8)}">${Ln(rule(rules, -z1), { tone: "lo", free: true })}</g>`);
  back.push(Dots([[x + 2.4, -z1 + 2.4], [x + w - 2.4, -z1 + 2.4], [x + 2.4, -z0 - 2.4], [x + w - 2.4, -z0 - 2.4]].map(([px, py]) => at([px, FRONT + 0.8, -py])), { size: 0.42 }));
}
function rule(rows, top) {
  return rows.map(([a, b], index) => `M${f1(a)} ${f1(top + 5 + index * 4.6)}H${f1(b)}`).join("");
}

for (const [id, { x, host }] of Object.entries(POSTS)) {
  const top = ZA - host - PAD_H;
  put(`stand.${id}-post-flange`, [x, 0, 1.5], S(k.cylinder(x, 0, 11, 0, 3, P, 32, 0.5), { tone: "mid" }) + Dots([0, 90, 180, 270].map((deg) => at([x + 8 * Math.cos((deg + 45) * DEG), 8 * Math.sin((deg + 45) * DEG), 3])), { size: 0.45 }), [A.cylinder(x, 0, 11, 0, 3, { name: `stand.${id}-post-flange`, ...STAND })]);
  put(`stand.${id}-post`, [x, 0, (3 + top) / 2], S(k.cylinder(x, 0, 5.5, 3, top - 3, P, 28), { tone: "mid", crease: "none", inner: Ln([24, top - 18].map((z) => k.sideArc(x, 0, 5.5, z, P, 16)).join(""), { tone: "faint" }) }), [A.cylinder(x, 0, 5.5, 3, top - 3, { name: `stand.${id}-post`, ...STAND })]);
}

const ANODE_CAP_SHAPES = [];
const capBand = (base, s0, s1, r, extra = {}) => discAt(base, AX, s0, s1, r, { tone: "mid" }, extra);
discAt("anode.plug", AX, ANODE_PLUG.shell[0], ANODE_PLUG.shell[1], ANODE_PLUG.shellR, { tone: "mid" }, { inner: k.fadedSvg(G.ribsOf(AX, ANODE_PLUG.shell[0], ANODE_PLUG.shell[1], ANODE_PLUG.shellR, 28, P, { fade: RIB_FADE }), { tone: "lo" }) });
discAt("anode.receptacle", AX, ANODE_PLUG.boss[0], ANODE_PLUG.boss[1], ANODE_PLUG.bossR, { tone: "mid" });
const BOOT_R = [CABLE_R + 1.2, ANODE_PLUG.shellR - 0.8];
const bootArcs = (s0, s1, r0, r1) => Ln([0.35, 0.7].map((t) => G.arcOf(AX, s0 + (s1 - s0) * t, r0 + (r1 - r0) * t, P, { slope: (r1 - r0) / (s1 - s0) })).join(""), { tone: "faint" });
turned("anode.boot", [[ANODE_PLUG.boot[0], BOOT_R[0]], [ANODE_PLUG.boot[1], BOOT_R[1]]], { tone: "mid" }, { inner: bootArcs(ANODE_PLUG.boot[0], ANODE_PLUG.boot[1], BOOT_R[0], BOOT_R[1]) });
capBand("anode.cap", ANODE_CAP.s0, ANODE_CAP.collar[0], ANODE_CAP.r, { bevel: 0.6 });
const ANODE_COLLAR = ringAt("anode.collar", AX, ANODE_CAP.collar[0], ANODE_CAP.collar[1], ANODE_CAP.r, ANODE_CAP.collarR, {}, { extra: Dots([ax(ANODE_CAP.collar[1], ANODE_CAP.collarR - 2.6, 20), ax(ANODE_CAP.collar[1], ANODE_CAP.collarR - 2.6, 160)].map(at), { size: 0.5 }) });
capBand("anode.cap", ANODE_CAP.collar[1], ANODE_CAP.s1, ANODE_CAP.r, { inner: Ln(G.circleOf(AX, ANODE_CAP.s1, 17, P), { tone: "faint" }), bevel: 0.6 });

discAt("anode.bearing", AX, ANODE_CAP.s1, ROTOR.s0, 6, { tone: "mid" });
discAt("anode.rotor", AX, ROTOR.s0, STATOR.s0 - STATOR.end, ROTOR.r, { tone: "mid" });
record(A.disc(AX, STATOR.s0 - STATOR.end, ROTOR.split, ROTOR.r, { name: "anode.rotor-inside" }));
const STATOR_SHAPE = ringAt("stator.core", AX, STATOR.s0, STATOR.s1, STATOR.rIn, STATOR.rOut, { tone: "mid" }, {
  inner: Ln(Array.from({ length: 10 }, (_, index) => G.arcOf(AX, STATOR.s0 + 2.5 + index * 3.2, STATOR.rOut, P)).join(""), { tone: "faint" }),
  extra: Dots(G.dotsOf(AX, STATOR.s1, STATOR.rOut - 1.5, 12, P, { all: true, phase: 7.5 * DEG }), { size: 0.45, tone: "mid" }),
});
ringAt("stator.winding", AX, STATOR.s0 - STATOR.end, STATOR.s0, STATOR.endIn, STATOR.endOut, { tone: "lo" });
ringAt("stator.winding", AX, STATOR.s1, STATOR.s1 + STATOR.end, STATOR.endIn, STATOR.endOut, { tone: "lo" }, {
  inner: Ln(G.circleOf(AX, STATOR.s1 + STATOR.end, (STATOR.endIn + STATOR.endOut) / 2, P), { tone: "faint" }),
  extra: `<path class="xr-void" d="${G.circleOf(AX, STATOR.s1 + STATOR.end, STATOR.endIn, P)}"/>` + Ln(G.arcOf(AX, STATOR.s1 + STATOR.end, STATOR.endIn, P, { inward: true, least: -1 }), { tone: "lo" }),
});

const ROTOR_RIBS = 18;
const rotorRibs = (phase) => k.fadedSvg(G.ribsOf(AX, ROTOR.split, ROTOR.s1, ROTOR.r, ROTOR_RIBS, P, { fade: RIB_FADE, phase }), { tone: "lo" });
discAt("anode.rotor", AX, ROTOR.split, ROTOR.s1, ROTOR.r, { tone: "mid" }, { inner: `<g data-part="rotor-ribs">${rotorRibs(0)}</g>`, extra: Ln(G.circleOf(AX, ROTOR.s1, ROTOR.r - 3, P), { tone: "faint" }) });
discAt("anode.stem", AX, ROTOR.s1, DISC_AT, STEM_R, { tone: "mid" });

const DISC_PROFILE = [
  [DISC_AT, DISC_R],
  [DISC_AT + 4, DISC_R],
  [bevelS(30), 30],
  [bevelS(30), 12],
  [DISC_AT + 12, 12],
];
const SLOTS = 10;
const slotPaths = (phase) =>
  Array.from({ length: SLOTS }, (_, index) => {
    const t = phase + (index / SLOTS) * Math.PI * 2;
    return k.pathOf([at(G.pointOf(AX, bevelS(30.4), 30.4, t)), at(G.pointOf(AX, bevelS(DISC_R), DISC_R, t))]);
  }).join("");
const TRACK_SLOPE = -1 / TAN;
const trackArcs = [TRACK_R - 4, TRACK_R + 4].map((r) => G.arcOf(AX, bevelS(r), r, P, { slope: TRACK_SLOPE, least: -1 })).join("");
const DISC = turned("anode.disc", DISC_PROFILE, { tone: "hi" }, {
  bevel: 0,
  inner: Ln(trackArcs, { tone: "lo" }) + `<path class="iso-line xr-track" data-part="track-glow" d="${G.circleOf(AX, SPOT_S, TRACK_R, P, 96)}"/>` + `<g data-part="slots">${Ln(slotPaths(0), { tone: "lo" })}</g>`,
});
discAt("anode.nut", AX, DISC_AT + 12, DISC_AT + 15, 7, { tone: "hi" }, { extra: Dots([at(ax(DISC_AT + 15))], { size: 0.5, tone: "mid" }) });

put(
  "cathode.cup",
  [CUP.x + CUP.w / 2, 0, CUP_Z + CUP_H / 2],
  S(k.slabOf(CUP, CUP_Z, CUP_H, P, 4, 0.6), { tone: "hi" }) +
    Ln(k.planOutline(k.insetPlan(CUP, 2), CUP_TOP, P, 3), { tone: "faint" }) +
    Dots([at([CUP.x + CUP.w - 2.4, CUP.y + 2.4, CUP_TOP]), at([CUP.x + CUP.w - 2.4, CUP.y + CUP.d - 2.4, CUP_TOP])], { size: 0.42 }),
  [A.slab(CUP, CUP_Z, CUP_H, { name: "cathode.cup" }, 4)],
);
for (const y of [-5.4, 5.4]) {
  const x = CUP.x + 3;
  put("cathode.lead", [x, y, CUP_TOP + 1.2], S(k.cylinder(x, y, 1.2, CUP_TOP, 2.4, P, 16, 0.2), { tone: "mid" }), [A.cylinder(x, y, 1.2, CUP_TOP, 2.4, { name: "cathode.lead" })]);
}

const tubeItems = (name, route, r, { tone = "mid", limp = false, maxLength = 16, rims, owner } = {}) => {
  R.route(name, route, r, { limp, rims, owner });
  tubePieces(route, r, P, { maxLength, spacing: Math.max(0.8, Math.min(2.4, r * 0.3)) }).forEach((piece, index) =>
    put(`${name}:${index}`, piece.mid, tubeSvg(piece, { tone }), [A.tube(piece.points, piece.radii, { name, owner: owner ?? name })], { extra: { route: name, chunk: index } }),
  );
};
const ARM = G.fillet([ax(CATHODE_CAP.s0), [ARM_X, 0, ZA], [ARM_X, 0, CUP_TOP]], 10, 12, { P, tube: 3.5 });
tubeItems("cathode.arm", ARM, 3.5, { tone: "hi", maxLength: 40 });

capBand("cathode.cap", CATHODE_CAP.s0, CATHODE_CAP.collar[0], CATHODE_CAP.r, { bevel: 0.6 });
ringAt("cathode.collar", AX, CATHODE_CAP.collar[0], CATHODE_CAP.collar[1], CATHODE_CAP.r, CATHODE_CAP.collarR, {}, { extra: Dots([ax(CATHODE_CAP.collar[1], CATHODE_CAP.collarR - 2.8, 20), ax(CATHODE_CAP.collar[1], CATHODE_CAP.collarR - 2.8, 160)].map(at), { size: 0.5 }) });
capBand("cathode.cap", CATHODE_CAP.collar[1], CATHODE_CAP.s1, CATHODE_CAP.r, { bevel: 0.6, extra: Dots(G.dotsOf(AX, CATHODE_CAP.s1, CATHODE_CAP.r - 3.2, 8, P, { all: true, phase: 22.5 * DEG }), { size: 0.45 }) });
discAt("cathode.receptacle", AX, CATHODE_PLUG.boss[0], CATHODE_PLUG.boss[1], CATHODE_PLUG.bossR, { tone: "mid" });
turned("cathode.boot", [[CATHODE_PLUG.boot[0], BOOT_R[1]], [CATHODE_PLUG.boot[1], BOOT_R[0]]], { tone: "mid" }, { inner: bootArcs(CATHODE_PLUG.boot[0], CATHODE_PLUG.boot[1], BOOT_R[1], BOOT_R[0]) });
discAt("cathode.plug", AX, CATHODE_PLUG.shell[0], CATHODE_PLUG.shell[1], CATHODE_PLUG.shellR, { tone: "mid" }, { inner: k.fadedSvg(G.ribsOf(AX, CATHODE_PLUG.shell[0], CATHODE_PLUG.shell[1], CATHODE_PLUG.shellR, 28, P, { fade: RIB_FADE }), { tone: "lo" }) });

for (const [id, { x, host }] of Object.entries(POSTS)) {
  const F = G.frameOf([x, 0, ZA], [0, 0, -1], [0, 1, 0], [1, 0, 0]);
  const low = Math.sqrt(host * host - PAD_R * PAD_R);
  const name = `stand.${id}-pad`;
  const hostShape = R.solids.find((shape) => shape.name === (id === "anode" ? "anode.collar" : id === "stator" ? "stator.core" : "cathode.collar"));
  put(name, [x, 0, ZA - host - PAD_H / 2], S(G.saddleOf(F, PAD_R, host, host + PAD_H, P), { tone: "mid" }), [A.disc(F, low - 0.05, host + PAD_H, PAD_R, { name, ...STAND, seated: true, cut: [hostShape] })]);
}

const SHEDS = [
  [9, 12.6],
  [15, 12],
  [21, 11.4],
  [27, 10.8],
];
const SHED_T = 1.4;
const CORE_R = 7.4;
for (const [id, x] of Object.entries(BUSHINGS)) {
  const F = UP(x, 0);
  discAt(`stand.${id}-bushing-flange`, F, 0, 3.5, 14, { tone: "mid" }, { owner: "stand.frame", bevel: 0.5, extra: Dots(G.dotsOf(F, 3.5, 11.6, 6, P, { all: true, phase: 30 * DEG }), { size: 0.45 }) });
  let from = 3.5;
  SHEDS.forEach(([at, r], index) => {
    discAt(`stand.${id}-bushing-core`, F, from, at - SHED_T / 2, CORE_R, { tone: "mid", crease: "none" }, { owner: "stand.frame" });
    discAt(`stand.${id}-bushing-shed`, F, at - SHED_T / 2, at + SHED_T / 2, r, { tone: "mid" }, { owner: "stand.frame", bevel: 0.3 });
    from = at + SHED_T / 2;
    if (index === SHEDS.length - 1) discAt(`stand.${id}-bushing-core`, F, from, 30, CORE_R, { tone: "mid", crease: "none" }, { owner: "stand.frame" });
  });
  discAt(`stand.${id}-bushing-terminal`, F, 30, BUSHING_H, 6.2, { tone: "mid" }, { owner: "stand.frame", bevel: 0.4 });
}

const ELBOW_DROP = Math.sqrt(ELBOW_R ** 2 - CABLE_R ** 2);
const CABLES = {};
for (const [id, x] of Object.entries(BUSHINGS)) {
  const centre = [x, 0, ZA];
  const boot = R.solids.find((shape) => shape.name === `${id}.boot`);
  put(`${id}.elbow`, centre, S(G.sphereOf(centre, ELBOW_R, P, { steps: 40 }), { tone: "mid" }), [A.ball(centre, ELBOW_R, { name: `${id}.elbow`, seated: true, cut: [boot] })]);
  CABLES[id] = [[x, 0, ZA - ELBOW_DROP], [x, 0, BUSHING_H]];
}
for (const [id, route] of Object.entries(CABLES)) tubeItems(`${id}.cable`, route, CABLE_R, { tone: "mid", limp: true, maxLength: 18 });

const LEAD = { angle: -125 * DEG, r: 34, boss: 2.6, cable: 1.3, x: STATOR.s0 - STATOR.end, drop: -204 };
{
  const point = G.pointOf(AX, LEAD.x, LEAD.r, LEAD.angle);
  const F = G.frameOf(point, [-1, 0, 0], [0, 1, 0], [0, 0, 1]);
  discAt("stator.lead-boss", F, 0, 3, LEAD.boss, { tone: "mid" }, { owner: "stator.core" });
  const start = G.pointOf(F, 3, 0, 0);
  const gland = [LEAD.drop, point[1], 0];
  put("stand.lead-gland", [gland[0], gland[1], 2.5], S(k.cylinder(gland[0], gland[1], 3.6, 0, 2.2, P, 20, 0.3), { tone: "mid" }) + S(k.cylinder(gland[0], gland[1], 2.4, 2.2, 2.8, P, 20, 0.3), { tone: "mid" }), [A.cylinder(gland[0], gland[1], 3.6, 0, 2.2, { name: "stand.lead-gland", ...STAND }), A.cylinder(gland[0], gland[1], 2.4, 2.2, 2.8, { name: "stand.lead-gland-nut", ...STAND })]);
  const route = G.fillet([start, [LEAD.drop, point[1], point[2]], [LEAD.drop, point[1], 5]], 5, 10, { P, tube: LEAD.cable });
  tubeItems("stator.lead", route, LEAD.cable, { tone: "mid", limp: true, maxLength: 14 });
}

put(
  "stand.detector",
  [DETECTOR.x + DETECTOR.w / 2, 0, DETECTOR_H / 2],
  S(k.slabOf(DETECTOR, 0, DETECTOR_H, P, 4, 0.8), { tone: "mid" }) +
    Ln(k.planOutline(k.insetPlan(DETECTOR, 5), DETECTOR_H, P, 3), { tone: "lo" }) +
    Dots(k.corners(DETECTOR, 2.6).map(([x, y]) => at([x, y, DETECTOR_H])), { size: 0.45 }),
  [A.slab(DETECTOR, 0, DETECTOR_H, { name: "stand.detector", ...STAND }, 4)],
);

const GLASS_CURVE = G.profileCurve(GLASS);
const glassShell = (() => {
  const samples = 220;
  const s0 = GLASS[0][0];
  const s1 = GLASS[GLASS.length - 1][0];
  const outer = Array.from({ length: samples + 1 }, (_, index) => {
    const s = s0 + ((s1 - s0) * index) / samples;
    return [s, GLASS_CURVE.radius(s)];
  });
  const inner = outer.map(([s, r]) => [s, r - GLASS_WALL]).reverse();
  return A.body(AX, [...outer, ...inner], { name: "glass.envelope" });
})();
record(glassShell);
function contourOf(curve, F, samples) {
  const aV = G.dot3(F.a, V);
  const uV = G.dot3(F.u, V);
  const vV = G.dot3(F.v, V);
  const flat = Math.hypot(uV, vV);
  const facing = Math.atan2(vV, uV);
  const cOf = (s) => (curve.slope(s) * aV) / flat;
  const point = (s, angle) => G.pointOf(F, s, curve.radius(s), angle);
  const edge = (sa, sb) => {
    let lo = sa;
    let hi = sb;
    const inside = Math.abs(cOf(lo)) <= 1;
    for (let step = 0; step < 50; step++) {
      const mid = (lo + hi) / 2;
      if ((Math.abs(cOf(mid)) <= 1) === inside) lo = mid;
      else hi = mid;
    }
    return inside ? lo : hi;
  };
  return [1, -1].map((sign) => {
    const out = [];
    let previous = null;
    for (let step = 0; step <= samples; step++) {
      const s = curve.s0 + ((curve.s1 - curve.s0) * step) / samples;
      const valid = Math.abs(cOf(s)) <= 1;
      if (previous !== null && valid !== previous.valid) {
        const at = edge(previous.s, s);
        const c = Math.max(-1, Math.min(1, cOf(at)));
        const tip = point(at, facing + sign * Math.acos(c));
        if (valid) out.push(null, tip);
        else out.push(tip, null);
      }
      if (valid) out.push(point(s, facing + sign * Math.acos(cOf(s))));
      previous = { s, valid };
    }
    return out;
  });
}
const SIDES = contourOf(GLASS_CURVE, AX, 3000);
const GLASS_CUTS = [STATOR.s0 - STATOR.end, STATOR.s1 + STATOR.end];
const GLASS_ITEMS = { far: [], near: [], behind: [] };
SIDES.forEach((points, side) => {
  const runs = [];
  let run = [];
  points.forEach((point, index) => {
    if (!point) {
      if (run.length) runs.push(run);
      run = [];
      return;
    }
    const kept = run[run.length - 1];
    const next = points[index + 1];
    if (!kept || !next || Math.hypot(...at(point).map((value, axis) => value - at(kept)[axis])) > 0.7) run.push(point);
  });
  if (run.length) runs.push(run);
  const classOf = (point) => (point[0] <= GLASS_CUTS[0] ? "far" : point[0] < GLASS_CUTS[1] ? null : G.dot3(G.sub3(point, [point[0], 0, ZA]), V) < -1 ? "behind" : "near");
  runs.forEach((list, runIndex) => {
    const pieces = [];
    list.forEach((point) => {
      const kind = classOf(point);
      const open = pieces[pieces.length - 1];
      if (open && open.kind === kind) open.points.push(point);
      else {
        if (open && kind && open.kind) open.points.push(point);
        pieces.push({ kind, points: [point] });
      }
    });
    pieces.forEach(({ kind, points: piece }, pieceIndex) => {
      if (!kind || piece.length < 2) return;
      const name = `glass.${kind}.${side}.${runIndex}.${pieceIndex}`;
      const mid = piece[Math.floor(piece.length / 2)];
      GLASS_ITEMS[kind].push(put(name, mid, Ln(k.pathOf(piece.map(at)), { tone: "mid", className: "xr-glass" }), [A.tube(piece, 0.4 / KS, { name, owner: "glass.envelope" })]));
    });
  });
});

const ELECTRON_FROM = [CUP.x, 0, CUP_Z + CUP_H / 2];
const ELECTRON_TO = SPOT;
const electronD = k.pathOf([at(ELECTRON_FROM), at(ELECTRON_TO)]);
const cupFace = at(ELECTRON_FROM);
const spotAt = at(SPOT);
put(
  "beam.electrons",
  [(ELECTRON_FROM[0] + SPOT[0]) / 2, 0, SPOT[2]],
  `<g class="xr-beam" data-part="electron-beam">` +
    `<circle class="iso-halo xr-glow xr-glow-filament" data-part="filament-glow" cx="${f1(cupFace[0])}" cy="${f1(cupFace[1])}" r="${f1(15 * KS)}"/>` +
    `<circle class="iso-halo xr-glow xr-glow-spot" data-part="spot-glow" cx="${f1(spotAt[0])}" cy="${f1(spotAt[1])}" r="${f1(11 * KS)}"/>` +
    `<path class="xr-stream-halo" d="${electronD}"/>` +
    `<path class="iso-line xr-stream" data-tone="lit" data-part="stream" d="${electronD}"/>` +
    `<path class="xr-electrons" data-part="electrons" d=""/>` +
    `</g>`,
  [A.tube([ELECTRON_FROM, [SPOT[0] + 1.6, 0, SPOT[2]]], 1.2, { name: "beam.electrons", owner: "beam.electrons", limp: true })],
);

const FIELD_Z = DETECTOR_H;
const drop = SPOT[2] - FIELD_Z;
const FIELD = [
  [SPOT[0] - drop * Math.tan(BEAM.anode * DEG), -drop * Math.tan(BEAM.side * DEG)],
  [SPOT[0] + drop * Math.tan(BEAM.cathode * DEG), -drop * Math.tan(BEAM.side * DEG)],
  [SPOT[0] + drop * Math.tan(BEAM.cathode * DEG), drop * Math.tan(BEAM.side * DEG)],
  [SPOT[0] - drop * Math.tan(BEAM.anode * DEG), drop * Math.tan(BEAM.side * DEG)],
].map(([x, y]) => [x, y, FIELD_Z]);
const fieldD = k.pathOf(FIELD.map(at), true);
const centreLines = k.pathOf([at([(FIELD[0][0] + FIELD[1][0]) / 2, FIELD[0][1], FIELD_Z]), at([(FIELD[0][0] + FIELD[1][0]) / 2, FIELD[2][1], FIELD_Z])]) + k.pathOf([at([FIELD[0][0], 0, FIELD_Z]), at([FIELD[1][0], 0, FIELD_Z])]);
const coneHull = G.hullOf([spotAt, ...FIELD.map(at)]);
const coneEdges = FIELD.map((corner) => k.pathOf([spotAt, at(corner)])).join("");
front.push(
  `<g class="xr-field">` +
    `<path class="xr-field-glow" data-part="field-glow" d="${fieldD}"/>` +
    Ln(fieldD, { tone: "faint", className: "xr-field-line" }) +
    Ln(centreLines, { tone: "faint", className: "xr-field-line" }) +
    `</g>` +
    `<g class="xr-cone" data-part="cone">` +
    `<path class="xr-cone-fill" d="${k.pathOf(coneHull, true)}"/>` +
    `<path class="xr-fronts" data-part="fronts" d=""/>` +
    Ln(coneEdges, { tone: "hi", className: "xr-cone-edge" }) +
    `</g>`,
);

A.settle(R, P);
{
  const keyOf = (pattern) => R.items.filter((item) => pattern.test(item.name)).map((item) => item.key);
  const farKey = Math.min(...keyOf(/^stator\.(core|winding)/)) - 0.01;
  const nearKey = Math.max(...keyOf(/^(anode\.(rotor|stem|disc|nut|bearing)|cathode\.(arm|cup)|beam\.|stator\.)/)) + 0.01;
  const limit = Math.min(...keyOf(/^cathode\.(cap|collar|receptacle|plug)/));
  if (nearKey >= limit) console.warn(`glass key ${nearKey.toFixed(2)} not below the cathode cap ${limit.toFixed(2)}`);
  const INSIDE = /^(anode\.(rotor|stem|disc|nut|bearing)|cathode\.(arm|cup)|beam\.)/;
  const behindKey = Math.min(...keyOf(INSIDE)) - 0.01;
  GLASS_ITEMS.far.forEach((item) => (item.key = farKey));
  GLASS_ITEMS.behind.forEach((item) => (item.key = behindKey));
  GLASS_ITEMS.near.forEach((item) => (item.key = nearKey));
}
R.items.sort((a, b) => a.key - b.key);

const LABEL =
  "A rotating-anode X-ray tube on a high-voltage generator. A glass vacuum envelope holds a heated tungsten filament in a focusing cup on the right and a spinning tungsten-rhenium anode disc on the left, driven by a stator around the neck. Electrons boil off the filament, are accelerated across a 22 mm gap by the tube voltage and strike the 12 degree bevel of the disc; the X-rays leave downward as a cone onto a detector, and a screen on the generator shows their spectrum.";
const body = [...back, ...R.items.map((item) => `<g class="xr-it" data-name="${item.name}">${item.svg}</g>`), ...front];
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body, className: "xr-svg" });

const project = (point) => at(point).map(f1);
const DATA = {
  P,
  W,
  H,
  ax: { o: AX.o },
  disc: { at: DISC_AT, r: DISC_R, tan: TAN, track: TRACK_R, slots: SLOTS },
  rotor: { s0: ROTOR.split, s1: ROTOR.s1, r: ROTOR.r, ribs: ROTOR_RIBS },
  electron: { from: project(ELECTRON_FROM), to: project(SPOT) },
  spot: project(SPOT),
  field: FIELD.map(project),
  screen: { x0: EAXIS.x0, x1: EAXIS.x1, base: EAXIS.base, top: EAXIS.top, lift: SPECTRUM_LIFT },
  knobs: {
    kv: { x: PANEL.kv.x, y: -PANEL.kv.z, range: M.XRAY.kv },
    ma: { x: PANEL.ma.x, y: -PANEL.ma.z, range: M.XRAY.ma },
    sweep: KNOB.sweep,
  },
};

const CSS = readFileSync(join(HERE, "xray.css"), "utf8");
const MODEL = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const stage = `<div class="xr-stage" tabindex="0" role="slider" aria-label="X-ray tube. Move the pointer across the figure to set the tube voltage, use the arrow keys for kV (left, right) and mA (up, down), and press Space or click to make an exposure." aria-valuemin="${M.XRAY.kv[0]}" aria-valuemax="${M.XRAY.kv[1]}" aria-valuenow="100" aria-valuetext="Ready, 100 kV, 200 mA">${svg}<span class="xr-said" aria-live="polite"></span></div>`;
const plate = k.plateHtml({
  fig: "Fig 1",
  title: "X-ray tube",
  hint: "Hover for kV · click to expose",
  readout: "ready · 100 kV · 200 mA",
  keys: [
    { mark: "lit", label: "Electron beam: filament to focal spot, across 22 mm of vacuum" },
    { mark: "raised", label: "Tungsten anode disc, 100 mm, spun at 3,000 rpm by the stator" },
    { mark: "edge", label: "X-ray cone, cut off on the anode side by the 12° target angle" },
  ],
  caption:
    "A rotating-anode X-ray tube. The filament current heats the tungsten coil to about 2,500 °C, hot enough for electrons to boil off it; the tube voltage pulls them across 22 mm of vacuum at about half the speed of light (0.55 c at 100 kV) into a spot 4.8 mm long on the 12° bevel, which looks 1 mm long from the patient. As they swerve past tungsten nuclei they brake and radiate (bremsstrahlung): a continuous spectrum that stops sharply at 1 keV per kV, plus tungsten's own K lines at 59 and 67 keV once the voltage passes the 69.5 kV needed to knock out a K-shell electron. Only 0.81% of the energy leaves as X-rays at 100 kV; the other 99% is heat, so the disc spins at 3,000 rpm to spread it round the track.",
  body: stage,
});

const page = k.pageHtml({ title: "X-ray tube", theme: THEME, body: `<style>${CSS}</style><div class="xr">${plate}</div>`, script: kitScript() + MODEL + LIVE, width: 800 });
const file = THEME === "light" ? "xray-tube-light.html" : "xray-tube.html";
writeFileSync(join(HERE, file), page);
console.log("wrote", file, `· ${R.items.length} items · ${R.solids.length} solids · ${R.tubes.length} tubes`);

A.auditOrExit(R, P);
