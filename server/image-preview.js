import sharp from 'sharp';

// Inline previews travel with the library, never through a second image request.
export const PREVIEW_VERSION = 1;
export const PREVIEW_LIMIT = 2048;
export async function imagePreview(buffer) {
  const source = sharp(buffer, { limitInputPixels: 4096 * 4096 });
  const { width, height } = await source.metadata();
  const { data, info } = await source.clone().resize(64, 64, { fit: 'inside', withoutEnlargement: true, kernel: 'nearest' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bins = new Map();
  for (let i = 0; i < data.length; i += info.channels) {
    const weight = data[i + 3] / 255;
    if (!weight) continue;
    const key = (data[i] >> 4) * 256 + (data[i + 1] >> 4) * 16 + (data[i + 2] >> 4);
    const bin = bins.get(key) || { weight: 0, r: 0, g: 0, b: 0 };
    bin.weight += weight; bin.r += data[i] * weight; bin.g += data[i + 1] * weight; bin.b += data[i + 2] * weight;
    bins.set(key, bin);
  }
  const dominant = [...bins.values()].sort((a, b) => b.weight - a.weight)[0];
  const color = dominant ? '#' + ['r', 'g', 'b'].map(c => Math.round(dominant[c] / dominant.weight).toString(16).padStart(2, '0')).join('') : null;
  let lqip = null;
  for (const size of [32, 24, 16]) {
    const small = await source.clone().resize(size, size, { fit: 'inside', withoutEnlargement: true }).blur(1).webp({ quality: 30, effort: 3 }).toBuffer();
    const encoded = 'data:image/webp;base64,' + small.toString('base64');
    if (Buffer.byteLength(encoded) <= PREVIEW_LIMIT) { lqip = encoded; break; }
  }
  return { color, lqip, width, height, version: PREVIEW_VERSION };
}

// Both supplied library URLs and public site records are traversed, never arbitrary request input.
export function imageNames(value, found = new Set()) {
  if (typeof value === 'string' && /^\/uploads\/[a-f0-9-]{36}\.(png|webp)$/.test(value)) found.add(value.slice(9));
  else if (Array.isArray(value)) value.forEach(item => imageNames(item, found));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => imageNames(item, found));
  return found;
}
