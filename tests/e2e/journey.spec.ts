import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { complete } from '../fixtures';
import AxeBuilder from '@axe-core/playwright';

test('mobile oven journey, save/reopen, alternatives, offline reload/export, confirmed deletion', async ({
  page,
  context,
}) => {
  const requests: string[] = [];
  page.on('pageerror', (error) => console.error('APP ERROR:', error.message));
  page.on('requestfailed', (request) =>
    console.error('FAILED REQUEST:', request.url(), request.failure()),
  );
  context.on('request', (request) => {
    if (
      request.method() !== 'GET' ||
      !request.url().startsWith('http://127.0.0.1:4173/') ||
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(request.url())
    )
      requests.push(request.url());
  });
  await page.goto('/');
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.getByRole('button', { name: 'Nova instalação' }).click();
  await page.getByLabel('Nome da instalação').fill('Forno da cozinha');
  await page.getByLabel('Potência nominal').fill('3500');
  await page.getByLabel('Tensão nominal').selectOption('220');
  await page.getByLabel('Alimentação', { exact: true }).selectOption('LL');
  await page.getByLabel('Conexão do equipamento').selectOption('Tomada');
  await page.getByLabel('Confirmei que a carga').check();
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await expect(page.locator('.current-number')).toContainText('15,91');
  await page.getByRole('link', { name: 'Continuar' }).click();
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await expect(page.getByLabel('Temperatura ambiente')).toHaveValue('');
  await page.getByLabel('Distância do quadro').fill('12,');
  await page.getByRole('link', { name: '1 Equipamento' }).click();
  await page.getByRole('link', { name: '2 Trajeto' }).click();
  await expect(page.getByLabel('Distância do quadro')).toHaveValue('12,');
  await page.getByLabel('Distância do quadro').fill('12');
  await page.getByLabel('Método de instalação').selectOption('B1');
  await page.getByLabel('O trajeto corresponde').check();
  await page.getByLabel('Temperatura ambiente').selectOption('30');
  await page.getByRole('link', { name: 'Continuar' }).click();
  await page.getByRole('link', { name: 'Ver resultados' }).click();
  await expect(page.locator('.metrics')).toContainText('2,5');
  await expect(page.locator('.result-status')).toContainText('Dimensionamento preliminar');
  await expect(page.locator('.alternative').nth(1)).toContainText('Dados insuficientes');
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.getByRole('button', { name: 'Salvar plano', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Salvamento confirmado');
  const path = new URL(page.url()).pathname + new URL(page.url()).hash;
  await page.getByRole('link', { name: '← Instalações', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Forno da cozinha' })).toBeVisible();
  await page.getByRole('link', { name: 'Forno da cozinha' }).click();
  await expect(page.locator('.metrics')).toContainText('2,5');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.metrics')).toContainText('2,5');
  await page.getByRole('link', { name: 'Editar equipamento' }).click();
  await page.getByLabel('Potência nominal').fill('4400');
  await expect(page.locator('.current-number')).toContainText('20');
  await expect(page.getByRole('status')).toContainText('Salvo neste dispositivo');
  await page.goto(path);
  await expect(page.locator('.metrics')).toContainText('20');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar PDF' }).click();
  const download = await downloadPromise;
  mkdirSync('tmp/pdfs', { recursive: true });
  await download.saveAs('tmp/pdfs/oven-offline.pdf');
  const text = execFileSync('pdftotext', ['-layout', 'tmp/pdfs/oven-offline.pdf', '-'], {
    encoding: 'utf8',
  });
  expect(text).toContain('Forno da cozinha');
  expect(text).toContain('4400');
  expect(text).toContain('20 A');
  expect(text).toContain('AGUARDANDO VALIDAÇÃO');
  expect(text).toContain('Prysmian');
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: '← Instalações', exact: true }).click();
  await page.getByRole('button', { name: 'Excluir Forno da cozinha' }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Forno da cozinha' })).toBeVisible();
  await page.getByRole('button', { name: 'Excluir Forno da cozinha' }).click();
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click();
  await expect(page.getByRole('heading', { name: 'Seu primeiro plano começa aqui' })).toBeVisible();
});

test('long report pagination, snapshot agreement and known failed checks', async ({ page }) => {
  const p = complete();
  p.name = 'Aquecimento · São José / ação técnica';
  p.safety.checks.grounding.state = 'failed';
  for (const c of Object.values(p.safety.checks))
    c.note = 'Verificação profissional: proteção, conexão e condições da instalação. '.repeat(15);
  await page.goto('/');
  await page.evaluate(async (plan) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('planovolt');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('plans', 'readwrite');
      tx.objectStore('plans').put(plan);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, p);
  await page.goto(`/#/plan/${p.id}/results`);
  await expect(page.locator('.result-status')).toContainText('Plano bloqueado');
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar PDF' }).click();
  const download = await promise;
  await download.saveAs('tmp/pdfs/long-report.pdf');
  const text = execFileSync('pdftotext', ['tmp/pdfs/long-report.pdf', '-'], { encoding: 'utf8' });
  expect(text).toContain(p.name);
  expect(text).toContain(p.id);
  expect(text).toContain('Plano bloqueado');
  expect(text).toContain('3500');
  expect(text).toContain('15,9091');
  expect(text).toContain('<=');
  const info = execFileSync('pdfinfo', ['tmp/pdfs/long-report.pdf'], { encoding: 'utf8' });
  expect(Number(info.match(/Pages:\s+(\d+)/)?.[1])).toBeGreaterThan(3);
  expect(readFileSync('tmp/pdfs/long-report.pdf').subarray(0, 4).toString()).toBe('%PDF');
});

test('storage errors remain visible and never claim a successful save', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('planovolt');
      request.onsuccess = () => resolve();
      request.onblocked = () => resolve();
    });
  });
  await page.addInitScript(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException('Simulated full storage', 'QuotaExceededError');
    };
  });
  await page.reload();
  await page.getByRole('button', { name: 'Nova instalação' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível salvar');
  await expect(page.getByRole('status')).toContainText('Não salvo');
});

