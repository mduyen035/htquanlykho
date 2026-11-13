import type { InventoryRepository, Command } from '../application/ports';
import { executeCommand } from '../application/execute';
import type { Database, User } from '../domain/model';
import { seed } from './seed';
import { mapDatabase } from './schema';
export const STORAGE_KEY = 'trinh-inventory-v1';
export class MockInventoryRepository implements InventoryRepository {
  async load(): Promise<Database> {
    await new Promise((r) => setTimeout(r, 180));
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const db = mapDatabase(JSON.parse(raw));
      if (!db.stockSnapshots?.length)
        db.stockSnapshots = [
          { date: new Date().toISOString(), stocks: structuredClone(db.stocks) },
        ];
      return db;
    }
    const db = seed();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return db;
  }
  async execute(command: Command, actor: User) {
    const db = executeCommand(await this.load(), command, actor);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return db;
  }
}
export class HttpClient {
  constructor(private baseUrl: string) {}
  async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
      credentials: 'include',
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
    if (!response.ok) {
      let message = `API trả về lỗi ${response.status}`;
      try {
        const body = await response.json();
        if (typeof body.message === 'string') message = body.message;
      } catch {
        /* Preserve safe status fallback. */
      }
      throw new Error(message);
    }
    return response.json();
  }
}
export class RestInventoryRepository implements InventoryRepository {
  constructor(private http: HttpClient) {}
  async load(signal?: AbortSignal) {
    return mapDatabase(await this.http.request('/inventory/snapshot', { signal }));
  }
  async execute(command: Command, _actor: User) {
    // Actor identity MUST come from the server session.
    return mapDatabase(
      await this.http.request('/inventory/commands', {
        method: 'POST',
        body: JSON.stringify(command),
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      }),
    );
  }
}
