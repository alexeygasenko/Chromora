import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const outputSize = 64;
const scale = 4;
const size = outputSize * scale;

const colors = {
  ink: [10, 34, 62, 244],
  cyan: [65, 224, 238, 255],
  blue: [105, 142, 255, 255],
  pink: [239, 126, 215, 255],
  mint: [112, 235, 182, 255],
  white: [239, 251, 255, 255],
};

function createCanvas() {
  return new Uint8Array(size * size * 4);
}

function blendPixel(canvas, x, y, color) {
  if ((x < 0) || (y < 0) || (x >= size) || (y >= size)) {return;}
  const index = ((y * size) + x) * 4;
  const sourceAlpha = color[3] / 255;
  const destinationAlpha = canvas[index + 3] / 255;
  const outputAlpha = sourceAlpha + (destinationAlpha * (1 - sourceAlpha));
  if (outputAlpha <= 0) {return;}
  for (let channel = 0; channel < 3; channel++) {
    canvas[index + channel] = Math.round(((color[channel] * sourceAlpha) + (canvas[index + channel] * destinationAlpha * (1 - sourceAlpha))) / outputAlpha);
  }
  canvas[index + 3] = Math.round(outputAlpha * 255);
}

function line(canvas, x1, y1, x2, y2, width, color) {
  x1 *= scale; y1 *= scale; x2 *= scale; y2 *= scale; width *= scale;
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - width));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(x1, x2) + width));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - width));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(y1, y2) + width));
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = (dx * dx) + (dy * dy);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const projection = lengthSquared ? Math.max(0, Math.min(1, (((x - x1) * dx) + ((y - y1) * dy)) / lengthSquared)) : 0;
      const distance = Math.hypot(x - (x1 + (projection * dx)), y - (y1 + (projection * dy)));
      if (distance <= (width / 2)) {blendPixel(canvas, x, y, color);}
    }
  }
}

function circle(canvas, centerX, centerY, radius, color, strokeColor = null, strokeWidth = 0) {
  centerX *= scale; centerY *= scale; radius *= scale; strokeWidth *= scale;
  const outerRadius = radius + strokeWidth;
  for (let y = Math.floor(centerY - outerRadius); y <= Math.ceil(centerY + outerRadius); y++) {
    for (let x = Math.floor(centerX - outerRadius); x <= Math.ceil(centerX + outerRadius); x++) {
      const distance = Math.hypot(x - centerX, y - centerY);
      if (distance <= outerRadius) {
        blendPixel(canvas, x, y, strokeColor && (distance >= radius) ? strokeColor : color);
      }
    }
  }
}

function circleStroke(canvas, centerX, centerY, radius, width, color) {
  centerX *= scale; centerY *= scale; radius *= scale; width *= scale;
  const innerRadius = radius - (width / 2);
  const outerRadius = radius + (width / 2);
  for (let y = Math.floor(centerY - outerRadius); y <= Math.ceil(centerY + outerRadius); y++) {
    for (let x = Math.floor(centerX - outerRadius); x <= Math.ceil(centerX + outerRadius); x++) {
      const distance = Math.hypot(x - centerX, y - centerY);
      if ((distance >= innerRadius) && (distance <= outerRadius)) {blendPixel(canvas, x, y, color);}
    }
  }
}

function roundedRect(canvas, x, y, width, height, radius, color, strokeColor = null, strokeWidth = 0) {
  x *= scale; y *= scale; width *= scale; height *= scale; radius *= scale; strokeWidth *= scale;
  const centerX = x + (width / 2);
  const centerY = y + (height / 2);
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  for (let py = Math.floor(y - strokeWidth); py <= Math.ceil(y + height + strokeWidth); py++) {
    for (let px = Math.floor(x - strokeWidth); px <= Math.ceil(x + width + strokeWidth); px++) {
      const qx = Math.abs(px - centerX) - (halfWidth - radius);
      const qy = Math.abs(py - centerY) - (halfHeight - radius);
      const distance = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
      if (distance <= 0) {
        blendPixel(canvas, px, py, strokeColor && (distance >= -strokeWidth) ? strokeColor : color);
      }
    }
  }
}

function drawSelectionCorners(canvas) {
  const segments = [
    [9, 20, 9, 10], [9, 10, 19, 10],
    [45, 10, 55, 10], [55, 10, 55, 20],
    [9, 44, 9, 54], [9, 54, 19, 54],
    [45, 54, 55, 54], [55, 54, 55, 44]
  ];
  for (const segment of segments) {line(canvas, ...segment, 3.2, colors.ink);}
}

function drawSingleColor(canvas) {
  drawSelectionCorners(canvas);
  roundedRect(canvas, 21, 21, 22, 22, 4, colors.cyan, colors.ink, 2.2);
  roundedRect(canvas, 27, 27, 10, 10, 2, colors.white);
}

function drawColorGrid(canvas) {
  const palette = [colors.cyan, colors.pink, colors.blue, colors.mint];
  const cells = [[19, 19], [33, 19], [19, 33], [33, 33]];
  cells.forEach(([x, y], index) => roundedRect(canvas, x, y, 12, 12, 2.4, palette[index], colors.ink, 1.6));
}

function drawAllColors(canvas) {
  drawSelectionCorners(canvas);
  drawColorGrid(canvas);
}

