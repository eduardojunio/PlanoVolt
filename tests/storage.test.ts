import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { PlanDatabase, PlanRepository, refreshVersions } from '../src/storage/plans';
import { complete } from './fixtures';
import { ruleset } from '../src/domain/rules';
const databases: PlanDatabase[] = [];
const setup = () => {
  const db = new PlanDatabase(crypto.randomUUID());
  databases.push(db);
  return { db, repo: new PlanRepository(db) };
};
afterEach(async () => {
  for (const db of databases.splice(0)) await db.delete();
});
describe('local draft persistence', () => {
  it('saves incomplete decimal input, reopens, edits, deletes in write order', async () => {
    const { repo } = setup(),
      p = complete();
    p.equipment.power = '12,';
    await repo.save(p);
    expect((await repo.load(p.id))?.equipment.power).toBe('12,');
    p.name = 'Edited';
    const saving = repo.save(p),
      deleting = repo.delete(p.id);
    await Promise.all([saving, deleting]);
    expect(await repo.load(p.id)).toBeUndefined();
  });
  it('surfaces storage failure and allows retry without falsely resolving', async () => {
    const { db, repo } = setup(),
      p = complete();
    const failure = vi
      .spyOn(db.plans, 'put')
      .mockRejectedValueOnce(new DOMException('Full', 'QuotaExceededError'));
    await expect(repo.save(p)).rejects.toThrow('Full');
    await repo.save(p);
    expect((await repo.load(p.id))?.id).toBe(p.id);
    failure.mockRestore();
  });
  it('transactionally upgrades v1 records and invalidates previous confirmations', async () => {
    const name = crypto.randomUUID(),
      legacy = new Dexie(name);
    legacy.version(1).stores({ plans: 'id, updatedAt' });
    const p = { ...complete(), schemaVersion: 1, engineVersion: undefined };
    await legacy.table('plans').put(p);
    legacy.close();
    const db = new PlanDatabase(name);
    databases.push(db);
    const loaded = await new PlanRepository(db).load(p.id);
    expect(loaded?.schemaVersion).toBe(2);
    expect(loaded?.safety.checks.supply.state).toBe('pending');
    expect(loaded?.engineVersion).toBe('0.1.0');
  });
  it('refuses corrupt/future records without overwriting them', async () => {
    const { db, repo } = setup(),
      p = complete();
    await db.table('plans').put({ ...p, schemaVersion: 99 });
    await expect(repo.load(p.id)).rejects.toThrow();
    expect((await db.table('plans').get(p.id)).schemaVersion).toBe(99);
  });
  it('ruleset changes invalidate evidence but retain known failures', () => {
    const p = complete();
    p.rulesetVersion = 'old';
    p.safety.checks.grounding.state = 'failed';
    const refreshed = refreshVersions(p);
    expect(refreshed.rulesetVersion).toBe(ruleset.version);
    expect(refreshed.safety.checks.supply.state).toBe('pending');
    expect(refreshed.safety.checks.grounding.state).toBe('failed');
  });
});
