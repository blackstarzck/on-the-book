import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { imagePreview } from '../server/image-preview.js';

// Embed static about-page placeholders before Vite rewrites the original image URLs.
export function staticImagePreviews() {
  return {
    name: 'static-image-previews',
    transformIndexHtml: {
      order: 'pre',
      async handler(html, context) {
        if (!context.filename.replaceAll('\\', '/').endsWith('/client/about/index.html')) return html;
        const tags = [...html.matchAll(/<img\b[^>]*>/g)];
        const cache = new Map();
        for (const [tag] of tags) {
          if (/footer-drawing|aria-hidden="true"/.test(tag)) continue;
          const src = tag.match(/\bsrc="([^"]+)"/)?.[1];
          if (!src?.startsWith('./assets/') || !/\.(png|webp|jpe?g)$/.test(src)) continue;
          if (!cache.has(src)) cache.set(src, await imagePreview(await readFile(path.resolve(path.dirname(context.filename), src))));
          const encoded = JSON.stringify(cache.get(src)).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
          const preview = cache.get(src);
          const size = /journey-poster|gallery-large/.test(tag) ? 'contain' : 'cover';
          const background = `background-image:url('${preview.lqip}');background-color:${preview.color || 'transparent'};background-size:${size};background-position:center;background-repeat:no-repeat;`;
          const withStyle = /\bstyle="/.test(tag) ? tag.replace(/\bstyle="/, `style="${background}`) : tag.replace('<img', `<img style="${background}"`);
          html = html.replace(tag, withStyle.replace('<img', `<img data-image-preview="${encoded}"`));
        }
        return html;
      },
    },
  };
}
