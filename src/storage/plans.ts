import Dexie, { type Table } from 'dexie';
import { z } from 'zod';
import {
  ENGINE_VERSION,
  invalidateConfirmations,
  pendingCheck,
  checkLabels,
  type Plan,
} from '../domain/model';
import { ruleset } from '../domain/rules';

const check = z.object({
  state: z.enum(['pending', 'passed', 'failed', 'not-applicable']),
  note: z.string(),
  evidence: z.enum(['professional', 'measured', 'calculated']),
});
const text = z.string();
export const recordSchema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  schemaVersion: z.literal(2),
  rulesetVersion: text,
  engineVersion: text,
  name: text,
  equipment: z.object({
    kind: text,
    power: text,
    current: text,
    nameplateConfirmed: z.boolean(),
    voltage: text,
    supply: text,
    resistive: z.boolean(),
    connection: text,
  }),
  route: z.object({
    length: text,
    method: text,
    temperature: text,
    arrangementConfirmed: z.boolean(),
    maxSection: text,
    sharedCircuits: text,
    sharedGroupConfirmed: z.boolean(),
    feasibility: z.object({ independent: check, shared: check }),
  }),
  safety: z.object({
    mainBreaker: text,
    upstreamDrop: text,
    totalLimit: text,
    i2Ratio: text,
    overloadTimeConfirmed: z.boolean(),
    checks: z.object(
      Object.fromEntries(Object.keys(checkLabels).map((k) => [k, check])) as Record<
        keyof typeof checkLabels,
        typeof check
      >,
    ),
  }),
  selectedAlternative: z.enum(['independent', 'shared']),
  allowance: text,
});
export function migrateRecord(raw: unknown): Plan {
  if (typeof raw !== 'object' || raw === null) throw new Error('Registro inválido.');
  const record = structuredClone(raw) as Record<string, unknown>;
  if (record.schemaVersion === 1) {
    record.schemaVersion = 2;
    record.engineVersion = '';
    const safety = record.safety as Plan['safety'];
    safety.checks = {
      ...Object.fromEntries(Object.keys(checkLabels).map((k) => [k, pendingCheck()])),
      ...safety.checks,
    } as Plan['safety']['checks'];
  }
  return recordSchema.parse(record) as Plan;
}
export function refreshVersions(p: Plan): Plan {
  if (p.rulesetVersion === ruleset.version && p.engineVersion === ENGINE_VERSION) return p;
  return {
    ...invalidateConfirmations(p),
    rulesetVersion: ruleset.version,
    engineVersion: ENGINE_VERSION,
  };
}
export class PlanDatabase extends Dexie {
  plans!: Table<Plan, string>;
  constructor(name = 'planovolt') {
    super(name);
    this.version(1).stores({ plans: 'id, updatedAt' });
    this.version(2)
      .stores({ plans: 'id, updatedAt' })
      .upgrade((tx) =>
        tx
          .table('plans')
          .toCollection()
          .modify((record) => {
            Object.assign(record, migrateRecord(record));
          }),
      );
  }
}
export const db = new PlanDatabase();
// Serialize writes and deletion so a pending autosave cannot resurrect a deleted plan.
export class PlanRepository {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private database: PlanDatabase) {}
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tail.then(fn, fn);
    this.tail = next.catch(() => {});
    return next;
  }
  save(plan: Plan) {
    const snapshot = recordSchema.parse(structuredClone(plan)) as Plan;
    return this.enqueue(() =>
      this.database.transaction('rw', this.database.plans, () => this.database.plans.put(snapshot)),
    );
  }
  delete(id: string) {
    return this.enqueue(() =>
      this.database.transaction('rw', this.database.plans, () => this.database.plans.delete(id)),
    );
  }
  async list(): Promise<Plan[]> {
    await this.tail;
    return (await this.database.plans.orderBy('updatedAt').reverse().toArray()).map((p) =>
      refreshVersions(migrateRecord(p)),
    );
  }
  async load(id: string): Promise<Plan | undefined> {
    await this.tail;
    const raw = await this.database.plans.get(id);
    return raw ? refreshVersions(migrateRecord(raw)) : undefined;
  }
}
export const repository = new PlanRepository(db);
