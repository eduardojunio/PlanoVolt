import type { Plan } from './model';
import type { PlanEvaluation } from './engine';
export type ExportSnapshot = Readonly<{
  plan: Plan;
  evaluation: PlanEvaluation;
  exportedAt: string;
}>;
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
export const snapshotPlan = (plan: Plan, evaluation: PlanEvaluation): ExportSnapshot =>
  freeze(structuredClone({ plan, evaluation, exportedAt: new Date().toISOString() }));
