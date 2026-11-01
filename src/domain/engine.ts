import { z } from 'zod';
import {
  ENGINE_VERSION,
  checkLabels,
  type Plan,
  type Alternative,
  type Check,
  type CheckKey,
  type PlanStatus,
} from './model';
import type { Ruleset } from './rules';

export type Issue = {
  code: string;
  message: string;
  severity: 'error' | 'blocker' | 'open';
  field?: string;
};
export type Candidate = {
  section: number;
  ampacity: number;
  correctedAmpacity: number;
  dropV: number;
  dropPercent: number;
  breaker?: number;
  failures: string[];
};
export type Material = {
  item: string;
  quantity: number | null;
  unit: string;
  allowance: number | null;
  specification: string;
};
export type AlternativeEvaluation = {
  id: Alternative;
  available: boolean;
  status: PlanStatus;
  issues: Issue[];
  candidates: Candidate[];
  result?: Candidate & {
    pe: number;
    poles: number;
    temperatureFactor: number;
    groupingFactor: number;
    totalDrop?: number;
    governing: string;
  };
  materials: Material[];
};
export type PlanEvaluation = {
  engineVersion: string;
  rulesetVersion: string;
  rulesetSource: string;
  engineReview: Ruleset['review'];
  status: PlanStatus;
  current?: number;
  currentSource?: string;
  inputErrors: Issue[];
  blockers: Issue[];
  openItems: Issue[];
  issues: Issue[];
  alternatives: Record<Alternative, AlternativeEvaluation>;
  selected: Alternative;
  criteria: string[];
  assumptions: string[];
};

