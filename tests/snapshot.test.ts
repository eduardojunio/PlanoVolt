import { expect, it } from 'vitest';
import { snapshotPlan } from '../src/domain/snapshot';
import { evaluatePlan } from '../src/domain/engine';
import { ruleset } from '../src/domain/rules';
import { complete } from './fixtures';
it('isolates and freezes the complete input/evaluation before asynchronous export', () => {
  const plan = complete(),
    evaluation = evaluatePlan(plan, ruleset),
    snapshot = snapshotPlan(plan, evaluation);
  plan.equipment.power = '9900';
  evaluation.alternatives.independent.result!.section = 35;
  expect(snapshot.plan.equipment.power).toBe('3500');
  expect(snapshot.evaluation.alternatives.independent.result!.section).toBe(2.5);
  expect(Object.isFrozen(snapshot.plan.safety.checks)).toBe(true);
  expect(Object.isFrozen(snapshot.evaluation.alternatives.independent.result)).toBe(true);
});
