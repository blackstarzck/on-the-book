import { mkdir, writeFile } from 'node:fs/promises';
import { readDraft, readLive, siteAssetNames, readImagePreviews, readUpload, saveImagePreview } from '../server/storage.js';
import { imageNames, imagePreview, PREVIEW_VERSION } from '../server/image-preview.js';

const output = 'output/image-placeholders';
await mkdir(output, { recursive: true });
const [draft, live, siteNames] = await Promise.all([readDraft(), readLive(), siteAssetNames()]);
const backup = async (file, data) => { try { await writeFile(file, JSON.stringify(data, null, 2), { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; } };
await backup(output + '/library-before.json', { draft, live });
const names = [...new Set([...imageNames(draft.library), ...imageNames(live.live), ...[...siteNames].filter(name => /\.(png|webp)$/.test(name))])];
const before = await readImagePreviews(names);
await backup(output + '/previews-before.json', before);
const report = { total: names.length, generated: [], skipped: [], failed: [] };
for (const name of names) {
  if (before['/uploads/' + name]?.version === PREVIEW_VERSION) { report.skipped.push(name); continue; }
  try {
    const preview = await imagePreview(await readUpload(name));
    await saveImagePreview(name, preview);
    report.generated.push({ name, color: preview.color, bytes: Buffer.byteLength(preview.lqip || '') });
  } catch (error) { report.failed.push({ name, error: error.message }); }
}
await writeFile(output + '/backfill-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ total: report.total, generated: report.generated.length, skipped: report.skipped.length, failed: report.failed.length }));
if (report.failed.length) process.exitCode = 1;
