// The cursor, drawn by code rather than asked of a generator.
//
// The first real runs proved the obvious the hard way: an image model does not
// place a twenty-pixel glyph at a coordinate. Asked for "the tip at 61.5% of
// the width", it drew the arrow in the middle of every laptop, at a different
// size each time. No wording fixes that, so the generator is no longer asked
// for a cursor at all. It draws the MacBook with a blank panel; the four corners
// of that panel are marked; and this module projects one fixed point of the
// panel — the same screen pixel in all twelve frames — through the perspective
// those corners define, and draws the arrow there, at the size that distance
// and angle give it.
//
// Pure functions, standard library only: PNG in, PNG out, and the geometry in
// between. Nothing here decides anything; collection.mjs orchestrates it.

import { deflateSync, inflateSync } from "node:zlib";

// ---------------------------------------------------------------------- PNG

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

// Decodes an 8-bit, non-interlaced PNG into RGBA. That covers what image APIs
// return. Anything else is refused with the reason, never guessed at.
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG");
  let off = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = 0;
  let palette = null;
  let trns = null;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "PLTE") palette = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`PNG bit depth ${bitDepth} is not supported (8 only)`);
  if (interlace) throw new Error("interlaced PNG is not supported");
  const channels = CHANNELS[colorType];
  if (!channels) throw new Error(`PNG colour type ${colorType} is not supported`);
  if (colorType === 3 && !palette) throw new Error("palette PNG without a PLTE chunk");

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  let pos = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[pos];
    const line = raw.subarray(pos + 1, pos + 1 + stride);
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let x = line[i];
      if (filter === 1) x += a;
      else if (filter === 2) x += b;
      else if (filter === 3) x += (a + b) >> 1;
      else if (filter === 4) x += paeth(a, b, c);
      else if (filter !== 0) throw new Error(`unknown PNG filter ${filter} on row ${y}`);
      cur[i] = x & 0xff;
    }
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4;
      const s = x * channels;
      if (colorType === 6) {
        out[o] = cur[s]; out[o + 1] = cur[s + 1]; out[o + 2] = cur[s + 2]; out[o + 3] = cur[s + 3];
      } else if (colorType === 2) {
        out[o] = cur[s]; out[o + 1] = cur[s + 1]; out[o + 2] = cur[s + 2]; out[o + 3] = 255;
      } else if (colorType === 0) {
        out[o] = out[o + 1] = out[o + 2] = cur[s]; out[o + 3] = 255;
      } else if (colorType === 4) {
        out[o] = out[o + 1] = out[o + 2] = cur[s]; out[o + 3] = cur[s + 1];
      } else {
        const idx = cur[s];
        out[o] = palette[idx * 3]; out[o + 1] = palette[idx * 3 + 1]; out[o + 2] = palette[idx * 3 + 2];
        out[o + 3] = trns && idx < trns.length ? trns[idx] : 255;
      }
    }
    prev = cur;
    pos += 1 + stride;
  }
  return { width, height, data: out, hasAlpha: colorType === 4 || colorType === 6 || Boolean(trns) };
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// Encodes RGBA back to PNG: RGB when the source had no alpha, Paeth on every
// row. Deterministic — the same pixels always produce the same bytes.
export function encodePng({ width, height, data, hasAlpha }) {
  const channels = hasAlpha ? 4 : 3;
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4;
      for (let c = 0; c < channels; c += 1) cur[x * channels + c] = data[o + c];
    }
    const row = (stride + 1) * y;
    raw[row] = 4;
    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? cur[i - channels] : 0;
      const c = i >= channels ? prev[i - channels] : 0;
      raw[row + 1 + i] = (cur[i] - paeth(a, prev[i], c)) & 0xff;
    }
    prev = cur;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = hasAlpha ? 6 : 2;
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ----------------------------------------------------------------- geometry

