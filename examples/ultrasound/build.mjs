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
const { US } = M;

const W = 940;
const H = 700;
const AZIMUTH = 54;
const ELEVATION = 28;

const PLATE = { x: -318, y: -112, w: 588, d: 236, r: 12 };
const PLATE_H = 14;
const FOOT_H = 8;

const X0 = -172;
const FRONT = 46;
const GEL_TOP = 142;
const GEL = { x: X0 + US.gel.left, y: -66, w: US.gel.right - US.gel.left, d: FRONT + 66, r: 0 };
const GEL_Z = 8;
const RAIL_TOP = 16;
const CASE_TOP = 150;
const WALL = 8;
const APEX_Z = GEL_TOP - US.press + US.radius;
const HEAD = { y0: 26, y1: FRONT, top: 172 };
const GRIP = { x: X0 - 15, y: 28, w: 30, d: 16, r: 6 };
const GRIP_Z = [186, 262];
const RELIEF = [266, 294];
const CABLE_R = 3.4;

const BASE = { x: -20, y: -46, w: 252, d: 112, r: 8 };
const BASE_Z = [6, 34];
const DECK = BASE_Z[1];
const HINGE = [0, BASE.y + 6, DECK + 6];
const TILT = 14 * DEG;
const LID_UP = [0, -Math.sin(TILT), Math.cos(TILT)];
const LID_N = [0, Math.cos(TILT), Math.sin(TILT)];
const LID = { u0: -16, u1: 228, v0: 6, v1: 178, r: 9, back: -5, front: 5 };
const SCREEN = { u0: 0, u1: 212, v0: 26, v1: 166 };
const RECESS = 1.6;

const CONNECTOR = { x: -10, y: 30, w: 26, d: 24, r: 4 };
const CONNECTOR_Z = [DECK + 3, DECK + 20];
const PLUG_AT = [CONNECTOR.x + CONNECTOR.w / 2, CONNECTOR.y + CONNECTOR.d / 2];
const PLUG_RELIEF = [CONNECTOR_Z[1], CONNECTOR_Z[1] + 16];

const KNOBS = { gain: { x: 112, y: -18, r: 12, h: 9 }, focus: { x: 106, y: 26, r: 8, h: 7 } };
const BALL = { x: 152, y: 26, r: 11, ring: 15.5 };
const TGC = { x0: 186, x1: 224, y0: -24, step: 8, count: 8, knob: 5 };
const KEYS = [
  [28, -28, 16, 10],
  [48, -28, 16, 10],
  [68, -28, 16, 10],
  [28, -13, 16, 10],
  [48, -13, 16, 10],
  [68, -13, 16, 10],
];
const FREEZE = { x: 28, y: 5, w: 56, d: 14, r: 3 };

