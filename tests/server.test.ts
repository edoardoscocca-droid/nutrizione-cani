// Il server di calcolo restituisce lo stesso risultato del motore locale.
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { formulate } from '../src/engine/formulate';
import { input } from './helpers';

process.env.NODE_ENV = 'test';
let url = '';
let close: () => void;
beforeAll(async () => {
  const { server } = await import('../server/index');
  await new Promise<void>((r) => server.listen(0, r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});
afterAll(() => close());

test('formulazione via server = formulazione locale', async () => {
  const inp = input(['test_beef', 'test_oats', 'test_carrot'], ['test_multi', 'test_fish_oil_caps', 'test_bone_meal']);
  const res = await fetch(`${url}/api/formulate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(inp) });
  expect(res.status).toBe(200);
  const remote = await res.json();
  const local = await formulate(inp);
  expect(remote.items).toEqual(local.items);
  expect(remote.audit.status).toBe(local.audit!.status);
});

test('analisi preliminare, richiesta non valida, salute', async () => {
  const inp = input(['test_beef'], []);
  const pre = await (await fetch(`${url}/api/preliminary`, { method: 'POST', body: JSON.stringify(inp) })).json();
  expect(pre.provisional).toBe(true);
  expect((await fetch(`${url}/api/formulate`, { method: 'POST', body: '{"x":1}' })).status).toBe(400);
  expect((await fetch(`${url}/api/formulate`, { method: 'POST', body: 'non json' })).status).toBe(400);
  expect(await (await fetch(`${url}/health`)).json()).toEqual(expect.objectContaining({ ok: true }));
});
