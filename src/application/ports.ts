import type { Database, User } from '../domain/model';
// Reads are filtered by actor in the service; real servers MUST enforce scope themselves.
export interface InventoryRepository {
  load(signal?: AbortSignal): Promise<Database>;
  execute(command: Command, actor: User): Promise<Database>;
}
export type Command =
  | {
      type: 'saveMaterial';
      material: Database['materials'][number];
      operation: 'create' | 'update' | 'delete';
      reason?: string;
    }
  | {
      type: 'saveRecipe';
      recipe: Database['recipes'][number];
      reason?: string;
      operation: 'create' | 'update' | 'delete';
    }
  | { type: 'saveMovement'; movement: Database['movements'][number]; editing: boolean }
  | { type: 'deleteMovement'; id: string; reason: string }
  | {
      type: 'recordMovement';
      id: string;
      lines: Database['movements'][number]['lines'];
      note: string;
      outcome?: 'normal' | 'incident';
      incidentReason?: string;
    }
  | { type: 'decide'; id: string; approve: boolean; reason: string }
  | { type: 'count'; count: Database['counts'][number] }
  | { type: 'beginCount'; id: string; branchId: string }
  | {
      type: 'handleCount';
      id: string;
      lines: { materialId: string; reason: string; remedy: string }[];
    }
  | {
      type: 'sales';
      sales: Omit<Database['sales'][number], 'consumption'>;
      replaceOverlapping?: boolean;
    };