const BOTTLE = { x: -294, y: 70, r: 15 };

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [X0, FRONT, RELIEF[1] + 30],
    ...[LID.u0, LID.u1].map((u) => G.add3(HINGE, G.add3([u, 0, 0], G.mul3(LID_UP, LID.v1)))),
  ],
  W,
  H,
  { pad: 26, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const RIB_FADE = [0.1, 0.55];
const f1 = (value) => Math.round(value * 10) / 10;
const f2 = (value) => Math.round(value * 100) / 100;
const face = (y) => k.sideMatrix([0, y], 0, P, "left");
const UPF = (x, y, z = 0) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const ALONG_Y = (x, y, z) => G.frameOf([x, y, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const LIDF = G.frameOf(HINGE, LID_N, [1, 0, 0], LID_UP);
const lidPoint = (u, v, s = LID.front) => G.add3(HINGE, G.add3(G.mul3(LID_N, s), G.add3([u, 0, 0], G.mul3(LID_UP, v))));
const matrixFor = (origin, ex, ey) => {
  const o = at(origin);
  const a = at(G.add3(origin, ex));
  const b = at(G.add3(origin, ey));
  return [a[0] - o[0], a[1] - o[1], b[0] - o[0], b[1] - o[1], o[0], o[1]];
};
const SCREEN_MATRIX = matrixFor(lidPoint(0, SCREEN.v1, LID.front - RECESS), [1, 0, 0], G.mul3(LID_UP, -1));
const SCREEN_W = SCREEN.u1 - SCREEN.u0;
const SCREEN_H = SCREEN.v1 - SCREEN.v0;
const matrixText = (m) => `matrix(${m.map((value) => Math.round(value * 1000) / 1000).join(" ")})`;
const GEL_MATRIX = (() => {
  const m = matrixFor([X0, FRONT, GEL_TOP], [1, 0, 0], [0, 0, -1]);
  return m;
})();

const R = A.recorder(P);
const record = R.solid;
const STAND = { owner: "stand.frame" };
function put(name, centre, svg, shapes, { bias = 0, extra = {} } = {}) {
  return R.put({ at: centre, bias, svg, name, shapes: shapes.map(record), ...extra });
}
function slab(name, plan, z, h, style = {}, { steps = 3, bevel = 0.5, inner = "", extra = "", meta = {}, part } = {}) {
  const id = R.nameFor(name);
  const svg = S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "mid", ...style, inner }) + extra;
  put(id, [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], part ? `<g data-part="${part}">${svg}</g>` : svg, [A.slab(plan, z, h, { name: id, ...meta }, steps)]);
  return id;
}
function disc(name, F, s0, s1, r, style = {}, { inner = "", extra = "", bevel = 0, meta = {}, part } = {}) {
  const id = R.nameFor(name);
  const svg = S(G.disc(s0, s1, r, F, P, { bevel }), { tone: "mid", ...style, inner }) + extra;
  put(id, G.pointOf(F, (s0 + s1) / 2, 0, 0), part ? `<g data-part="${part}">${svg}</g>` : svg, [A.disc(F, s0, s1, r, { name: id, ...meta })]);
  return id;
}
function turned(name, F, profile, style = {}, { inner = "", extra = "", bevel = 0, meta = {}, smooth } = {}) {
  const id = R.nameFor(name);
  const paths = G.solidOf(profile, F, P, { bevel, ...(smooth === undefined ? {} : { smooth }) });
  put(id, G.pointOf(F, (profile[0][0] + profile[profile.length - 1][0]) / 2, 0, 0), S(paths, { tone: "mid", ...style, inner }) + extra, [A.solid(F, profile, { name: id, ...meta })]);
  return id;
}
function prism(name, F, polygon, s0, s1, style = {}, { inner = "", extra = "", meta = {}, part } = {}) {
  const id = R.nameFor(name);
  const cx = polygon.reduce((sum, [x]) => sum + x, 0) / polygon.length;
  const cy = polygon.reduce((sum, [, y]) => sum + y, 0) / polygon.length;
  const centre = G.add3(F.o, G.add3(G.mul3(F.a, (s0 + s1) / 2), G.add3(G.mul3(F.u, cx), G.mul3(F.v, cy))));
  const svg = S(G.prismOf(F, polygon, s0, s1, P), { tone: "mid", ...style, inner }) + extra;
  put(id, centre, part ? `<g data-part="${part}">${svg}</g>` : svg, [A.prism(F, polygon, s0, s1, { name: id, ...meta })]);
  return id;
}
const roundRect = (u0, v0, u1, v1, r, steps = 6) => k.roundedPlan({ x: u0, y: v0, w: u1 - u0, d: v1 - v0, r }, steps).map(([x, y]) => [x, y]);

const back = [];
const overlay = [];

back.push(`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`);
const FEET = [...k.corners(PLATE, 30), [PLATE.x + PLATE.w / 2, PLATE.y + 30], [PLATE.x + PLATE.w / 2, PLATE.y + PLATE.d - 30]].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
for (const [x, y] of FEET) {
  back.push(S(k.cylinder(x, y, 12, -PLATE_H - FOOT_H, 2, P, 28), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 9, -PLATE_H - FOOT_H + 2, FOOT_H - 2, P, 28), { tone: "mid" }));
  record(A.cylinder(x, y, 12, -PLATE_H - FOOT_H, 2, { name: "stand.foot-pad", ...STAND }));
  record(A.cylinder(x, y, 9, -PLATE_H - FOOT_H + 2, FOOT_H - 2, { name: "stand.foot", ...STAND }));
}
back.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: Ln(k.sideSeam(PLATE, -5, P, 8), { tone: "faint" }) }));
record(A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate", ...STAND }));
back.push(Ln(k.planOutline(k.insetPlan(PLATE, 7), 0, P), { tone: "lo" }));
const PLATE_SCREWS = k.corners(PLATE, 15);
back.push(Ln(PLATE_SCREWS.map(([x, y]) => k.ring(x, y, 2.8, 0, P, 16)).join(""), { tone: "lo" }));
back.push(Dots(PLATE_SCREWS.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));
const STRIP = { x: PLATE.x + 70, y: PLATE.y + PLATE.d - 20, w: 210, d: 7, r: 1 };
back.push(S(k.slabOf(STRIP, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
const TICKS = k.topTicks(STRIP.x + 4, STRIP.x + STRIP.w - 4, 5, 2, STRIP.y + 0.8, 0.6, [2, 3.8], P);
back.push(Ln(TICKS.minor, { tone: "lo" }), Ln(TICKS.major, { tone: "mid" }));
back.push(Dots([at([STRIP.x + 2, STRIP.y + 3.5, 0.6]), at([STRIP.x + STRIP.w - 2, STRIP.y + 3.5, 0.6])], { size: 0.45 }));
const LABEL = { x: PLATE.x + PLATE.w - 92, y: PLATE.y + PLATE.d - 34, w: 62, d: 20, r: 1.5 };
back.push(S(k.slabOf(LABEL, 0, 0.8, P, 3), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(LABEL, 1.6), 0.8, P, 3), { tone: "faint" }));
back.push(Ln([0, 1, 2].map((row) => k.onTop([[LABEL.x + 5, LABEL.y + 5 + row * 4.6], [LABEL.x + [46, 30, 38][row], LABEL.y + 5 + row * 4.6]], 0.8, P)).join(""), { tone: "lo", free: true }));
back.push(Dots([at([LABEL.x + LABEL.w - 4, LABEL.y + 4, 0.8]), at([LABEL.x + LABEL.w - 4, LABEL.y + LABEL.d - 4, 0.8])], { size: 0.45 }));

const TRAY = { x: GEL.x - 12, y: GEL.y - 12, w: GEL.w + 24, d: GEL.d + 20, r: 4 };
slab("phantom.tray", TRAY, 0, GEL_Z, { tone: "mid" }, { steps: 4, bevel: 0.8, meta: STAND, extra: Dots(k.corners(TRAY, 5).map(([x, y]) => at([x, y, GEL_Z])), { size: 0.45 }) });
slab("phantom.back", { x: GEL.x - WALL, y: GEL.y - WALL, w: GEL.w + 2 * WALL, d: WALL, r: 1.2 }, GEL_Z, CASE_TOP - GEL_Z, { tone: "mid" }, { bevel: 0.6 });
for (const [x, side] of [[GEL.x - WALL, "left"], [GEL.x + GEL.w, "right"]]) {
  const plan = { x, y: GEL.y, w: WALL, d: GEL.d, r: 0.6 };
  slab(`phantom.${side}`, plan, GEL_Z, CASE_TOP - GEL_Z, { tone: "mid" }, {
    bevel: 0.6,
    inner: Ln(k.sideSeam(plan, GEL_TOP, P, 3), { tone: "faint" }),
    extra: side === "right" ? Dots([[x + WALL, GEL.y + 10, GEL_Z + 12], [x + WALL, FRONT - 10, GEL_Z + 12], [x + WALL, GEL.y + 10, CASE_TOP - 10], [x + WALL, FRONT - 10, CASE_TOP - 10]].map(at), { size: 0.45 }) : "",
  });
  slab(`phantom.${side}-post`, { x, y: FRONT, w: WALL, d: WALL, r: 1.2 }, GEL_Z, CASE_TOP - GEL_Z, { tone: "mid" }, { bevel: 0.6, extra: Dots([at([x + WALL / 2, FRONT + WALL, GEL_Z + 6]), at([x + WALL / 2, FRONT + WALL, CASE_TOP - 6])], { size: 0.45 }) });
}
slab("phantom.rail", { x: GEL.x, y: FRONT, w: GEL.w, d: WALL, r: 0.6 }, GEL_Z, RAIL_TOP - GEL_Z, { tone: "mid" }, { bevel: 0.5 });
{
  const x = GEL.x + GEL.w + WALL;
  const plate = { x, y: GEL.y + 24, w: 0.8, d: 62, r: 0.4 };
  slab("phantom.plate", plate, 54, 22, { tone: "mid" }, {
    steps: 2,
    bevel: 0,
    extra:
      `<g transform="${k.sideMatrix([x + 0.8, 0], 0, P, "right")}">` +
      Ln([[0, 30], [1, 46], [2, 38]].map(([row, length]) => `M${f2(-(plate.y + plate.d - 6))} ${f2(-(54 + 22 - 6 - row * 4.6))}h${length}`).join(""), { tone: "lo", free: true }) +
      `</g>` +
      Dots([[x + 0.8, plate.y + 3, 54 + 19], [x + 0.8, plate.y + plate.d - 3, 54 + 19], [x + 0.8, plate.y + 3, 57], [x + 0.8, plate.y + plate.d - 3, 57]].map(at), { size: 0.42 }),
  });
}

const ph = (x, d) => [f2(x), f2(d)];
const phPath = (points, closed = false) => k.pathOf(points.map(([x, d]) => [x, d]), closed);
const circleD = (cx, cy, r, steps = 48) => phPath(Array.from({ length: steps }, (_, index) => [cx + r * Math.cos((index / steps) * Math.PI * 2), cy + r * Math.sin((index / steps) * Math.PI * 2)]), true);
const FAN = (() => {
  const half = (US.fov / 2) * DEG;
  const outer = [];
  const inner = [];
  for (let index = 0; index <= 48; index++) {
    const t = -half + (2 * half * index) / 48;
    outer.push(M.usPoint(t, US.depth));
    inner.push(M.usPoint(t, 0));
  }
  return phPath([...inner, ...outer.reverse()], true);
})();
const ARC = (offset, from = -US.fov / 2, to = US.fov / 2, steps = 40) =>
  Array.from({ length: steps + 1 }, (_, index) => {
    const t = (from + ((to - from) * index) / steps) * DEG;
    return [(US.radius + offset) * Math.sin(t), -(US.radius - US.press) + (US.radius + offset) * Math.cos(t)];
  });
const CONTACT = Math.sqrt(US.radius ** 2 - (US.radius - US.press) ** 2);
const wedge = (sign) => {
  const points = [];
  const t0 = Math.asin(CONTACT / US.radius);
  const t1 = (US.fov / 2) * DEG;
  for (let index = 0; index <= 10; index++) {
    const t = t0 + ((t1 - t0) * index) / 10;
    points.push([sign * US.radius * Math.sin(t), -(US.radius - US.press) + US.radius * Math.cos(t)]);
  }
  const end = points[points.length - 1];
  points.push([sign * (Math.abs(end[0]) + 5), 0]);
  return points;
};
const GEL_BOTTOM_D = GEL_TOP - RAIL_TOP;
const gelFace = (() => {
  const x0 = US.gel.left;
  const x1 = US.gel.right;
  const targets =
    `<path class="us-fat" d="${phPath([[x0, 0], [x1, 0], [x1, US.fat], [x0, US.fat]], true)}"/>` +
    Ln(phPath([[x0, US.fat], [x1, US.fat]]), { tone: "faint" }) +
    `<path class="us-cyst" d="${circleD(US.cyst.x, US.cyst.d, US.cyst.r)}"/>` +
    Ln(circleD(US.cyst.x, US.cyst.d, US.cyst.r), { tone: "lo" }) +
    `<path class="us-calcium" d="${circleD(US.calcium.x, US.calcium.d, US.calcium.r, 32)}"/>` +
    Ln(circleD(US.calcium.x, US.calcium.d, US.calcium.r, 32), { tone: "mid" }) +
    US.wires.map((wire) => `<path class="us-wire" d="${circleD(wire.x, wire.d, 0.9, 12)}"/>`).join("") +
    `<g class="us-flash">` +
    `<path data-flash="calcium" d="${circleD(US.calcium.x, US.calcium.d, US.calcium.r + 1.6, 32)}"/>` +
    `<path data-flash="cyst" d="${circleD(US.cyst.x, US.cyst.d, US.cyst.r + 1.2)}"/>` +
    US.wires.map((wire, index) => `<path data-flash="wire${index}" d="${circleD(wire.x, wire.d, 2.4, 16)}"/>`).join("") +
    `<path data-flash="fat" d="${phPath([[x0, US.fat - 0.8], [x1, US.fat - 0.8], [x1, US.fat + 0.8], [x0, US.fat + 0.8]], true)}"/>` +
    `</g>`;
  const waves =
    `<g class="us-waves" clip-path="url(#us-gel-clip)">` +
    `<path class="us-fan" d="${FAN}"/>` +
    `<path class="us-beam" data-part="beam" d=""/>` +
    `<path class="iso-line us-line" data-tone="lit" data-part="scanline" d=""/>` +
    `<g data-part="echoes"></g>` +
    `<g data-part="pulse"></g>` +
    `</g>`;
  const couplant = [wedge(1), wedge(-1)].map((points) => `<path class="us-couplant" data-part="couplant" d="${phPath(points, true)}"/>`).join("");
  return (
    `<g transform="${face(FRONT)}"><g transform="translate(${X0} ${-GEL_TOP})">` +
    `<clipPath id="us-gel-clip"><path d="${phPath([[x0, -6], [x1, -6], [x1, GEL_BOTTOM_D], [x0, GEL_BOTTOM_D]], true)}"/></clipPath>` +
    `<path class="us-gel" d="${phPath([[x0, 0], [x1, 0], [x1, GEL_BOTTOM_D], [x0, GEL_BOTTOM_D]], true)}"/>` +
    targets +
    waves +
    couplant +
    Ln(FAN, { tone: "faint", className: "us-fan-edge" }) +
    `</g></g>`
  );
})();
const GEL_SHAPE = A.slab(GEL, GEL_Z, GEL_TOP - GEL_Z, { name: "phantom.gel" }, 1);
put("phantom.gel", [GEL.x + GEL.w / 2, GEL.y + GEL.d / 2, (GEL_Z + GEL_TOP) / 2], S(k.slabOf(GEL, GEL_Z, GEL_TOP - GEL_Z, P, 1, 0), { tone: "hi", className: "us-gel-solid" }) + gelFace, [GEL_SHAPE]);

const HEAD_POLY = (() => {
  const half = (US.fov / 2) * DEG;
  const arc = Array.from({ length: 33 }, (_, index) => {
    const t = -half + (2 * half * index) / 32;
    return [US.radius * Math.sin(t), APEX_Z - US.radius * Math.cos(t)];
  });
  const end = arc[arc.length - 1];
  return [...arc, [end[0], end[1] + 5], [end[0] - 3, HEAD.top - 4], [end[0] - 6.5, HEAD.top], [-end[0] + 6.5, HEAD.top], [-end[0] + 3, HEAD.top - 4], [-end[0], end[1] + 5]];
})();
const headFrame = G.frameOf([X0, HEAD.y0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const headFace = (() => {
  const side = US.radius * Math.sin((US.fov / 2) * DEG);
  const reach = (offset) => Math.asin(side / (US.radius + offset)) / DEG;
  const lens = ARC(-1.4, -reach(-1.4), reach(-1.4), 64);
  const backing = ARC(-4.2, -reach(-4.2), reach(-4.2), 64);
  const ticks = [];
  for (let index = 0; index < US.elements; index += 4) {
    const t = (-US.fov / 2 + (US.fov * (index + 2)) / US.elements) * DEG;
    const a = [(US.radius - 1.9) * Math.sin(t), -(US.radius - US.press) + (US.radius - 1.9) * Math.cos(t)];
    const b = [(US.radius - 3.7) * Math.sin(t), -(US.radius - US.press) + (US.radius - 3.7) * Math.cos(t)];
    ticks.push(`M${f2(a[0])} ${f2(-a[1])}L${f2(b[0])} ${f2(-b[1])}`);
  }
  const flip = (points) => points.map(([x, d]) => [x, -d]);
  return (
    `<g transform="${face(FRONT)}"><g transform="translate(${X0} ${-GEL_TOP}) scale(1 -1)">` +
    Ln(phPath(flip(lens)), { tone: "faint" }) +
    Ln(phPath(flip(backing)), { tone: "lo" }) +
    Ln(ticks.join(""), { tone: "lo", className: "us-elements" }) +
    `<path class="iso-line us-firing" data-tone="lit" data-part="firing" d=""/>` +
    `</g></g>`
  );
})();
const HEAD_ID = prism("probe.head", headFrame, HEAD_POLY, 0, HEAD.y1 - HEAD.y0, { tone: "hi" }, { meta: { seated: true, cut: [GEL_SHAPE] }, inner: headFace });
const NECK = [[-22, HEAD.top], [22, HEAD.top], [15.5, GRIP_Z[0]], [-15.5, GRIP_Z[0]]];
prism("probe.neck", G.frameOf([X0, 28, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]), NECK, 0, 16, { tone: "hi" });
slab("probe.grip", GRIP, GRIP_Z[0], GRIP_Z[1] - GRIP_Z[0], { tone: "hi" }, {
  steps: 6,
  bevel: 0.6,
  inner: Ln(k.sideSeam(GRIP, GRIP_Z[0] + 12, P, 6) + k.sideSeam(GRIP, GRIP_Z[1] - 14, P, 6), { tone: "faint" }),
  extra: Dots([at([GRIP.x + 5, GRIP.y + GRIP.d, GRIP_Z[1] - 7])], { size: 0.7, tone: "hi" }),
});
slab("probe.cap", k.insetPlan(GRIP, 3), GRIP_Z[1], RELIEF[0] - GRIP_Z[1], { tone: "hi" }, { steps: 5, bevel: 0.4 });
{
  const F = UPF(X0, GRIP.y + GRIP.d / 2, 0);
  const profile = [[RELIEF[0], 8.2], [RELIEF[0] + 5, 7.6, 1], [RELIEF[0] + 14, 6.2, 1], [RELIEF[1], 4.8]];
  const curve = G.profileCurve(profile);
  turned("probe.relief", F, profile, { tone: "mid" }, { inner: Ln([RELIEF[0] + 8, RELIEF[0] + 13, RELIEF[0] + 18, RELIEF[0] + 23].map((s) => G.arcOf(F, s, curve.radius(s), P, { slope: curve.slope(s) })).join(""), { tone: "faint" }) });
}

const tubeItems = (name, route, r, { tone = "mid", limp = true, maxLength = 18, rims } = {}) => {
  R.route(name, route, r, { limp, rims, owner: name });
  tubePieces(route, r, P, { maxLength, spacing: 1 }).forEach((piece, index) =>
    put(`${name}:${index}`, piece.mid, tubeSvg(piece, { tone }), [A.tube(piece.points, piece.radii, { name, owner: name, limp })], { extra: { route: name, chunk: index } }),
  );
};
const PLUG_TOP = [PLUG_AT[0], PLUG_AT[1], PLUG_RELIEF[1]];
const CABLE = G.fillet(
  [
    [X0, GRIP.y + GRIP.d / 2, RELIEF[1]],
    [X0, GRIP.y + GRIP.d / 2, RELIEF[1] + 26],
    [-92, 40, RELIEF[1] + 16],
    [PLUG_AT[0], PLUG_AT[1], 176],
    PLUG_TOP,
  ],
  34,
  16,
  { P, tube: CABLE_R },
);
tubeItems("probe.cable", CABLE, CABLE_R, { tone: "mid", maxLength: 22 });

const BASE_FEET = k.corners(BASE, 18);
for (const [x, y] of BASE_FEET) {
  put("stand.scanner-foot", [x, y, 3], S(k.cylinder(x, y, 7, 0, BASE_Z[0], P, 24, 0.3), { tone: "lo" }), [A.cylinder(x, y, 7, 0, BASE_Z[0], { name: "stand.scanner-foot", ...STAND })]);
}
const PALM = { x: BASE.x + 10, y: BASE.y + BASE.d - 22, w: BASE.w - 20, d: 14, r: 4 };
slab("scanner.base", BASE, BASE_Z[0], BASE_Z[1] - BASE_Z[0], { tone: "mid" }, {
  steps: 8,
  bevel: 1.2,
  inner: Ln(k.sideSeam(BASE, BASE_Z[0] + 9, P, 8), { tone: "faint" }),
  extra:
    Ln(k.planOutline(PALM, DECK, P, 4), { tone: "faint" }) +
    Ln(
      Array.from({ length: 7 }, (_, index) => k.planOutline({ x: 56 + index * 5.6, y: BASE.y + 3, w: 2.4, d: 11, r: 1.2 }, DECK, P, 2)).join(""),
      { tone: "lo" },
    ) +
    `<g transform="${k.sideMatrix([BASE.x + BASE.w, 0], 0, P, "right")}">${Ln([0, 1, 2, 3].map((index) => {
      const z = -(BASE_Z[0] + 13 + index * 4);
      return k.pathOf(k.roundedPlan({ x: -BASE.y - BASE.d + 22, y: z - 1.1, w: BASE.d - 44, d: 2.2, r: 1.1 }, 3), true);
    }).join(""), { tone: "lo" })}</g>`,
  meta: { name: "scanner.base" },
});
slab("scanner.connector-plate", { x: CONNECTOR.x - 4, y: CONNECTOR.y - 4, w: CONNECTOR.w + 8, d: CONNECTOR.d + 8, r: 3 }, DECK, 3, { tone: "mid" }, { extra: Dots(k.corners({ x: CONNECTOR.x - 4, y: CONNECTOR.y - 4, w: CONNECTOR.w + 8, d: CONNECTOR.d + 8 }, 2).map(([x, y]) => at([x, y, DECK + 3])), { size: 0.42 }) });
slab("scanner.connector", CONNECTOR, CONNECTOR_Z[0], CONNECTOR_Z[1] - CONNECTOR_Z[0], { tone: "hi" }, { steps: 4, bevel: 0.6, inner: Ln(k.sideSeam(CONNECTOR, CONNECTOR_Z[0] + 6, P, 4), { tone: "faint" }) });
slab("scanner.latch", { x: CONNECTOR.x + CONNECTOR.w, y: CONNECTOR.y + 6, w: 4, d: 12, r: 1.2 }, CONNECTOR_Z[0] + 4, 9, { tone: "mid" }, { steps: 2, bevel: 0.3 });
{
  const F = UPF(PLUG_AT[0], PLUG_AT[1], 0);
  const profile = [[PLUG_RELIEF[0], 7.6], [PLUG_RELIEF[0] + 4, 7, 1], [PLUG_RELIEF[0] + 11, 5.6, 1], [PLUG_RELIEF[1], 4.6]];
  const curve = G.profileCurve(profile);
  turned("scanner.relief", F, profile, { tone: "mid" }, { inner: Ln([5, 9, 13].map((ds) => G.arcOf(F, PLUG_RELIEF[0] + ds, curve.radius(PLUG_RELIEF[0] + ds), P, { slope: curve.slope(PLUG_RELIEF[0] + ds) })).join(""), { tone: "faint" }) });
}
for (const [x, y, w, d] of KEYS) {
  const plan = { x, y, w, d, r: 2 };
  slab("scanner.key", plan, DECK, 2.4, { tone: "hi" }, { steps: 3, bevel: 0.5, extra: Dots([at([x + w - 3, y + 3, DECK + 2.4])], { size: 0.45, tone: "mid" }) });
}
slab("scanner.freeze", FREEZE, DECK, 3, { tone: "hi" }, { steps: 4, bevel: 0.6, extra: Ln(k.planOutline(k.insetPlan(FREEZE, 2.2), DECK + 3, P, 3), { tone: "faint" }) });
slab("scanner.power", { x: 36, y: BASE.y + 3, w: 12, d: 10, r: 4 }, DECK, 2.2, { tone: "hi" }, { steps: 4, bevel: 0.4, extra: Dots([at([42, BASE.y + 8, DECK + 2.2])], { size: 0.6, tone: "hi" }) });

const knobPointer = (id) => `<path class="iso-line" data-tone="hi" data-part="${id}-pointer" data-free="end" d=""/>`;
for (const [id, knob] of Object.entries(KNOBS)) {
  const F = UPF(knob.x, knob.y, 0);
  disc(`scanner.${id}-skirt`, F, DECK, DECK + 1.6, knob.r + 3, { tone: "mid" }, { bevel: 0.4 });
  const ribs = G.ribsOf(F, DECK + 1.6, DECK + knob.h, knob.r, 40, P, { fade: RIB_FADE });
  disc(`scanner.${id}-knob`, F, DECK + 1.6, DECK + knob.h, knob.r, { tone: "hi" }, {
    bevel: 0.6,
    inner: k.fadedSvg(ribs, { tone: "lo" }),
    extra: Ln(k.ring(knob.x, knob.y, knob.r - 3.2, DECK + knob.h, P, 32), { tone: "faint" }) + knobPointer(id, knob) + Dots([at([knob.x, knob.y, DECK + knob.h])], { size: 0.5, tone: "hi" }),
  });
  const ticks = { minor: [], major: [] };
  for (let index = 0; index <= 10; index++) {
    const a = (-135 + 27 * index) * DEG;
    const r0 = knob.r + 3;
    const r1 = knob.r + (index % 5 ? 4.6 : 5.8);
    (index % 5 ? ticks.minor : ticks.major).push(k.lineOnTop([knob.x + r0 * Math.sin(a), knob.y - r0 * Math.cos(a)], [knob.x + r1 * Math.sin(a), knob.y - r1 * Math.cos(a)], DECK, P));
  }
  back.push(`<g data-deck-ticks>${Ln(ticks.minor.join(""), { tone: "lo" })}${Ln(ticks.major.join(""), { tone: "mid" })}</g>`);
}
{
  const F = UPF(BALL.x, BALL.y, 0);
  const lift = 4;
  const lip = DECK + 2;
  const centre = [BALL.x, BALL.y, lip + lift];
  const opening = Math.sqrt(BALL.r ** 2 - lift ** 2);
  const ringId = R.nameFor("scanner.ball-ring");
  const ringShape = A.ring(F, DECK, lip, opening, BALL.ring, { name: ringId });
  put(ringId, [BALL.x, BALL.y, DECK + 1], S(G.ringBand(DECK, lip, opening, BALL.ring, F, P), { tone: "mid" }), [ringShape]);
  const cap = [];
  for (let a = 0; a < 48; a++) {
    for (let b = 0; b <= 12; b++) {
      const polar = (b / 12) * Math.acos(-lift / BALL.r);
      const az = (a / 48) * Math.PI * 2;
      cap.push(at([centre[0] + BALL.r * Math.sin(polar) * Math.cos(az), centre[1] + BALL.r * Math.sin(polar) * Math.sin(az), centre[2] + BALL.r * Math.cos(polar)]));
    }
  }
  const clip = k.pathOf(G.hullOf(cap), true);
  const baseShape = R.solids.find((shape) => shape.name === "scanner.base");
  put(
    "scanner.ball",
    centre,
    `<clipPath id="us-ball-clip"><path d="${clip}"/></clipPath><g clip-path="url(#us-ball-clip)">${S(G.sphereOf(centre, BALL.r, P, { steps: 48 }), { tone: "hi" })}</g>` + Ln(G.arcOf(F, lip, opening, P, { least: -1 }), { tone: "lo" }),
    [A.ball(centre, BALL.r, { name: "scanner.ball", seated: true, cut: [ringShape, baseShape, A.disc(F, DECK - 20, lip, opening + 0.5, { name: "scanner.ball-socket", piece: "", ride: "", move: [0, 0, 0] })] })],
  );
  for (const side of [-1, 1]) slab("scanner.ball-key", { x: BALL.x + side * 25 - 5, y: BALL.y - 7, w: 10, d: 14, r: 3 }, DECK, 2.2, { tone: "hi" }, { steps: 3, bevel: 0.4 });
}
const TGC_ROWS = Array.from({ length: TGC.count }, (_, index) => TGC.y0 + index * TGC.step);
back.push(
  `<g data-tgc-slots>${Ln(TGC_ROWS.map((y) => k.planOutline({ x: TGC.x0, y: y - 1.2, w: TGC.x1 - TGC.x0, d: 2.4, r: 1.2 }, DECK, P, 3)).join(""), { tone: "lo" })}</g>`,
);
const TGC_TRAVEL = TGC.x1 - TGC.x0 - TGC.knob - 2;
const tgcX = (db) => TGC.x0 + 1 + (db / 48) * TGC_TRAVEL;
TGC_ROWS.forEach((y, index) => {
  const plan = { x: TGC.x0 + 1, y: y - TGC.knob / 2, w: TGC.knob, d: TGC.knob, r: 1.2 };
  slab("scanner.tgc", plan, DECK, 4.6, { tone: "hi" }, { steps: 3, bevel: 0.4, part: `tgc${index}`, extra: Ln(k.lineOnTop([plan.x + TGC.knob / 2, plan.y], [plan.x + TGC.knob / 2, plan.y + TGC.knob], DECK + 4.6, P), { tone: "lo" }) });
});

const LID_POLY = roundRect(LID.u0, LID.v0, LID.u1, LID.v1, LID.r, 6);
const lidFaceMatrix = matrixFor(lidPoint(0, 0, LID.front), [1, 0, 0], G.mul3(LID_UP, -1));
const lidWalls = (() => {
  const c = (u, v, s) => at(lidPoint(u, v, s));
  const quads = [
    [[SCREEN.u0, SCREEN.v0], [SCREEN.u1, SCREEN.v0], 3],
    [[SCREEN.u0, SCREEN.v1], [SCREEN.u0, SCREEN.v0], 1],
  ];
  return quads.map(([[ua, va], [ub, vb], shade]) => `<path class="iso-shade" data-shade="${shade}" d="${k.pathOf([c(ua, va, LID.front), c(ub, vb, LID.front), c(ub, vb, LID.front - RECESS), c(ua, va, LID.front - RECESS)], true)}"/>`).join("");
})();
const lidRect = (u0, v0, u1, v1, r) => k.pathOf(k.roundedPlan({ x: u0, y: -v1, w: u1 - u0, d: v1 - v0, r }, 4), true);
const LID_INNER =
  `<g transform="${matrixText(lidFaceMatrix)}">` +
  Ln(lidRect(SCREEN.u0 - 4, SCREEN.v0 - 4, SCREEN.u1 + 4, SCREEN.v1 + 4, 3), { tone: "faint" }) +
  Ln(lidRect(70, 9, 142, 17, 4), { tone: "lo" }) +
  `</g>` +
  `<g class="us-screen-walls">${lidWalls}</g>` +
  `<path class="us-screen-ground" d="${k.pathOf([[SCREEN.u0, SCREEN.v0], [SCREEN.u1, SCREEN.v0], [SCREEN.u1, SCREEN.v1], [SCREEN.u0, SCREEN.v1]].map(([u, v]) => at(lidPoint(u, v, LID.front - RECESS))), true)}"/>` +
  `<g transform="${matrixText(lidFaceMatrix)}">${Ln(lidRect(SCREEN.u0, SCREEN.v0, SCREEN.u1, SCREEN.v1, 1.5), { tone: "lo" })}` +
  `<text class="iso-face-text" data-tone="lo" x="106" y="-11.6" font-size="4.2" text-anchor="middle">C5-2 · 128 ch</text>` +
  `</g>` +
  Dots([[LID.u0 + 6, LID.v0 + 6], [LID.u1 - 6, LID.v0 + 6], [LID.u0 + 6, LID.v1 - 6], [LID.u1 - 6, LID.v1 - 6]].map(([u, v]) => at(lidPoint(u, v))), { size: 0.45 });
prism("scanner.lid", LIDF, LID_POLY, LID.back, LID.front, { tone: "mid" }, { inner: LID_INNER });
for (const [u0, u1] of [[4, 30], [174, 200]]) {
  const F = G.frameOf(HINGE, [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  disc("scanner.hinge", F, u0, u1, 6, { tone: "mid" }, { bevel: 0.4 });
}

const bottle = (() => {
  const F = UPF(BOTTLE.x, BOTTLE.y, 0);
  const profile = [[0, BOTTLE.r], [72, BOTTLE.r, 1], [80, BOTTLE.r - 3, 1], [86, 7.5]];
  const curve = G.profileCurve(profile);
  turned("stand.gel-bottle", F, profile, { tone: "hi" }, { meta: STAND, inner: Ln([18, 52].map((s) => G.arcOf(F, s, BOTTLE.r, P)).join(""), { tone: "faint" }) });
  disc("stand.gel-cap", F, 86, 98, 7.5, { tone: "mid" }, { bevel: 0.4, meta: STAND, inner: k.fadedSvg(G.ribsOf(F, 86, 98, 7.5, 28, P, { fade: RIB_FADE }), { tone: "lo" }) });
  turned("stand.gel-nozzle", F, [[98, 3.4], [106, 2.2, 1], [112, 1]], { tone: "mid" }, { meta: STAND });
  return curve;
})();

A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);

const SCREEN_LAYOUT = (() => {
  const scale = 0.84;
  const left = 12;
  const top = 12;
  const fanHalf = (US.radius + US.depth) * Math.sin((US.fov / 2) * DEG);
  const vTop = US.radius * Math.cos((US.fov / 2) * DEG) - US.radius;
  return { scale, cx: left + fanHalf * scale, top: top - vTop * scale, vTop, fanHalf };
})();
const screenPoint = (u, v) => [SCREEN_LAYOUT.cx + u * SCREEN_LAYOUT.scale, SCREEN_LAYOUT.top + v * SCREEN_LAYOUT.scale];
const SCALE_X = screenPoint(SCREEN_LAYOUT.fanHalf + 6, 0)[0];
const depthTicks = (() => {
  const minor = [];
  const major = [];
  for (let mm = 0; mm <= US.depth; mm += 10) {
    const [, y] = screenPoint(0, mm);
    (mm % 50 ? minor : major).push(`M${f2(SCALE_X)} ${f2(y)}h${mm % 50 ? 1.6 : 2.8}`);
  }
  const [, y0] = screenPoint(0, 0);
  const [, y1] = screenPoint(0, US.depth);
  return { spine: `M${f2(SCALE_X)} ${f2(y0)}V${f2(y1)}`, minor: minor.join(""), major: major.join(""), labels: [50, 100].map((mm) => `<text class="us-lcd us-lcd-small" x="${f2(SCALE_X + 4.4)}" y="${f2(screenPoint(0, mm)[1] + 1.4)}">${mm / 10}</text>`).join("") };
})();
const TEXT_X = SCREEN_W - 6;
overlay.push(
  `<g class="us-screen" transform="${matrixText(SCREEN_MATRIX)}">` +
    `<clipPath id="us-screen-clip"><rect x="0" y="0" width="${SCREEN_W}" height="${SCREEN_H}" rx="1.5"/></clipPath>` +
    `<g clip-path="url(#us-screen-clip)">` +
    `<path class="us-lcd-line" d="${depthTicks.spine}${depthTicks.minor}${depthTicks.major}"/>` +
    depthTicks.labels +
    `<path class="us-lcd-mark" data-part="focus-mark" d=""/>` +
    `<path class="us-lcd-tgc" data-part="tgc-curve" d=""/>` +
    `<path class="us-lcd-cursor" data-part="cursor" d=""/>` +
    `<circle class="us-lcd-mark" cx="${f2(screenPoint(-SCREEN_LAYOUT.fanHalf, 0)[0] + 2)}" cy="${f2(SCREEN_LAYOUT.top + SCREEN_LAYOUT.vTop * SCREEN_LAYOUT.scale + 1)}" r="1.4"/>` +
    `<text class="us-lcd" x="8" y="9">C5-2 · 3.5 MHz</text>` +
    `<text class="us-lcd" x="${TEXT_X}" y="9" text-anchor="end" data-part="lcd-rate">50 Hz</text>` +
    `<text class="us-lcd us-lcd-dim" x="${TEXT_X}" y="${SCREEN_H - 30}" text-anchor="end" data-part="lcd-depth">D 12 cm</text>` +
    `<text class="us-lcd us-lcd-dim" x="${TEXT_X}" y="${SCREEN_H - 21}" text-anchor="end" data-part="lcd-focus">F 6 cm</text>` +
    `<text class="us-lcd us-lcd-dim" x="${TEXT_X}" y="${SCREEN_H - 12}" text-anchor="end" data-part="lcd-gain">G 0 dB</text>` +
    `<text class="us-lcd us-lcd-dim" x="8" y="${SCREEN_H - 8}" data-part="lcd-state">LIVE</text>` +
    `</g>` +
    `</g>`,
);

const LABEL_TEXT =
  "A portable ultrasound scanner beside a tissue phantom. A convex probe rests on the phantom's gel with a film of coupling gel under its curved face; a cable runs to the scanner, whose open lid shows the fan-shaped image. The phantom's front face is the slice the machine images: a fat layer, a calcified nodule, a fluid-filled cyst and a column of nylon wires. A pulse leaves 32 of the probe's 128 crystals, focuses as it travels, echoes off each boundary and returns to the crystals, and the scanner turns echo time into depth to paint the image line by line.";
const itemSvg = R.items.map((item) => `<g class="us-it" data-name="${item.name}">${item.svg}</g>`).join("");
const backSvg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: [...back, itemSvg], className: "us-back" });
const frontSvg = `<svg class="us-front" viewBox="0 0 ${W} ${H}" aria-hidden="true">${overlay.join("")}</svg>`;

const CHAPTERS = [
  ["couple", "Couple", "A film of gel joins the probe to the body. With air in the gap, 99.9% of the sound would bounce straight back."],
  ["transmit", "Transmit", "A voltage spike rings 32 piezoelectric crystals at 3.5 MHz. The outer ones fire first, so the pulse converges on the focus."],
  ["travel", "Travel", "The pulse crosses tissue at 1,540 m/s, about 1.5 mm per microsecond, narrowing to 1.9 mm at the focus."],
  ["echo", "Echo", "Wherever the acoustic impedance changes, part of the pulse reflects: 0.7% at fat, 43% at calcium, which leaves a shadow beneath."],
  ["listen", "Listen", "The same crystals now listen. Each echo's delay gives its depth: 13 µs of round trip for every centimetre."],
  ["image", "Image", "The scanner steps the aperture along the array, 128 lines in 20 ms. Brightness is echo strength; position is the line and its delay."],
  ["compensate", "Compensate", "Deep echoes return weaker, 3.5 dB per cm at 3.5 MHz. The time-gain sliders add that back so depth looks even."],
  ["live", "Live", "Fifty frames a second: a moving picture of what lies under the probe, built only from echoes."],
];

const DATA = {
  P,
  W,
  H,
  KS,
  X0,
  FRONT,
  GEL_TOP,
  gelMatrix: GEL_MATRIX,
  screen: { matrix: SCREEN_MATRIX, w: SCREEN_W, h: SCREEN_H, ...SCREEN_LAYOUT, scaleX: SCALE_X },
  knobs: KNOBS,
  deck: DECK,
  tgc: { x0: TGC.x0 + 1, travel: TGC_TRAVEL, rows: TGC_ROWS },
  chapters: CHAPTERS.map(([id, name, text]) => ({ id, name, say: text })),
};

const CSS = readFileSync(join(HERE, "ultrasound.css"), "utf8");
const MODEL = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const rail = `<ol class="us-rail" aria-label="Chapters">${CHAPTERS.map(([id, name], index) => `<li><button type="button" class="us-chapter" data-chapter="${index}"><span class="us-num">${String(index + 1).padStart(2, "0")}</span><span class="us-name">${name}</span><span class="us-bar"><span></span></span></button></li>`).join("")}</ol>`;
const story = `<div class="us-story">${rail}<p class="us-say" aria-live="polite">${CHAPTERS[0][2]}</p></div>`;
const stageHtml = `<div class="us-stage" tabindex="0" role="slider" aria-label="Ultrasound scanner. Move the pointer over the phantom or the screen to choose a scan line; left and right arrows step the line, up and down move the focus, Space plays or pauses the story." aria-valuemin="1" aria-valuemax="${US.lines}" aria-valuenow="20" aria-valuetext="Story, chapter 1 of ${CHAPTERS.length}: Couple">${backSvg}<canvas class="us-canvas" aria-hidden="true"></canvas>${frontSvg}</div>`;
const plate = k.plateHtml({
  fig: "Fig 2",
  title: "Ultrasound",
  hint: "Hover a line · space to play",
  readout: "couple · air reflects 99.9%",
  keys: [
    { mark: "lit", label: "The pulse and the crystals firing it" },
    { mark: "edge", label: "Echoes on their way back to the probe" },
    { mark: "raised", label: "The phantom's slice: fat, calcium, cyst and wires" },
  ],
  caption:
    "A convex probe sends a 3.5 MHz pulse into a tissue phantom, 32 crystals at a time, and listens. Sound crosses tissue at 1,540 m/s, so an echo from 6 cm returns after 78 µs; a line 12 cm deep takes 156 µs, and 128 lines make a frame in 20 ms. Strength comes from impedance mismatch: fat reflects 0.7%, calcium 43%, leaving a shadow; the cyst's fluid reflects nothing inside and attenuates less, so the tissue behind it is brighter.",
  body: stageHtml + story,
});
const page = k.pageHtml({ title: "Ultrasound", theme: THEME, body: `<style>${CSS}</style><div class="us">${plate}</div>`, script: kitScript() + MODEL + LIVE, width: 980 });
const file = THEME === "light" ? "ultrasound-light.html" : "ultrasound.html";
writeFileSync(join(HERE, file), page);
console.log("wrote", file, `· ${R.items.length} items · ${R.solids.length} solids · ${R.tubes.length} tubes`);

A.auditOrExit(R, P);
