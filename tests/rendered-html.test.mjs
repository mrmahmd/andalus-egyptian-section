import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const outputRoot = new URL("../out/", import.meta.url);

test("renders the parent-facing homepage", async () => {
  const html = await readFile(new URL("index.html", outputRoot), "utf8");

  assert.match(html, /ALANDALUS PRIVATE SCHOOLS/);
  assert.match(html, /One clear plan/);
  assert.match(html, /Find your weekly plan/);
  assert.doesNotMatch(html, /teacher login|create teacher account/i);
});

test("renders one merged day cell for each school day", async () => {
  const html = await readFile(
    new URL("weekly-plan/index.html", outputRoot),
    "utf8",
  );

  const dayCells = html.match(/class="day-cell"/g) ?? [];
  assert.equal(dayCells.length, 5);
  assert.match(html, /<td[^>]*rowspan="3"[^>]*>Sunday<\/td>/i);
  assert.match(html, /<td[^>]*rowspan="2"[^>]*>Monday<\/td>/i);
  assert.match(html, /<td[^>]*rowspan="2"[^>]*>Tuesday<\/td>/i);
  assert.match(html, /<td[^>]*rowspan="2"[^>]*>Wednesday<\/td>/i);
  assert.match(html, /<td[^>]*rowspan="1"[^>]*>Thursday<\/td>/i);
});
