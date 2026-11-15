import { describe, expect, it } from 'vitest';
import { HttpClient, TOKEN_KEY } from '../src/infrastructure/repositories';
import { BackendInventoryAdapter } from '../src/infrastructure/rest-adapter';
import { mapDatabase } from '../src/infrastructure/schema';

describe.runIf(process.env.RUN_API_INTEGRATION === '1')('Backend REST contract', () => {
  it('logs in and maps the live catalog and documents', async () => {
    const entries = new Map<string, string>();
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => {
          entries.set(key, value);
        },
        removeItem: (key: string) => {
          entries.delete(key);
        },
      },
    });
    const http = new HttpClient(process.env.API_BASE_URL || 'http://127.0.0.1:4000/api');
    const login = (await http.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'chucuahang', password: process.env.SEED_PASSWORD }),
    })) as { token: string };
    entries.set(TOKEN_KEY, login.token);
    const db = mapDatabase(await new BackendInventoryAdapter(http).load());
    expect(db.branches.length).toBeGreaterThan(0);
    expect(db.materials.length).toBeGreaterThan(0);
    expect(db.recipes.length).toBeGreaterThan(0);
    expect(db.stocks.length).toBeGreaterThan(0);
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    const at = encodeURIComponent(`${today}T23:59:59.999+07:00`);
    const from = encodeURIComponent(`${today}T00:00:00+07:00`);
    const report = (await http.request(
      `/reports/inventory?branchId=${db.branches[0].id}&at=${at}&from=${from}`,
    )) as {
      items: { opening: number; inbound: number; outbound: number; quantity: number }[];
    };
    expect(report.items.length).toBeGreaterThan(0);
    expect(typeof report.items[0].opening).toBe('number');
  }, 60000);
});
