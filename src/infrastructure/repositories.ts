import type { InventoryRepository, Command } from '../application/ports';
import { executeCommand } from '../application/execute';
import type { Database, User } from '../domain/model';
import { seed } from './seed';
import { mapDatabase } from './schema';
import { BackendInventoryAdapter } from './rest-adapter';
export const STORAGE_KEY = 'trinh-inventory-v1';
export const TOKEN_KEY = 'trinh-api-token';
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
    const token = sessionStorage.getItem(TOKEN_KEY);
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    if (!response.ok) {
      let message = `API trả về lỗi ${response.status}`;
      try {
        const body = await response.json();
        if (typeof body.error === 'string') message = body.error;
        else if (typeof body.message === 'string') message = body.message;
      } catch {
        /* Preserve safe status fallback. */
      }
      throw new Error(message);
    }
    return response.status === 204 ? null : response.json();
  }
}
export class RestInventoryRepository implements InventoryRepository {
  private adapter: BackendInventoryAdapter;
  constructor(http: HttpClient) {
    this.adapter = new BackendInventoryAdapter(http);
  }
  async load(signal?: AbortSignal) {
    return mapDatabase(await this.adapter.load(signal));
  }
  async execute(command: Command, actor: User) {
    await this.adapter.execute(command, actor);
    return this.load();
  }
}
