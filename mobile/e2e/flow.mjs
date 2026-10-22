// Prova automatica delle schermate dell'app (versione browser della stessa app). Uso: node e2e/flow.mjs <url> <cartella>
import { chromium } from '../../node_modules/playwright/index.mjs';
const [url, out] = process.argv.slice(2);
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const shot = (n) => page.screenshot({ path: `${out}/m-${n}.png`, fullPage: true });
const tap = (name) => page.getByRole('button', { name, exact: true }).first().click();
await page.goto(url);
await page.getByText('Usa senza account').click({ timeout: 4000 }).catch(() => {});
await page.getByText('Ho capito').click();
await page.getByText('+ Nuovo cane').click();
await page.getByLabel('Nome', { exact: true }).fill('Fido');
await page.getByLabel('Razza (anche «meticcio»)').fill('Irish Wolfhound');
await page.getByLabel('Peso attuale (kg)').fill('30');
await page.getByRole('textbox', { name: 'Fattore energetico' }).fill('1,6');
await shot('01-cane');
await tap('Salva');
await page.getByText('Fido', { exact: false }).first().click();
await page.getByText('+ Nuova ricetta').click();
await page.getByLabel('Nome della ricetta').fill('Manzo e avena');
await page.getByText('Umida', { exact: true }).click();
// alimenti reali del catalogo del 22/10 (i prodotti [TEST] sono nascosti dagli elenchi)
for (const [q, n] of [['Pollo petto', 'Pollo petto crudo senza pelle'], ['Riso bianco cotto', 'Riso bianco cotto senza sale'], ['Carota cotta', 'Carota cotta al vapore, proxy bollita'], ['Olio di girasole', 'Olio di girasole']]) {
  await page.getByLabel('Cerca…').fill(q);
  await page.getByText(n, { exact: true }).first().click();
}
await shot('02-alimenti');
await page.getByText('Analisi preliminare →').click();
await page.getByText('Analisi preliminare (indicativa)').waitFor({ timeout: 120000 });
const supps = await page.textContent('body');
const hiddenOk = !supps.includes('[TEST]');
for (const n of ['Q.Diet Compensa (standard, NON Crescita/Ultra)', 'Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%)', 'Omegor Vitality 1000 (capsula)']) await page.getByText(n, { exact: true }).click();
await shot('03-integratori');
await page.getByText('Calcola le quantità →').click();
await page.getByText('Razione dell’intero giorno').waitFor({ timeout: 120000 }).catch(async (e) => { await shot('04-errore'); throw e; });
await shot('04-risultato');
await page.getByText('Salva ricetta').click();
await page.getByText('Storico', { exact: true }).waitFor({ timeout: 30000 });
await shot('05-ricetta');
// diario: registra la ricetta per oggi
await page.goBack();
await page.locator('text="Diario: cosa ha mangiato →" >> visible=true').first().click();
await page.waitForTimeout(1500); await shot('06a-diario-prima');
await page.locator('text="Manzo e avena" >> visible=true').last().click();
await page.locator('text="Registra" >> visible=true').last().click();
await page.getByText(/Registrati 1 giorni/).first().waitFor({ timeout: 30000 });
await shot('06-diario');
// dopo il riavvio i dati sono ancora nell'archivio locale
await page.goto(url);
await page.getByText('Ho capito').click({ timeout: 4000 }).catch(() => {});
await page.locator('text="Fido" >> visible=true').first().click();
await page.locator('text="Diario: cosa ha mangiato →" >> visible=true').first().click();
await page.getByText(/Registrati 1 giorni/).first().waitFor({ timeout: 30000 });
await shot('06b-diario-dopo-riavvio');
const persisted = await page.evaluate(() => {
  const raw = Object.keys(localStorage).map((k) => localStorage.getItem(k) ?? '').join('');
  return { dogs: raw.includes('Fido'), recipe: raw.includes('Manzo e avena'), diary: raw.includes('"diary":[{') };
});
// catalogo: nessun prodotto [TEST] o voce con il solo nome
await page.goto(url);
await page.getByText('Catalogo', { exact: true }).first().click();
await page.getByText(/Tutti \(/).first().waitFor({ timeout: 30000 });
const cat = await page.textContent('body');
await shot('07-catalogo');
console.log(JSON.stringify({ errors, hiddenInRecipe: hiddenOk, catalogWithoutTest: !cat.includes('[TEST]'), catalogCount: cat.match(/Tutti \((\d+)\)/)?.[1], persisted }));
await browser.close();
