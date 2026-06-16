import { ActivityRegistry } from '../electron/activity';

let failed = 0;
function check(cond: boolean, msg: string): void {
  if (cond) {
    console.log('PASS  ' + msg);
  } else {
    console.log('FAIL  ' + msg);
    failed++;
  }
}

const reg = new ActivityRegistry();
let changes = 0;
reg.onChange = () => {
  changes++;
};

const a = reg.start({ kind: 'task', title: 'A', projectPath: '/p', write: true });
const b = reg.start({ kind: 'task', title: 'B', projectPath: '/p', write: true });
check(reg.list().length === 2, 'two activities registered');
check(reg.conflictsFor(a.id).length === 1, 'two writers in same project conflict');

const c = reg.start({ kind: 'insights', title: 'C', projectPath: '/p', write: false });
check(reg.conflictsFor(c.id).length === 0, 'read-only activity does not conflict');

reg.finish(b.id);
check(reg.conflictsFor(a.id).length === 0, 'conflict clears after the other writer finishes');
check(reg.list().length === 2, 'finished activity removed from the list');

const d = reg.start({ kind: 'task', title: 'D', projectPath: '/other', write: true });
check(reg.conflictsFor(a.id).length === 0, 'writers in different projects do not conflict');
check(reg.conflictsFor(d.id).length === 0, 'new writer in other project is conflict-free');

const e = reg.start({ kind: 'task', title: 'E', projectPath: '/s', write: true, scope: ['src/a.ts'] });
reg.start({ kind: 'task', title: 'F', projectPath: '/s', write: true, scope: ['src/b.ts'] });
check(reg.conflictsFor(e.id).length === 0, 'disjoint scopes in same project do not conflict');
const g = reg.start({ kind: 'task', title: 'G', projectPath: '/s', write: true, scope: ['src/a.ts'] });
check(reg.conflictsFor(e.id).some((x) => x.id === g.id), 'overlapping scopes conflict');

check(changes >= 8, 'onChange fired on each mutation');

console.log(failed === 0 ? '\nUNIT: ALL PASSED' : `\nUNIT: ${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);
