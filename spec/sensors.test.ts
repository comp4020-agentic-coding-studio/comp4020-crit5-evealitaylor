import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Sensors — standards I hold the agent to whatever the week's brief is.
//
// These are deliberately NOT in crit-5.test.ts. That file answers this week's
// published spec and stays behind when the brief does; this one is harness, and
// comes with me into next week's repo alongside CLAUDE.md. Keeping them apart
// is the difference between a test that retires and a check that accumulates.
//
// Like the invariants, they run against the BUILT site, so they check what
// actually ships rather than what the source intended.
// ---------------------------------------------------------------------------
const DIST = resolve("dist");

function shipped(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? shipped(path) : [path];
  });
}

const textFiles = shipped()
  .filter((path) => /\.(html|css|js)$/.test(path))
  .map((path) => ({
    name: relative(DIST, path).split(sep).join("/"),
    body: readFileSync(path, "utf8"),
  }));

// The classic way to lose marks is to deploy the starter template's copy still
// sitting in the corners of a page nobody re-read. It looks perfectly fine in
// the editor and reads as unfinished the moment a marker opens the URL, so the
// check belongs on the built output, not on my memory.
describe("sensor: no template boilerplate ships", () => {
  const LEFTOVERS = [
    "Replace this with",
    "TEMPLATE:",
    "COMP4020 prototype",
    "your prototype",
    "lorem ipsum",
  ];

  it("built something to scan", () => {
    expect(textFiles.length).toBeGreaterThan(0);
  });

  for (const { name, body } of textFiles) {
    it(`${name} is my own work`, () => {
      const found = LEFTOVERS.filter((phrase) =>
        body.toLowerCase().includes(phrase.toLowerCase()),
      );
      expect(found, `${name} still ships template copy: ${found.join(", ")}`).toEqual([]);
    });
  }
});

// Written after shipping a title that read "SPACEWAL" on a phone: the wordmark
// was sized for the first font in its stack, and every fallback is wider. A
// screenshot at one width would not have caught it either — so the sensor is
// the rule that made it possible, not the symptom.
describe("sensor: no text is sized so it can only fit in one font", () => {
  const css = textFiles.filter(({ name }) => name.endsWith(".css"));

  it("has stylesheets to check", () => {
    expect(css.length).toBeGreaterThan(0);
  });

  for (const { name, body } of css) {
    it(`${name} lets long words wrap or shrink`, () => {
      // A nowrap rule with no viewport-relative size is a clipped word waiting
      // for a narrow screen or an unlucky font fallback.
      const nowrapBlocks = body
        .split("}")
        .filter((block) => /white-space:\s*nowrap/.test(block));
      for (const block of nowrapBlocks) {
        expect(
          /font-size:[^;]*(vw|vmin|clamp|min\()/.test(block),
          `a nowrap rule in ${name} sets no viewport-relative font-size, so a ` +
            `wider fallback font will clip it:\n${block.trim()}`,
        ).toBe(true);
      }
    });
  }
});
