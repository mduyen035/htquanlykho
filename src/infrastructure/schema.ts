import { z } from 'zod';
const n = z.number().finite();
const nn = n.nonnegative();
const line = z.object({
  materialId: z.string(),
  quantity: nn,
  received: nn.optional(),
  defective: nn.optional(),
  reason: z.string().optional(),
});
const material = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.string(),
  minimum: nn,
  allowance: nn,
  supplier: z.string(),
  active: z.boolean(),
  price: nn,
  description: z.string().optional(),
});
const recipe = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  size: z.string().optional(),
  version: nn,
  note: z.string(),
  active: z.boolean(),
  lines: z.array(line),
  history: z.array(
    z.object({
      version: nn,
      date: z.string(),
      approver: z.string(),
      lines: z.array(line),
      note: z.string().optional(),
    }),
  ),
});
export const databaseSchema = z.object({
  branches: z.array(z.object({ id: z.string(), name: z.string() })),
  materials: z.array(material),
  stocks: z.array(
    z.object({
      materialId: z.string(),
      branchId: z.string(),
      opening: nn,
      inbound: nn,
      outbound: nn,
      quantity: nn,
      adjustment: n.optional(),
    }),
  ),
  movements: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['inbound', 'outbound']),
      branchId: z.string(),
      destinationId: z.string().optional(),
      supplier: z.string(),
      type: z.enum(['internal', 'transfer']),
      reason: z.string(),
      note: z.string(),
      date: z.string(),
      expectedDate: z.string(),
      creator: z.string(),
      incidentReason: z.string().optional(),
      status: z.enum([
        'pending',
        'approved',
        'rejected',
        'receiving',
        'backorder',
        'ready',
        'completed',
        'incident',
        'deleted',
      ]),
      lines: z.array(line),
    }),
  ),
  recipes: z.array(recipe),
  proposals: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['adjustment', 'movement', 'recipe', 'material']),
      branchId: z.string(),
      date: z.string(),
      creator: z.string(),
      reason: z.string(),
      status: z.enum(['pending', 'approved', 'rejected']),
      targetId: z.string(),
      operation: z.enum(['create', 'update', 'delete']),
      material: material.optional(),
      beforeMaterial: material.optional(),
      recipe: recipe.optional(),
      beforeRecipe: recipe.optional(),
      adjustments: z
        .array(
          z.object({
            materialId: z.string(),
            delta: n,
            theoretical: nn.optional(),
            reason: z.string().optional(),
          }),
        )
        .optional(),
      decisionReason: z.string().optional(),
      decidedBy: z.string().optional(),
      decidedAt: z.string().optional(),
    }),
  ),
  counts: z.array(
    z.object({
      id: z.string(),
      branchId: z.string(),
      date: z.string(),
      period: z.string(),
      salesVersion: z.string().optional(),
      draftId: z.string().optional(),
      handlingStatus: z.enum(['pendingHandling', 'pendingApproval', 'complete']).optional(),
      creator: z.string(),
      note: z.string(),
      reason: z.string(),
      remedy: z.string(),
      lines: z.array(
        z.object({
          materialId: z.string(),
          actual: nn,
          theoretical: n,
          reason: z.string().optional(),
          remedy: z.string().optional(),
        }),
      ),
    }),
  ),
  sales: z.array(
    z.object({
      id: z.string(),
      branchId: z.string(),
      period: z.string(),
      filename: z.string(),
      date: z.string(),
      lines: z.array(z.object({ recipeId: z.string(), quantity: nn, name: z.string().optional() })),
      missingRecipeIds: z.array(z.string()).optional(),
      consumption: z.array(z.object({ materialId: z.string(), quantity: nn })),
    }),
  ),
  audit: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      actor: z.string(),
      action: z.string(),
      targetId: z.string(),
      before: z.string(),
      after: z.string(),
    }),
  ),
  countDrafts: z
    .array(
      z.object({
        id: z.string(),
        branchId: z.string(),
        creatorId: z.string(),
        createdAt: z.string(),
        lines: z.array(z.object({ materialId: z.string(), theoretical: nn })),
      }),
    )
    .optional(),
  stockSnapshots: z
    .array(
      z.object({
        date: z.string(),
        stocks: z.array(
          z.object({
            materialId: z.string(),
            branchId: z.string(),
            opening: nn,
            inbound: nn,
            outbound: nn,
            quantity: nn,
            adjustment: n.optional(),
          }),
        ),
      }),
    )
    .optional(),
});
// Explicit anti-corruption boundary: replace this mapper when the backend DTO is agreed.
export const mapDatabase = (dto: unknown) => databaseSchema.parse(dto);