function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-12) throw new Error("degenerate panel corners: three of them are collinear");
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let k = col; k <= n; k += 1) M[r][k] -= f * M[col][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// The homography that takes the panel's own coordinates (screen points, origin
// top-left) to the four marked corners in the image.
export function homography(panelW, panelH, corners) {
  const src = [[0, 0], [panelW, 0], [panelW, panelH], [0, panelH]];
  const dst = [corners.tl, corners.tr, corners.br, corners.bl];
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i += 1) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  return [...solve(A, b), 1];
}

export function project(H, [x, y]) {
  const w = H[6] * x + H[7] * y + 1;
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

// Convex, and wound the way a panel seen from the front is wound in an image
// (y down): TL → TR → BR → BL turns the same way at every corner.
export function quadProblems(corners, width, height) {
  const problems = [];
  const order = ["tl", "tr", "br", "bl"];
  for (const k of order) {
    const p = corners?.[k];
    if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite)) {
      problems.push(`corner ${k} must be [x, y] in image pixels`);
      continue;
    }
    if (p[0] < 0 || p[1] < 0 || p[0] > width || p[1] > height) problems.push(`corner ${k} [${p}] lies outside the ${width}x${height} image`);
  }
  if (problems.length) return problems;
  const pts = order.map((k) => corners[k]);
  const turns = pts.map((p, i) => {
    const a = pts[(i + 1) % 4];
    const b = pts[(i + 2) % 4];
    return (a[0] - p[0]) * (b[1] - a[1]) - (a[1] - p[1]) * (b[0] - a[0]);
  });
  if (turns.every((t) => t < 0)) problems.push("corners run counter-clockwise: either the order is not TL, TR, BR, BL, or the panel is facing away from the camera");
  else if (!turns.every((t) => t > 0)) problems.push("corners do not form a convex quadrilateral — one of them is misplaced");
  const edges = pts.map((p, i) => Math.hypot(pts[(i + 1) % 4][0] - p[0], pts[(i + 1) % 4][1] - p[1]));
  if (Math.min(...edges) < 8) problems.push("one panel edge is shorter than 8 pixels — the panel is too small or the corners collapsed");
  return problems;
}

// ------------------------------------------------------------------- glyph

// The standard arrow, in screen points at pointer size 1, tip at the origin.
// Only the white body is drawn: on a panel that emits nothing else, the
// arrow's black border emits nothing either and is indistinguishable from the
// dark glass around it — which is what a photograph of this would show.
export const ARROW = [
  [0, 0], [0, 16.2], [3.9, 12.6], [6.6, 18.9], [8.9, 17.9], [6.3, 11.8], [11.4, 11.8],
];

export function glyphInPanel(anchor, pointerSize) {
  return ARROW.map(([x, y]) => [anchor[0] + x * pointerSize, anchor[1] + y * pointerSize]);
}

export function projectGlyph(H, anchor, pointerSize) {
  const poly = glyphInPanel(anchor, pointerSize).map((p) => project(H, p));
  const tip = poly[0];
  const height = Math.max(...poly.map((p) => Math.hypot(p[0] - tip[0], p[1] - tip[1])));
  return { poly, tip, height };
}

function inside(poly, x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// Emitted light adds to what the glass already reflects, so the arrow is
// composited additively: a lit pixel over a dark reflection reads white, and
// the room's reflection is still physically there on top of it. 4x4
// supersampling gives the edges their coverage.
export function drawCursor(image, poly, samples = 4) {
  const { width, height, data } = image;
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)) - 1);
  const x1 = Math.min(width - 1, Math.ceil(Math.max(...xs)) + 1);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)) - 1);
  const y1 = Math.min(height - 1, Math.ceil(Math.max(...ys)) + 1);
  let lit = 0;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      let hits = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          if (inside(poly, x + (sx + 0.5) / samples, y + (sy + 0.5) / samples)) hits += 1;
        }
      }
      if (!hits) continue;
      const add = Math.round((255 * hits) / (samples * samples));
      const o = (y * width + x) * 4;
      for (let c = 0; c < 3; c += 1) data[o + c] = Math.min(255, data[o + c] + add);
      lit += 1;
    }
  }
  return lit;
}
