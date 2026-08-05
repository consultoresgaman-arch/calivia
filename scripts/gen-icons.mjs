// Generates brand PNG icons for the PWA (no external deps).
// Draws a sage-green rounded square with a warm coffee cup + heart motif.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import path from 'node:path';

function makePng(size) {
  const w = size, h = size;
  const buf = Buffer.alloc(w * h * 4);

  function setPixel(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    buf[i] = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = a;
  }

  function fillRoundRect(rx, ry, rw, rh, radius, r, g, b, a=255) {
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        const cx = Math.min(Math.max(x, rx + radius), rx + rw - radius);
        const cy = Math.min(Math.max(y, ry + radius), ry + rh - radius);
        const dx = x - cx, dy = y - cy;
        if (dx*dx + dy*dy <= radius*radius) setPixel(x, y, r, g, b, a);
      }
    }
  }

  function fillCircle(cx, cy, rad, r, g, b, a=255) {
    for (let y = cy - rad; y <= cy + rad; y++) {
      for (let x = cx - rad; x <= cx + rad; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx*dx + dy*dy <= rad*rad) setPixel(x, y, r, g, b, a);
      }
    }
  }

  function fillRing(cx, cy, rad, thick, r, g, b, a=255) {
    for (let y = cy - rad - thick; y <= cy + rad + thick; y++) {
      for (let x = cx - rad - thick; x <= cx + rad + thick; x++) {
        const dx = x - cx, dy = y - cy;
        const d2 = dx*dx + dy*dy;
        if (d2 <= (rad+thick)*(rad+thick) && d2 >= (rad-thick)*(rad-thick))
          setPixel(x, y, r, g, b, a);
      }
    }
  }

  // Background: sage green rounded square #6B8E23
  fillRoundRect(0, 0, w, h, Math.round(size * 0.22), 107, 142, 35, 255);

  // Coffee cup body (warm tan #D2B48C) — a rounded rectangle
  const cupW = Math.round(size * 0.42);
  const cupH = Math.round(size * 0.30);
  const cupX = Math.round((w - cupW) / 2);
  const cupY = Math.round(h * 0.40);
  fillRoundRect(cupX, cupY, cupW, cupH, Math.round(size * 0.06), 210, 180, 140, 255);

  // Cup handle (ring on the right)
  const handleCx = cupX + cupW + Math.round(size * 0.06);
  const handleCy = cupY + Math.round(cupH * 0.45);
  fillRing(handleCx, handleCy, Math.round(size * 0.08), Math.round(size * 0.025), 210, 180, 140, 255);

  // Heart on the cup (dark slate #2C3E50)
  const hrtCx = Math.round(w / 2);
  const hrtCy = cupY + Math.round(cupH * 0.42);
  const hrtR = Math.round(size * 0.06);
  fillCircle(hrtCx - hrtR * 0.55, hrtCy - hrtR * 0.25, hrtR * 0.7, 44, 62, 80, 255);
  fillCircle(hrtCx + hrtR * 0.55, hrtCy - hrtR * 0.25, hrtR * 0.7, 44, 62, 80, 255);
  // triangle bottom
  for (let y = 0; y < hrtR * 1.1; y++) {
    const half = Math.round((hrtR * 1.1 - y) * 0.9);
    for (let x = -half; x <= half; x++) setPixel(hrtCx + x, hrtCy + y, 44, 62, 80, 255);
  }

  // Encode PNG
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    const table = (() => {
      const c = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let k = n;
        for (let i = 0; i < 8; i++) k = k & 1 ? 0xedb88320 ^ (k >>> 1) : k >>> 1;
        c[n] = k >>> 0;
      }
      return c;
    })();
    let crcVal = 0xffffffff;
    for (let i = 0; i < t.length; i++) crcVal = table[(crcVal ^ t[i]) & 0xff] ^ (crcVal >>> 8);
    for (let i = 0; i < data.length; i++) crcVal = table[(crcVal ^ data[i]) & 0xff] ^ (crcVal >>> 8);
    crc.writeUInt32BE((crcVal ^ 0xffffffff) >>> 0, 0);
    return Buffer.concat([len, t, data, crc]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // raw scanlines with filter byte 0
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    buf.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const outDir = path.resolve('public');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'icon-192.png'), makePng(192));
writeFileSync(path.join(outDir, 'icon-512.png'), makePng(512));
writeFileSync(path.join(outDir, 'icon-32.png'), makePng(32));
console.log('Icons generated');
