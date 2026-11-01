import { newPlan, type Plan } from '../src/domain/model';
import { ruleset } from '../src/domain/rules';
export function oven(): Plan {
  const p = newPlan(ruleset.version);
  p.name = 'Forno da cozinha';
  p.equipment = {
    kind: 'oven',
    power: '3500',
    current: '',
    nameplateConfirmed: false,
    voltage: '220',
    supply: 'LL',
    resistive: true,
    connection: 'Tomada',
  };
  Object.assign(p.route, {
    length: '12',
    method: 'B1',
    temperature: '30',
    arrangementConfirmed: true,
  });
  return p;
}
export function complete(): Plan {
  const p = oven();
  p.safety.upstreamDrop = '1';
  p.safety.totalLimit = '5';
  p.safety.i2Ratio = '1,45';
  p.safety.overloadTimeConfirmed = true;
  for (const c of Object.values(p.safety.checks)) {
    c.state = 'passed';
    c.note = 'Verificação independente documentada por profissional.';
  }
  p.route.feasibility.independent = {
    state: 'passed',
    note: 'Trajeto e ocupação verificados.',
    evidence: 'measured',
  };
  return p;
}