test('updates wait through editing and activate only from Home', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
  });
  await page.getByRole('button', { name: 'Nova instalação' }).click();
  await page.getByLabel('Nome da instalação').fill('Atualização entre sessões');
  await page.getByLabel('Potência nominal').fill('3500');
  const editingURL = page.url();
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js?update-test=1');
  });
  await expect
    .poll(() =>
      page.evaluate(async () =>
        Boolean((await navigator.serviceWorker.getRegistration())?.waiting),
      ),
    )
    .toBe(true);
  expect(page.url()).toBe(editingURL);
  await expect(page.getByRole('button', { name: 'Atualizar aplicativo' })).toHaveCount(0);
  await expect(page.getByLabel('Potência nominal')).toHaveValue('3500');
  await page.getByRole('link', { name: '← Instalações', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Atualizar aplicativo' }).click(),
  ]);
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL))
    .toContain('update-test=1');
  await expect(page.getByRole('link', { name: 'Atualização entre sessões' })).toBeVisible();
});

test('switching plans flushes a pending draft without losing incomplete inputs', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova instalação' }).click();
  await page.getByLabel('Nome da instalação').fill('Primeiro plano');
  await page.getByLabel('Potência nominal').fill('12,');
  await page.getByRole('link', { name: '← Instalações', exact: true }).click();
  await page.getByRole('button', { name: 'Nova instalação' }).click();
  await page.getByLabel('Nome da instalação').fill('Segundo plano');
  await page.getByRole('link', { name: '← Instalações', exact: true }).click();
  await page.getByRole('link', { name: 'Primeiro plano' }).click();
  await page.getByRole('link', { name: 'Editar equipamento' }).click();
  await expect(page.getByLabel('Potência nominal')).toHaveValue('12,');
});

test('current updates within one second with 4x desktop CPU throttling', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova instalação' }).click();
  await page.getByLabel('Potência nominal').fill('3500');
  await page.getByLabel('Tensão nominal').selectOption('220');
  await page.getByLabel('Confirmei que a carga').check();
  await expect(page.locator('.current-number')).toContainText('15,91');
  const client = await context.newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const start = performance.now();
  await page.getByLabel('Potência nominal').fill('4400');
  await expect(page.locator('.current-number')).toContainText('20');
  expect(performance.now() - start).toBeLessThan(1000);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
});
