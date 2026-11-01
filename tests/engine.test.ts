import { describe, it, expect } from 'vitest';
import { decimal, evaluatePlan } from '../src/domain/engine';
import {
  invalidateConfirmations,
  newPlan,
  pendingCheck,
  selectAlternative,
} from '../src/domain/model';
import { ruleset } from '../src/domain/rules';
import { complete, oven } from './fixtures';
const run = (p = oven()) => evaluatePlan(p, ruleset);
describe('independent reference calculations', () => {
  // Reference constants transcribed independently from the supplied table 36.
  for (const [method, base] of [
    ['B1', 24],
    ['B2', 23],
    ['C', 27],
  ] as const)
    for (const voltage of ['127', '220'])
      for (const supply of ['LN', 'LL'])
        it(`${method} ${voltage} V ${supply}: 2000 W, 10 m`, () => {
          const p = oven();
          Object.assign(p.equipment, { power: '2000', voltage, supply });
          Object.assign(p.route, { method, length: '10' });
          const e = run(p),
            r = e.alternatives.independent.result!;
          expect(r.section).toBe(2.5);
          expect(r.correctedAmpacity).toBe(base);
          expect(r.breaker).toBe(voltage === '127' ? 16 : 10);
          expect(r.dropV).toBeCloseTo(voltage === '127' ? 3.21259842519685 : 1.85454545454545, 10);
          expect(r.poles).toBe(supply === 'LN' ? 1 : 2);
        });
  it('PRD oven: 3500 W, 220 V, B1, 12 m, 30°C, independent', () => {
    const e = run(),
      r = e.alternatives.independent.result!;
    expect(e.current).toBeCloseTo(15.9090909091);
    expect(r.section).toBe(2.5);
    expect(r.pe).toBe(2.5);
    expect(r.breaker).toBe(16);
    // 16 A satisfies Ib <= In. PRD's 20 A is also feasible but is not the minimum candidate.
    expect(r.dropPercent).toBeCloseTo(1.77024793388, 8);
    expect(e.status).toBe('preliminary');
  });
  it.each([
    [10, 1.22],
    [15, 1.17],
    [20, 1.12],
    [25, 1.06],
    [30, 1],
    [35, 0.94],
    [40, 0.87],
    [45, 0.79],
    [50, 0.71],
    [55, 0.61],
    [60, 0.5],
  ])('temperature %s uses exactly %s', (t, f) => {
    const p = oven();
    p.route.temperature = String(t);
    const r = run(p).alternatives.independent.result!;
    expect(r.temperatureFactor).toBe(f);
    expect(r.correctedAmpacity).toBe(r.ampacity * f);
  });
  it.each([
    [2, 0.8],
    [3, 0.7],
    [4, 0.65],
    [5, 0.6],
    [6, 0.57],
    [7, 0.54],
    [8, 0.52],
  ])('%s total grouped circuits uses %s', (n, f) => {
    const p = oven();
    p.route.sharedCircuits = String(n);
    p.route.sharedGroupConfirmed = true;
    p.selectedAlternative = 'shared';
    expect(run(p).alternatives.shared.result!.groupingFactor).toBe(f);
  });
  it('three circuits force a larger section for 20A load', () => {
    const p = oven();
    p.equipment.power = '4400';
    p.route.sharedCircuits = '3';
    p.route.sharedGroupConfirmed = true;
    const e = run(p);
    expect(e.alternatives.independent.result!.section).toBe(2.5);
    expect(e.alternatives.shared.result!.section).toBe(4);
    expect(e.alternatives.shared.result!.correctedAmpacity).toBe(22.4);
  });
  it('longer route selects for voltage drop, independently of ampacity', () => {
    const p = oven();
    p.route.length = '100';
    const r = run(p).alternatives.independent.result!;
    expect(r.section).toBe(10);
    expect(r.dropPercent).toBeCloseTo(3.52892561983, 8);
    expect(r.governing).toContain('Queda');
  });
  it('uses full precision at the breaker boundary', () => {
    const p = oven();
    p.equipment.power = '3520,000022';
    const r = run(p).alternatives.independent.result!;
    expect(r.breaker).toBe(20);
    p.equipment.power = '3520';
    expect(run(p).alternatives.independent.result!.breaker).toBe(16);
  });
  it('I2 coordination increases conductor size when strict limit applies', () => {
    const p = complete();
    p.equipment.power = '4400';
    p.safety.overloadTimeConfirmed = false;
    expect(run(p).alternatives.independent.result!.section).toBe(4);
    p.safety.overloadTimeConfirmed = true;
    expect(run(p).alternatives.independent.result!.section).toBe(2.5);
  });
  it('PE changes at 16 mm² and multicore includes equal-sized PE', () => {
    const p = oven();
    p.equipment.power = '13200';
    p.route.length = '80';
    const r = run(p).alternatives.independent.result!;
    expect(r.section).toBe(35);
    expect(r.pe).toBe(16);
    p.route.method = 'C';
    expect(run(p).alternatives.independent.result!.pe).toBe(35);
  });
});
describe('scope, states and invalidation', () => {
  it('switching alternatives invalidates safety evidence and retains separate physical surveys', () => {
    const p = complete();
    p.route.feasibility.shared = {
      state: 'passed',
      note: 'Levantamento específico do compartilhado.',
      evidence: 'measured',
    };
    p.route.sharedCircuits = '3';
    p.route.sharedGroupConfirmed = true;
    expect(run(p).alternatives.shared.status).toBe('preliminary');
    const changed = selectAlternative(p, 'shared');
    expect(changed.safety.checks.shortCircuit.state).toBe('pending');
    expect(changed.route.feasibility.shared.note).toContain('compartilhado');
    expect(changed.route.feasibility.independent.state).toBe('passed');
    expect(run(changed).status).toBe('preliminary');
  });
  it('missing data is draft and failures take precedence', () => {
    const p = newPlan(ruleset.version);
    expect(run(p).status).toBe('draft');
    p.safety.checks.supply.state = 'failed';
    expect(run(p).status).toBe('blocked');
  });
  it('complete checks validate individual plan without approving engine', () => {
    const e = run(complete());
    expect(e.status).toBe('validated');
    expect(e.engineReview).toBe('pending');
  });
  it('essential checks cannot be waived or marked passed without evidence', () => {
    const p = complete();
    p.safety.checks.grounding = {
      state: 'not-applicable',
      note: 'I prefer not to check',
      evidence: 'professional',
    };
    expect(run(p).status).toBe('preliminary');
    p.safety.checks.grounding = { state: 'passed', note: '', evidence: 'professional' };
    expect(run(p).status).toBe('preliminary');
    p.safety.checks.grounding = complete().safety.checks.grounding;
    p.safety.checks.rcd = {
      state: 'not-applicable',
      note: 'Aplicabilidade avaliada conforme local e equipamento.',
      evidence: 'professional',
    };
    expect(run(p).status).toBe('validated');
  });
  it('unknown temperature, unsupported method/load, missing grouping yield no sizing', () => {
    for (const key of ['temperature', 'method'] as const) {
      const p = oven();
      p.route[key] = '999';
      expect(run(p).alternatives.independent.result).toBeUndefined();
    }
    const p = oven();
    p.equipment.resistive = false;
    expect(run(p).alternatives.independent.result).toBeUndefined();
    p.equipment.resistive = true;
    p.selectedAlternative = 'shared';
    expect(run(p).status).toBe('draft');
    expect(run(p).alternatives.shared.result).toBeUndefined();
    p.route.sharedCircuits = '9';
    p.route.sharedGroupConfirmed = true;
    expect(run(p).alternatives.shared.result).toBeUndefined();
  });
  it('shared C never gets a fabricated result', () => {
    const p = oven();
    p.route.method = 'C';
    p.selectedAlternative = 'shared';
    expect(run(p).alternatives.shared.available).toBe(false);
    expect(run(p).status).toBe('draft');
  });
  it('insufficient cable, total drop and unsupported demand exhaust candidates', () => {
    const p = oven();
    p.route.length = '100';
    p.route.maxSection = '2.5';
    expect(run(p).status).toBe('blocked');
    expect(run(p).alternatives.independent.materials).toEqual([]);
    p.route.maxSection = '';
    p.safety.upstreamDrop = '6';
    p.safety.totalLimit = '5';
    expect(run(p).status).toBe('blocked');
    p.safety.upstreamDrop = '0';
    p.equipment.power = '20000';
    expect(run(p).status).toBe('blocked');
  });
  it('confirmed nameplate wins; both values require a consistency check', () => {
    const p = complete();
    p.equipment.current = '18,5';
    p.equipment.nameplateConfirmed = true;
    p.safety.checks.nameplate = pendingCheck();
    const e = run(p);
    expect(e.current).toBe(18.5);
    expect(e.status).toBe('preliminary');
    expect(e.openItems.some((i) => i.code === 'check-nameplate')).toBe(true);
  });
  it('input edits clear positive attestations and preserve known failures', () => {
    const p = complete();
    p.safety.checks.shortCircuit.state = 'failed';
    const changed = invalidateConfirmations(p);
    expect(changed.safety.checks.grounding.state).toBe('pending');
    expect(changed.safety.checks.shortCircuit.state).toBe('failed');
    expect(changed.route.feasibility.independent.state).toBe('pending');
  });
  it('alternative feasibility never transfers', () => {
    const p = complete();
    p.route.sharedCircuits = '3';
    p.route.sharedGroupConfirmed = true;
    const e = run(p);
    expect(e.alternatives.independent.status).toBe('validated');
    expect(e.alternatives.shared.status).toBe('preliminary');
    p.route.feasibility.shared.state = 'failed';
    p.selectedAlternative = 'shared';
    expect(run(p).status).toBe('blocked');
  });
  it('materials count multicore cable once, reserve separately', () => {
    const p = oven();
    p.allowance = '10';
    let m = run(p).alternatives.independent.materials;
    expect(m[0].quantity).toBe(24);
    expect(m[0].allowance).toBe(2.4);
    expect(m[1].quantity).toBe(12);
    p.route.method = 'B2';
    m = run(p).alternatives.independent.materials;
    expect(m[0].quantity).toBe(12);
    expect(m[0].allowance).toBe(1.2);
    expect(m[0].specification).toContain('3 ×');
  });
  it('numeric parser rejects ambiguous separators, negatives, Infinity, exponent and zero current', () => {
    expect(decimal(' 12,5 ')).toBe(12.5);
    for (const s of ['1.000,5', '-1', '1e3', 'Infinity', '', '0x10', '1,'])
      expect(decimal(s)).toBeUndefined();
    const p = oven();
    p.equipment.power = '0';
    expect(run(p).status).toBe('draft');
  });
});