function drawClose(canvas) {
  line(canvas, 18, 18, 46, 46, 4, colors.white);
  line(canvas, 46, 18, 18, 46, 4, colors.white);
}

function drawSettings(canvas) {
  for (let index = 0; index < 8; index++) {
    const angle = (Math.PI * index) / 4;
    line(
      canvas,
      32 + (Math.cos(angle) * 19),
      32 + (Math.sin(angle) * 19),
      32 + (Math.cos(angle) * 25),
      32 + (Math.sin(angle) * 25),
      5,
      colors.white
    );
  }
  circleStroke(canvas, 32, 32, 17, 4, colors.white);
  circleStroke(canvas, 32, 32, 7, 3.5, colors.white);
}

function drawFullscreen(canvas) {
  const corners = [
    [[27, 14], [14, 14], [14, 27]],
    [[37, 14], [50, 14], [50, 27]],
    [[50, 37], [50, 50], [37, 50]],
    [[27, 50], [14, 50], [14, 37]]
  ];
  for (const points of corners) {
    for (let index = 1; index < points.length; index++) {line(canvas, ...points[index - 1], ...points[index], 3.8, colors.white);}
  }
}

function drawWindowed(canvas) {
  const corners = [
    [[12, 24], [24, 24], [24, 12]],
    [[40, 12], [40, 24], [52, 24]],
    [[52, 40], [40, 40], [40, 52]],
    [[24, 52], [24, 40], [12, 40]]
  ];
  for (const points of corners) {
    for (let index = 1; index < points.length; index++) {line(canvas, ...points[index - 1], ...points[index], 3.8, colors.white);}
  }
}

function drawHorizontalLayout(canvas) {
  roundedRect(canvas, 8, 14, 48, 14, 4, colors.white);
  roundedRect(canvas, 8, 36, 48, 14, 4, colors.white);
}

function drawVerticalLayout(canvas) {
  roundedRect(canvas, 12, 8, 16, 48, 4, colors.white);
  roundedRect(canvas, 36, 8, 16, 48, 4, colors.white);
}

function drawHighlight(canvas) {
  roundedRect(canvas, 27, 27, 10, 10, 2, colors.white);
  const corners = [
    [[14, 24], [14, 14], [24, 14]],
    [[40, 14], [50, 14], [50, 24]],
    [[50, 40], [50, 50], [40, 50]],
    [[24, 50], [14, 50], [14, 40]]
  ];
  for (const points of corners) {
    for (let index = 1; index < points.length; index++) {line(canvas, ...points[index - 1], ...points[index], 3.4, colors.white);}
  }
}

function drawEye(canvas, hidden = false) {
  const upper = [[9, 32], [16, 24], [24, 20], [32, 19], [40, 20], [48, 24], [55, 32]];
  const lower = [[9, 32], [16, 40], [24, 44], [32, 45], [40, 44], [48, 40], [55, 32]];
  for (const points of [upper, lower]) {
    for (let index = 1; index < points.length; index++) {line(canvas, ...points[index - 1], ...points[index], 3.3, colors.white);}
  }
  circleStroke(canvas, 32, 32, 7, 3.4, colors.white);
  if (hidden) {line(canvas, 13, 13, 51, 51, 4, colors.white);}
}

function drawEyeVisible(canvas) {drawEye(canvas, false);}
function drawEyeHidden(canvas) {drawEye(canvas, true);}

function downsample(source) {
  const output = new Uint8Array(outputSize * outputSize * 4);
  for (let y = 0; y < outputSize; y++) {
    for (let x = 0; x < outputSize; x++) {
      const totals = [0, 0, 0, 0];
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const sourceIndex = ((((y * scale) + sy) * size) + (x * scale) + sx) * 4;
          for (let channel = 0; channel < 4; channel++) {totals[channel] += source[sourceIndex + channel];}
        }
      }
      const outputIndex = ((y * outputSize) + x) * 4;
      for (let channel = 0; channel < 4; channel++) {output[outputIndex + channel] = Math.round(totals[channel] / (scale * scale));}
    }
  }
  return output;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);}
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePNG(pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(outputSize, 0);
  header.writeUInt32BE(outputSize, 4);
  header[8] = 8;
  header[9] = 6;
  const scanlines = Buffer.alloc((outputSize * 4 + 1) * outputSize);
  for (let y = 0; y < outputSize; y++) {
    const targetOffset = y * ((outputSize * 4) + 1);
    scanlines[targetOffset] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + (y * outputSize * 4), outputSize * 4).copy(scanlines, targetOffset + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(scanlines, {level: 9})),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const outputDirectory = path.resolve('src/assets');
fs.mkdirSync(outputDirectory, {recursive: true});
for (const [filename, draw] of [
  ['paint-selected.png', drawSingleColor],
  ['paint-all.png', drawAllColors],
  ['window-close.png', drawClose],
  ['settings.png', drawSettings],
  ['enter-fullscreen.png', drawFullscreen],
  ['exit-fullscreen.png', drawWindowed],
  ['layout-horizontal.png', drawHorizontalLayout],
  ['layout-vertical.png', drawVerticalLayout],
  ['highlight-pixels.png', drawHighlight],
  ['color-visible.png', drawEyeVisible],
  ['color-hidden.png', drawEyeHidden]
]) {
  const canvas = createCanvas();
  draw(canvas);
  fs.writeFileSync(path.join(outputDirectory, filename), encodePNG(downsample(canvas)));
}
