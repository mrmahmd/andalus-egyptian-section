import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../lib/grade-eight-timetable.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { gradeEightHistoricalCounterpart: historical, currentGradeEightSubject: current } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const data = JSON.parse(await readFile(new URL('../app/data/class-timetables.json', import.meta.url), 'utf8'));
const days = ['sunday','monday','tuesday','wednesday','thursday'];
for (const section of ['A','B']) {
  test(`8${section}: Week 7 religion is in precisely the requested positions; old timetable stays intact`, () => {
    const slots = days.flatMap((day, dayIndex) => data.classes[`Grade 8${section}`].schedule[day].periods.map(p => ({ day: dayIndex, period: p.period, original: p.subject, subject: current(8,section,dayIndex,p.period,p.subject) })));
    assert.deepEqual(slots.filter(s => s.subject === 'دين').map(s => [s.day,s.period]), section === 'A' ? [[0,7],[2,8]] : [[2,7],[4,6]]);
    for (const slot of slots) {
      for (const week of [1,4,5,6]) {
        const position = historical(8,section,week,slot.day,slot.period);
        const restored = position ? slots.find(s => s.day === position[0] && s.period === position[1]).subject : slot.subject;
        assert.equal(restored,slot.original);
      }
      for (const week of [7,8,17,25]) assert.equal(historical(8,section,week,slot.day,slot.period),null);
    }
    assert.equal(slots.filter(s => s.original !== s.subject).length,2);
  });
}
test('Other grades and sections are unaffected', () => {
  for (const grade of [1,5,7,9,10]) assert.equal(current(grade,'A',2,8,'Arabic'),'Arabic');
  assert.equal(historical(5,'B',4,3,3),null);
  assert.equal(current(8,'C',4,6,'Arabic'),'Arabic');
});
