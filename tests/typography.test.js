import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Every stylesheet, page and script of the reader, the about page and the studio. Comments are dropped, so a rule
// quoted in a comment does not count.
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
  );
const files = ["client", "admin", "shared"].flatMap(walk);
const read = (file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const sheets = files.filter((file) => file.endsWith(".css"));
// A declaration's value up to its end, and in a script also up to the end of the string that holds it;
// `(?<![\w-])` keeps custom properties such as --font-size out.
const values = (source, property, file = ".css") => {
  const end = file.endsWith(".css") ? "" : "\"'`";
  return [...source.matchAll(new RegExp(`(?<![\\w-])${property}\\s*:\\s*([^;{}${end}]+)`, "g"))].map((m) => m[1].trim());
};

test("the typeface is Freesentation from one pinned commit, and body text is 14px", () => {
  const typography = read("shared/typography.css");
  const faces = typography.match(/@font-face\s*\{[^}]*\}/g);
  assert.equal(faces.length, 4);
  for (const face of faces) {
    assert.match(face, /font-family: "Freesentation";/);
    assert.match(face, /src: url\("https:\/\/cdn\.jsdelivr\.net\/gh\/Freesentation\/freesentation@[0-9a-f]{40}\/woff2\/Freesentation-\d\w+\.woff2"\) format\("woff2"\);/);
  }
  assert.match(typography, /:root \{ font-family: "Freesentation", /);
  assert.match(typography, /body \{ font-size: 14px; \}/);
  // The reader and the studio load it through shared/style.css; the about page through its own stylesheet.
  assert.match(read("shared/style.css"), /^@import "\.\/typography\.css";/);
  assert.match(read("client/about/style.css"), /^@import "\.\.\/\.\.\/shared\/typography\.css";/);
});

test("no stylesheet or script sets text under 13px", () => {
  const small = [];
  for (const file of files.filter((f) => /\.(css|js|html)$/.test(f))) {
    const source = read(file);
    // font-size: 0 hides the words of icon-only buttons and is allowed; every px size in a value, clamp() and
    // max() included, must be 13 or more.
    for (const value of [...values(source, "font-size", file), ...values(source, "font", file)])
      for (const [, size] of value.matchAll(/(\d*\.?\d+)px/g)) if (Number(size) < 13) small.push(`${file}: ${value}`);
  }
  assert.deepEqual(small, []);
});

test("no stylesheet or page brings in another typeface", () => {
  const other = [];
  for (const file of sheets) {
    const source = read(file);
    for (const value of values(source, "font-family")) if (!/^(inherit|"Freesentation"(,|$))/.test(value)) other.push(`${file}: ${value}`);
    for (const value of values(source, "font")) if (value !== "inherit") other.push(`${file}: font: ${value}`);
    for (const url of source.match(/@import[^;]*;/g) || []) if (!/^@import "[./]+[\w/]*typography\.css";$/.test(url)) other.push(`${file}: ${url}`);
  }
  for (const file of files.filter((f) => f.endsWith(".html")))
    if (/fonts\.(googleapis|gstatic)\.com|pretendard/i.test(read(file))) other.push(file);
  assert.deepEqual(other, []);
});
