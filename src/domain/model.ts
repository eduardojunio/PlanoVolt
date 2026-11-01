export const ENGINE_VERSION = '0.1.0';
export type Alternative = 'independent' | 'shared';
export type CheckState = 'pending' | 'passed' | 'failed' | 'not-applicable';
export type Check = {
  state: CheckState;
  note: string;
  evidence: 'professional' | 'measured' | 'calculated';
};
export const checkLabels = {
  panelSpace: 'Espaço e condições do quadro',
  grounding: 'PE, aterramento e equipotencialização',
  rcd: 'Aplicabilidade, especificação e coordenação do DR',
  supply: 'Capacidade da alimentação e demanda',
  shortCircuit: 'Curto-circuito, capacidade de interrupção e seccionamento',
  manual: 'Manual, conexão e corrente admissível dos terminais',
  protection: 'Curva, polos e coordenação das proteções',
  totalDrop: 'Origem e limite da queda total de tensão',
  cableModel: 'Cabo real compatível com o modelo de resistência',
  nameplate: 'Consistência entre potência e corrente da placa',
  overload: 'Dados I2/In do fabricante e condições de sobrecarga',
} as const;
export type CheckKey = keyof typeof checkLabels;
export type PlanStatus = 'draft' | 'preliminary' | 'blocked' | 'validated';
export const statusLabels: Record<PlanStatus, string> = {
  draft: 'Rascunho',
  preliminary: 'Dimensionamento preliminar',
  blocked: 'Plano bloqueado',
  validated: 'Validado para preparação da execução',
};
export type Plan = {
  id: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: 2;
  rulesetVersion: string;
  engineVersion: string;
  name: string;
  equipment: {
    kind: string;
    power: string;
    current: string;
    nameplateConfirmed: boolean;
    voltage: string;
    supply: string;
    resistive: boolean;
    connection: string;
  };
  route: {
    length: string;
    method: string;
    temperature: string;
    arrangementConfirmed: boolean;
    maxSection: string;
    sharedCircuits: string;
    sharedGroupConfirmed: boolean;
    feasibility: Record<Alternative, Check>;
  };
  safety: {
    mainBreaker: string;
    upstreamDrop: string;
    totalLimit: string;
    i2Ratio: string;
    overloadTimeConfirmed: boolean;
    checks: Record<CheckKey, Check>;
  };
  selectedAlternative: Alternative;
  allowance: string;
};
export const pendingCheck = (): Check => ({ state: 'pending', note: '', evidence: 'professional' });
export function newPlan(rulesetVersion: string): Plan {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    schemaVersion: 2,
    rulesetVersion,
    engineVersion: ENGINE_VERSION,
    name: '',
    equipment: {
      kind: 'oven',
      power: '',
      current: '',
      nameplateConfirmed: false,
      voltage: '',
      supply: '',
      resistive: false,
      connection: '',
    },
    route: {
      length: '',
      method: '',
      temperature: '',
      arrangementConfirmed: false,
      maxSection: '',
      sharedCircuits: '',
      sharedGroupConfirmed: false,
      feasibility: { independent: pendingCheck(), shared: pendingCheck() },
    },
    safety: {
      mainBreaker: '',
      upstreamDrop: '',
      totalLimit: '',
      i2Ratio: '',
      overloadTimeConfirmed: false,
      checks: Object.fromEntries(
        Object.keys(checkLabels).map((k) => [k, pendingCheck()]),
      ) as Record<CheckKey, Check>,
    },
    selectedAlternative: 'independent',
    allowance: '0',
  };
}
// Preserve failures: changing an input cannot erase a known incompatibility.
const invalidate = (c: Check): Check => (c.state === 'failed' ? c : pendingCheck());
export function invalidateConfirmations(plan: Plan): Plan {
  return {
    ...plan,
    safety: {
      ...plan.safety,
      checks: Object.fromEntries(
        Object.entries(plan.safety.checks).map(([k, c]) => [k, invalidate(c)]),
      ) as Record<CheckKey, Check>,
    },
    route: {
      ...plan.route,
      feasibility: {
        independent: invalidate(plan.route.feasibility.independent),
        shared: invalidate(plan.route.feasibility.shared),
      },
    },
  };
}

export function selectAlternative(plan: Plan, alternative: Alternative): Plan {
  if (plan.selectedAlternative === alternative) return plan;
  return {
    ...plan,
    selectedAlternative: alternative,
    safety: invalidateConfirmations(plan).safety,
    // Each route retains only its own physical survey. Protection checks must be redone
    // against the newly selected conductor/device combination.
  };
}
