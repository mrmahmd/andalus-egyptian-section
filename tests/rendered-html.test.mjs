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
  assert.match(html, /Mr\.Mohamed Farid/);
  assert.match(html, /<td[^>]*rowspan="3"[^>]*>Sunday<\/td>/i);
  assert.match(html, /<td[^>]*rowspan="2"[^>]*>Monday<\/td>/i);
  assert.match(html, /<td[^>]*rowspan="2"[^>]*>Tuesday<\/td>/i);
  assert.match(html, /<td[^>]*rowspan="2"[^>]*>Wednesday<\/td>/i);
  assert.match(html, /<td[^>]*rowspan="1"[^>]*>Thursday<\/td>/i);
  assert.match(html, /QUIZZES &amp; ASSESSMENTS/);
  assert.match(html, /class="quiz-table"/);
  assert.match(html, /Spelling Quiz/);
  assert.match(html, /Quick Check/);
});

test("renders teacher sign in and account creation entry point", async () => {
  const html = await readFile(
    new URL("teachers/login/index.html", outputRoot),
    "utf8",
  );

  assert.match(html, /Sign In/);
  assert.match(html, /Create New Account/);
  assert.match(html, /Username/);
});

test("configures Grades 1 to 10, classes A and B, and teacher subjects", async () => {
  const source = await readFile(
    new URL("../app/teachers/login/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Array\.from\(\{ length: 10 \}/);
  assert.match(source, /Class A/);
  assert.match(source, /Class B/);
  for (const subject of ["Arabic", "Islamic", "English OL", "English AL", "Math", "Science", "Social", "ICT"]) {
    assert.match(source, new RegExp(subject));
  }
});