export function decimal(value: string): number | undefined {
  const s = value.trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(s)) return undefined;
  const parsed = z
    .number()
    .finite()
    .nonnegative()
    .safeParse(Number(s.replace(',', '.')));
  return parsed.success ? parsed.data : undefined;
}
const positive = (s: string) => {
  const n = decimal(s);
  return n !== undefined && n > 0 ? n : undefined;
};
export function designCurrent(p: Plan): { value?: number; source?: string } {
  const c = positive(p.equipment.current),
    w = positive(p.equipment.power),
    v = positive(p.equipment.voltage);
  if (c && p.equipment.nameplateConfirmed)
    return { value: c, source: 'Corrente de placa confirmada' };
  if (w && v && p.equipment.resistive && ['127', '220'].includes(p.equipment.voltage))
    return { value: w / v, source: 'Calculada: P / V (carga resistiva, FP = 1)' };
  return {};
}
export function checkSatisfied(c: Check, allowNA = false): boolean {
  return (
    (c.state === 'passed' && c.note.trim().length > 0) ||
    (allowNA && c.state === 'not-applicable' && c.note.trim().length > 0)
  );
}
function deriveStatus(issues: Issue[], hasResult: boolean): PlanStatus {
  if (issues.some((i) => i.severity === 'blocker')) return 'blocked';
  if (!hasResult || issues.some((i) => i.severity === 'error')) return 'draft';
  return issues.length ? 'preliminary' : 'validated';
}
export function evaluatePlan(p: Plan, r: Ruleset): PlanEvaluation {
  const common: Issue[] = [];
  const add = (
    code: string,
    message: string,
    severity: Issue['severity'] = 'error',
    field?: string,
  ) => common.push({ code, message, severity, field });
  const { value: current, source: currentSource } = designCurrent(p);
  const length = positive(p.route.length),
    power = positive(p.equipment.power),
    statedCurrent = positive(p.equipment.current);
  const voltage = positive(p.equipment.voltage),
    temperatureFactor = r.temperature[p.route.temperature];
  const allowance = decimal(p.allowance),
    maxSection = p.route.maxSection ? positive(p.route.maxSection) : undefined;
  const i2 = p.safety.i2Ratio ? positive(p.safety.i2Ratio) : undefined;
  const upstream = p.safety.upstreamDrop ? decimal(p.safety.upstreamDrop) : undefined;
  const totalLimit = ['5', '7'].includes(p.safety.totalLimit)
    ? Number(p.safety.totalLimit)
    : undefined;
  if (!['oven', 'shower', 'heater', 'other'].includes(p.equipment.kind) || !p.equipment.resistive)
    add('load', 'Confirme uma carga puramente resistiva suportada (FP = 1).');
  if (!['127', '220'].includes(p.equipment.voltage))
    add('voltage', 'Informe tensão suportada: 127 V ou 220 V.', 'error', 'equipment.voltage');
  if (!['LN', 'LL'].includes(p.equipment.supply))
    add(
      'supply-type',
      'Informe alimentação fase-neutro ou fase-fase.',
      'error',
      'equipment.supply',
    );
  if (!current)
    add(
      'current',
      'Informe potência válida ou corrente de placa confirmada.',
      'error',
      'equipment.power',
    );
  if (p.equipment.power && !power)
    add('power-invalid', 'Potência deve ser maior que zero.', 'error', 'equipment.power');
  if (p.equipment.current && !statedCurrent)
    add('current-invalid', 'Corrente deve ser maior que zero.', 'error', 'equipment.current');
  if (p.equipment.current && !p.equipment.nameplateConfirmed)
    add('nameplate-unconfirmed', 'Confirme a origem da corrente informada.', 'open');
  if (!length) add('length', 'Informe comprimento de ida maior que zero.', 'error', 'route.length');
  if (!r.ampacity[p.route.method])
    add('method', 'Método fora da cobertura: escolha B1, B2 ou C.', 'error', 'route.method');
  if (!p.route.arrangementConfirmed)
    add(
      'arrangement',
      'Confirme a instalação exata: sem isolamento térmico, sol, infravermelho ou conduto ferromagnético.',
    );
  if (!temperatureFactor)
    add(
      'temperature',
      'Informe temperatura tabelada entre 10 e 60 °C, sem interpolação.',
      'error',
      'route.temperature',
    );
  if (allowance === undefined || allowance > 100)
    add('allowance', 'Reserva deve estar entre 0 e 100%.', 'error', 'allowance');
  if (p.route.maxSection && (!maxSection || !r.sections.includes(maxSection)))
    add('max-section', 'Seção máxima disponível fora do catálogo suportado.');
  if (p.safety.i2Ratio && (!i2 || i2 < 1))
    add('i2-invalid', 'Relação I2/In deve ser um número maior ou igual a 1.');
  if (p.safety.mainBreaker && !positive(p.safety.mainBreaker))
    add('main-breaker', 'Corrente do disjuntor geral deve ser positiva.');
  if (p.safety.upstreamDrop && upstream === undefined)
    add(
      'upstream-invalid',
      'Queda a montante deve ser um percentual não negativo.',
      'error',
      'safety.upstreamDrop',
    );
  if (!p.equipment.connection)
    add('connection', 'Defina o tipo de conexão e verifique os componentes.', 'open');
  for (const key of Object.keys(checkLabels) as CheckKey[]) {
    if (key === 'nameplate' && !(power && statedCurrent)) continue;
    const c = p.safety.checks[key];
    if (c.state === 'failed')
      add(
        `check-${key}`,
        `${checkLabels[key]}: incompatibilidade registrada. ${c.note}`,
        'blocker',
      );
    else if (!checkSatisfied(c, key === 'rcd'))
      add(`check-${key}`, `${checkLabels[key]}: verificar e registrar evidência.`, 'open');
  }
  if (!i2)
    add('i2-missing', 'Coordenação I2 pendente: informe a relação I2/In do fabricante.', 'open');
  if (upstream === undefined || !totalLimit)
    add(
      'total-drop-missing',
      'Verifique a queda total: informe queda a montante e limite aplicável à origem (5% ou 7%).',
      'open',
    );
  const alternatives = {} as Record<Alternative, AlternativeEvaluation>;
  for (const id of ['independent', 'shared'] as const) {
    const issues = [...common];
    const available = !(p.route.method === 'C' && id === 'shared');
    const extra = (code: string, message: string, severity: Issue['severity'] = 'error') =>
      issues.push({ code, message, severity });
    if (id !== p.selectedAlternative)
      extra(
        'alternative-review',
        'Revalide as verificações técnicas ao selecionar esta alternativa; elas dependem do circuito e da proteção resultantes.',
        'open',
      );
    let groupingFactor: number | undefined = 1;
    if (!available)
      extra(
        'shared-unsupported',
        'Método C não usa eletroduto; a alternativa compartilhada não é suportada.',
      );
    if (id === 'shared') {
      const circuits = positive(p.route.sharedCircuits);
      groupingFactor =
        circuits && Number.isInteger(circuits) && circuits >= 2 && circuits <= 8
          ? r.grouping[circuits - 1]
          : undefined;
      if (!groupingFactor || !p.route.sharedGroupConfirmed)
        extra(
          'grouping',
          'Informe 2 a 8 circuitos totais e confirme agrupamento homogêneo, uniformemente carregado, mesma temperatura de isolação.',
        );
    }
    const feasible = p.route.feasibility[id];
    if (feasible.state === 'failed')
      extra('route-failed', `Trajeto / ocupação: incompatibilidade. ${feasible.note}`, 'blocker');
    else if (!checkSatisfied(feasible))
      extra(
        'route-pending',
        'Verifique trajeto, ocupação, passagem e proteção mecânica desta alternativa.',
        'open',
      );
    const candidates: Candidate[] = [];
    let result: AlternativeEvaluation['result'];
    if (
      available &&
      !issues.some((i) => i.severity === 'error') &&
      current &&
      length &&
      voltage &&
      groupingFactor &&
      temperatureFactor
    ) {
      for (const [index, section] of r.sections.entries()) {
        const ampacity = r.ampacity[p.route.method][index],
          correctedAmpacity = ampacity * temperatureFactor * groupingFactor;
        const dropV = ((2 * length) / 1000) * current * r.resistance[index],
          dropPercent = (dropV / voltage) * 100;
        const failures: string[] = [];
        const breaker = r.breakers.find(
          (b) =>
            b >= current &&
            b <= correctedAmpacity &&
            (!i2 || i2 * b <= (p.safety.overloadTimeConfirmed ? 1.45 : 1) * correctedAmpacity),
        );
        if (section < 2.5) failures.push('Seção mínima');
        if (maxSection && section > maxSection)
          failures.push('Seção acima da disponibilidade informada');
        if (!breaker) failures.push('Coordenação Ib ≤ In ≤ Iz / I2');
        if (dropPercent > r.segmentLimit) failures.push('Queda do circuito > 4%');
        if (upstream !== undefined && totalLimit && upstream + dropPercent > totalLimit)
          failures.push('Queda total acima do limite da origem');
        const candidate = {
          section,
          ampacity,
          correctedAmpacity,
          dropV,
          dropPercent,
          breaker,
          failures,
        };
        candidates.push(candidate);
        if (!failures.length) {
          const minimumPE = section <= 16 ? section : 16;
          result = {
            ...candidate,
            pe: p.route.method === 'B1' ? minimumPE : section,
            poles: p.equipment.supply === 'LL' ? 2 : 1,
            temperatureFactor,
            groupingFactor,
            totalDrop: upstream === undefined ? undefined : upstream + dropPercent,
            governing:
              candidates.length === 1
                ? 'Seção mínima e coordenação da proteção'
                : [...new Set(candidates.slice(0, -1).flatMap((c) => c.failures))].join('; '),
          };
          break;
        }
      }
      if (!result)
        extra(
          'no-candidate',
          'Nenhuma combinação no catálogo (até 35 mm² / 63 A) atende aos critérios. Requer projeto específico.',
          'blocker',
        );
    }
    const materials: Material[] = [];
    if (result && length && allowance !== undefined && allowance <= 100) {
      const addMaterial = (
        item: string,
        quantity: number | null,
        unit: string,
        specification: string,
      ) =>
        materials.push({
          item,
          quantity,
          unit,
          allowance: quantity === null ? null : (quantity * allowance) / 100,
          specification,
        });
      if (p.route.method === 'B1') {
        addMaterial(
          p.equipment.supply === 'LN' ? 'Fase + neutro (2 condutores)' : 'Fases (2 condutores)',
          2 * length,
          'm',
          `Cu / PVC 70 °C · ${result.section} mm²`,
        );
        addMaterial(
          'Condutor de proteção PE',
          length,
          'm',
          `Cu / PVC 70 °C · ${result.pe} mm² · no mesmo eletroduto`,
        );
      } else
        addMaterial(
          'Cabo multipolar (2 veias ativas + PE)',
          length,
          'm',
          `Cu / PVC 70 °C · 3 × ${result.section} mm²`,
        );
      if (p.route.method !== 'C')
        addMaterial(
          id === 'shared' ? 'Eletroduto existente / adequações' : 'Eletroduto independente',
          id === 'shared' ? null : length,
          'm',
          'Diâmetro e acessórios: A definir',
        );
      materials.push({
        item: 'Disjuntor candidato',
        quantity: 1,
        unit: 'un',
        allowance: 0,
        specification: `${result.breaker} A · ${result.poles} polo(s); curva e capacidade de interrupção: A definir`,
      });
      for (const item of [
        'DR e coordenação',
        'Conexão / tomada / terminais',
        'Acessórios e fixação',
      ])
        materials.push({
          item,
          quantity: null,
          unit: 'un',
          allowance: null,
          specification: 'A definir',
        });
    }
    alternatives[id] = {
      id,
      available,
      status: deriveStatus(issues, !!result),
      issues,
      candidates,
      result,
      materials,
    };
  }
  const selected = alternatives[p.selectedAlternative];
  return {
    engineVersion: ENGINE_VERSION,
    rulesetVersion: r.version,
    rulesetSource: r.source,
    engineReview: r.review,
    status: selected.status,
    current,
    currentSource,
    selected: p.selectedAlternative,
    alternatives,
    issues: selected.issues,
    inputErrors: selected.issues.filter((i) => i.severity === 'error'),
    blockers: selected.issues.filter((i) => i.severity === 'blocker'),
    openItems: selected.issues.filter((i) => i.severity === 'open'),
    criteria: [
      'Tabela 36: cobre / PVC 70 °C / 2 condutores carregados',
      'Tabela 40: fator de temperatura; tabela 42, linha 1: agrupamento',
      'Tabela 47: mínimo 2,5 mm²; tabela 58: PE',
      '5.3.4.1: Ib ≤ In ≤ Iz; I2 ≤ ' +
        (p.safety.overloadTimeConfirmed ? '1,45 Iz' : 'Iz (condição conservadora)'),
      '6.2.7: circuito ≤ 4%; total verificado separadamente',
    ],
    assumptions: [
      'Carga resistiva, FP = 1; 127/220 V; frequência 60 Hz; regime contínuo.',
      'ΔU = 2 × L(km) × Ib × Rca (envelope); resistência do envelope Prysmian rev.10, tabelas 29/31. Compatibilidade do cabo real requer verificação.',
      'Sem conduto ferromagnético, radiação solar/IR, parede termicamente isolante ou condutores em paralelo.',
      'Alternativa independente: percurso sem agrupamento térmico com outros circuitos. Ter eletroduto próprio não comprova essa condição.',
      'Capacidade da alimentação não é inferida do disjuntor geral. Curva, DR e capacidade de interrupção permanecem A definir.',
    ],
  };
}
