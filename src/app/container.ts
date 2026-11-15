import {
  HttpClient,
  MockInventoryRepository,
  RestInventoryRepository,
} from '../infrastructure/repositories';
export const isMock = import.meta.env.VITE_DATA_SOURCE !== 'rest';
export const http = new HttpClient(
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:4000/api',
);
export const repository = isMock
  ? new MockInventoryRepository()
  : new RestInventoryRepository(http);
