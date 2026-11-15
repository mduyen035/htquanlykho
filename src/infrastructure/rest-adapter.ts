import type { Command } from '../application/ports';
import type { Database, User } from '../domain/model';
import type { HttpClient } from './repositories';

type Row = Record<string, any>;
const number = (value: unknown) => Number(value ?? 0);
const iso = (value: unknown) =>
  value ? new Date(String(value)).toISOString() : new Date().toISOString();
const period = (value: unknown) => String(value || new Date().toISOString().slice(0, 7));

export class BackendInventoryAdapter {
  private materials = new Map<string, string>();
  private recipes = new Map<string, string>();
  private slips = new Map<string, { id: string; kind: 'inbound' | 'outbound' }>();
  private counts = new Map<string, string>();
  private draftAliases = new Map<string, string>();
  private suppliers = new Map<string, string>();
  private branches: string[] = [];
  constructor(private http: HttpClient) {}
  private get<T = Row[]>(path: string, signal?: AbortSignal): Promise<T> {
    return this.http.request(path, { signal }) as Promise<T>;
  }
  private post<T = Row>(path: string, body: unknown): Promise<T> {
    return this.http.request(path, { method: 'POST', body: JSON.stringify(body) }) as Promise<T>;
  }
  private patch<T = Row>(path: string, body: unknown): Promise<T> {
    return this.http.request(path, { method: 'PATCH', body: JSON.stringify(body) }) as Promise<T>;
  }
  private materialId(code: string) {
    return this.materials.get(code) || code;
  }
  private recipeId(code: string) {
    return this.recipes.get(code) || code;
  }
  private slip(id: string) {
    const found = this.slips.get(id);
    if (!found) throw new Error('Không tìm thấy phiếu trong dữ liệu mới nhất.');
    return found;
  }
  private countId(code: string) {
    return this.counts.get(code) || this.draftAliases.get(code) || code;
  }
  private async supplierId(name: string) {
    const key = name.trim().toLocaleLowerCase('vi');
    if (this.suppliers.has(key)) return this.suppliers.get(key)!;
    const created = await this.post<{ id: string }>('/suppliers', { name: name.trim() });
    this.suppliers.set(key, created.id);
    return created.id;
  }
  async load(signal?: AbortSignal): Promise<Database> {
    const [branches, materials, recipes, imports, exports, stocktakes, suppliers, users] =
      await Promise.all([
        this.get<Row[]>('/branches', signal),
        this.get<Row[]>('/materials', signal),
        this.get<Row[]>('/recipes', signal),
        this.get<Row[]>('/imports', signal),
        this.get<Row[]>('/exports', signal),
        this.get<Row[]>('/stocktakes', signal),
        this.get<Row[]>('/suppliers', signal),
        this.get<Row[]>('/users', signal),
      ]);
    const me = await this.get<Row>('/auth/me', signal);
    const management = me.role !== 'nhanvien';
    const [approvals, sales] = await Promise.all([
      management ? this.get<Row[]>('/approvals', signal) : Promise.resolve([]),
      management ? this.get<Row[]>('/sales-imports', signal) : Promise.resolve([]),
    ]);
    this.branches = branches.map((b) => b.id);
    this.materials = new Map(materials.map((m) => [m.code, m.id]));
    this.recipes = new Map(recipes.map((r) => [r.code, r.id]));
    this.suppliers = new Map(suppliers.map((s) => [String(s.name).toLocaleLowerCase('vi'), s.id]));
    const materialCode = (id: string) => materials.find((m) => m.id === id)?.code || id;
    const recipeCode = (id: string) => recipes.find((r) => r.id === id)?.code || id;
    const userName = (id: string) => users.find((u) => u.id === id)?.name || id;
    const materialView = materials.map((m) => ({
      id: m.code,
      name: m.name,
      unit: m.unit,
      minimum: number(
        m.minStocks?.[me.branchIds?.[0] || branches[0]?.id] ?? Object.values(m.minStocks || {})[0],
      ),
      allowance: number(m.allowedLossQuantity),
      supplier: m.supplier || '',
      active: m.status === 'active',
      price: number(m.standardPrice),
      description: m.description || '',
    }));
    const stocks = materials.flatMap((m) =>
      Object.entries(m.stocks || {}).map(([branchId, quantity]) => ({
        materialId: m.code,
        branchId,
        opening: 0,
        inbound: 0,
        outbound: 0,
        quantity: number(quantity),
        adjustment: 0,
      })),
    );
    const versionDetails = new Map<string, Row>();
    const versionRequests = recipes.flatMap((r) =>
      (r.versions || []).map((v: Row) =>
        this.get<Row>(`/recipes/${r.id}/versions/${v.id}`, signal).then((detail) =>
          versionDetails.set(v.id, detail),
        ),
      ),
    );
    await Promise.all(versionRequests);
    const recipeView = recipes.map((r) => {
      const current = (r.versions || []).find((v: Row) => v.id === r.currentVersionId);
      const ingredients = (r.ingredients || []).map((i: Row) => ({
        materialId: materialCode(i.materialId),
        quantity: number(i.quantity),
      }));
      return {
        id: r.code,
        name: r.name,
        category: r.category,
        version: number(current?.versionNo),
        note: r.note || '',
        active: r.status === 'active',
        lines: ingredients,
        history: (r.versions || [])
          .filter((v: Row) => v.approvedAt)
          .map((v: Row) => ({
            version: number(v.versionNo),
            date: iso(v.approvedAt),
            approver: userName(versionDetails.get(v.id)?.approvedBy),
            lines: (versionDetails.get(v.id)?.ingredients || []).map((i: Row) => ({
              materialId: materialCode(i.materialId),
              quantity: number(i.quantity),
            })),
            note: versionDetails.get(v.id)?.note || '',
          })),
      };
    });
    const [importDetails, exportDetails, countDetails, saleDetails] = await Promise.all([
      Promise.all(imports.map((x) => this.get<Row>(`/imports/${x.id}`, signal))),
      Promise.all(exports.map((x) => this.get<Row>(`/exports/${x.id}`, signal))),
      Promise.all(stocktakes.map((x) => this.get<Row>(`/stocktakes/${x.id}`, signal))),
      Promise.all(sales.map((x) => this.get<Row>(`/sales-imports/${x.id}`, signal))),
    ]);
    this.slips.clear();
    const movements: Database['movements'] = [
      ...imports.map((x, index) => {
        const detail = importDetails[index];
        this.slips.set(x.code, { id: x.id, kind: 'inbound' });
        const receipts = detail.receipts || [];
        return {
          id: x.code,
          kind: 'inbound' as const,
          branchId: x.branchId,
          supplier: suppliers.find((s) => s.id === x.supplierId)?.name || '',
          type: 'internal' as const,
          reason: '',
          note: x.note || '',
          date: iso(x.createdAt),
          expectedDate: String(x.expectedDate || '').slice(0, 10),
          creator: userName(x.creatorId),
          status:
            (
              {
                pending_approval: 'pending',
                approved: 'receiving',
                receiving: 'backorder',
                cancelled: 'deleted',
              } as Record<string, Database['movements'][number]['status']>
            )[x.status] || x.status,
          lines: (detail.items || []).map((i: Row) => ({
            materialId: materialCode(i.materialId),
            quantity: number(i.plannedQuantity),
            received: number(i.receivedGoodQuantity),
            defective: receipts.reduce(
              (n: number, receipt: Row) =>
                n +
                number(
                  receipt.items?.find((ri: Row) => ri.materialId === i.materialId)?.defectQuantity,
                ),
              0,
            ),
            reason:
              receipts
                .flatMap((receipt: Row) => receipt.items || [])
                .find((ri: Row) => ri.materialId === i.materialId)?.defectReason || '',
          })),
        };
      }),
      ...exports.map((x, index) => {
        const detail = exportDetails[index];
        this.slips.set(x.code, { id: x.id, kind: 'outbound' });
        return {
          id: x.code,
          kind: 'outbound' as const,
          branchId: x.branchId,
          destinationId: x.targetBranchId || undefined,
          supplier: '',
          type: x.type === 'chuyen_kho' ? ('transfer' as const) : ('internal' as const),
          reason: x.reason,
          note: x.reason,
          date: iso(x.createdAt),
          expectedDate: '',
          creator: userName(x.creatorId),
          status:
            (
              {
                pending_approval: 'pending',
                pending_confirmation: 'ready',
                cancelled: 'deleted',
              } as Record<string, Database['movements'][number]['status']>
            )[x.status] || x.status,
          incidentReason: detail.incident_reason || undefined,
          lines: (detail.items || []).map((i: Row) => ({
            materialId: materialCode(i.materialId),
            quantity: number(i.requestedQuantity),
            received: i.actualQuantity == null ? undefined : number(i.actualQuantity),
          })),
        };
      }),
    ];
    this.counts.clear();
    const countDrafts: NonNullable<Database['countDrafts']> = [];
    const counts: Database['counts'] = [];
    for (let index = 0; index < stocktakes.length; index++) {
      const x = stocktakes[index],
        detail = countDetails[index];
      const alias = [...this.draftAliases].find(([, serverId]) => serverId === x.id)?.[0];
      this.counts.set(x.code, x.id);
      const lines: Database['counts'][number]['lines'] = (detail.items || []).map((i: Row) => ({
        materialId: materialCode(i.materialId),
        actual: number(i.actualStock),
        theoretical: number(i.systemStock),
        reason: i.differenceReason || '',
        remedy: i.remedy || '',
      }));
      if (x.status === 'draft')
        countDrafts.push({
          id: alias || x.code,
          branchId: x.branchId,
          creatorId: x.creatorId,
          createdAt: iso(x.createdAt),
          lines: lines.map((l) => ({ materialId: l.materialId, theoretical: l.theoretical })),
        });
      else
        counts.push({
          id: x.code,
          branchId: x.branchId,
          date: iso(x.completedAt || x.createdAt),
          period: period(detail.period),
          creator: userName(x.creatorId),
          note: x.note || '',
          reason: '',
          remedy: '',
          lines,
          handlingStatus:
            x.status === 'adjusted'
              ? 'complete'
              : lines.some((l) => l.actual !== l.theoretical && (!l.reason || !l.remedy))
                ? 'pendingHandling'
                : 'pendingApproval',
        });
    }
    const salesView: Database['sales'] = saleDetails.map((x) => {
      const consumption = new Map<string, number>();
      for (const item of x.items || []) {
        const version = versionDetails.get(item.recipeVersionId);
        for (const i of version?.ingredients || []) {
          const code = materialCode(i.materialId);
          consumption.set(
            code,
            (consumption.get(code) || 0) + number(item.quantity) * number(i.quantity),
          );
        }
      }
      return {
        id: x.id,
        branchId: x.branchId,
        period: x.period,
        filename: x.fileName || '',
        date: iso(x.importedAt),
        lines: [
          ...(x.items || []).map((i: Row) => ({
            recipeId: recipeCode(i.recipeId),
            quantity: number(i.quantity),
            name: i.recipeName,
          })),
          ...(x.unmatchedItems || []).map((i: Row) => ({
            recipeId: i.recipeId,
            quantity: number(i.quantity),
            name: i.name || undefined,
          })),
        ],
        missingRecipeIds: (x.unmatchedItems || []).map((i: Row) => i.recipeId),
        consumption: [...consumption].map(([materialId, quantity]) => ({ materialId, quantity })),
      };
    });
    for (const count of counts) {
      const sale = salesView.find(
        (s) => s.branchId === count.branchId && s.period === count.period,
      );
      if (sale) {
        count.salesVersion = sale.id;
      }
    }
    const proposals: Database['proposals'] = approvals.map((a) => {
      const kind =
        (
          {
            import_plan: 'movement',
            export_transfer: 'movement',
            stock_adjustment: 'adjustment',
            recipe: 'recipe',
            material: 'material',
            threshold: 'material',
          } as Record<string, Database['proposals'][number]['kind']>
        )[a.type] || 'material';
      const targetId =
        kind === 'movement'
          ? [...this.slips].find(([, value]) => value.id === a.referenceId)?.[0] || a.referenceId
          : kind === 'recipe'
            ? recipeCode(a.referenceId)
            : kind === 'material'
              ? materialCode(a.referenceId)
              : stocktakes.find((x) => x.id === a.referenceId)?.code || a.referenceId;
      const count = counts.find((c) => c.id === targetId);
      return {
        id: a.id,
        kind,
        branchId: a.branchId || me.branchIds?.[0] || branches[0]?.id || '',
        date: iso(a.requestedAt),
        creator: a.requesterName || userName(a.requesterId),
        reason: a.reason || '',
        status: a.status,
        targetId,
        operation:
          a.action === 'deactivate' ? 'delete' : a.action === 'update' ? 'update' : 'create',
        decisionReason: a.reviewNote || undefined,
        decidedBy: a.reviewedBy ? userName(a.reviewedBy) : undefined,
        decidedAt: a.reviewedAt ? iso(a.reviewedAt) : undefined,
        material: kind === 'material' ? materialView.find((m) => m.id === targetId) : undefined,
        recipe: kind === 'recipe' ? recipeView.find((r) => r.id === targetId) : undefined,
        adjustments:
          kind === 'adjustment'
            ? count?.lines
                .filter((l) => l.actual !== l.theoretical)
                .map((l) => ({
                  materialId: l.materialId,
                  delta: l.actual - l.theoretical,
                  theoretical: l.theoretical,
                  reason: l.reason,
                }))
            : undefined,
      };
    });
    for (const count of counts)
      if (proposals.some((p) => p.targetId === count.id && p.status === 'pending'))
        count.handlingStatus = 'pendingApproval';
    return {
      branches: branches.map((b) => ({ id: b.id, name: b.name })),
      materials: materialView,
      stocks,
      movements,
      recipes: recipeView,
      proposals,
      counts,
      sales: salesView,
      audit: [],
      countDrafts,
      stockSnapshots: [{ date: new Date().toISOString(), stocks }],
    };
  }
  async execute(command: Command, actor: User): Promise<void> {
    switch (command.type) {
      case 'saveMaterial': {
        const m = command.material;
        if (command.operation === 'delete') {
          await this.post(`/materials/${this.materialId(m.id)}/deactivate`, {
            reason: command.reason,
          });
          break;
        }
        const supplierId = await this.supplierId(m.supplier);
        const body = {
          name: m.name,
          category: 'Nguyên vật liệu',
          unit: m.unit,
          standardPrice: m.price,
          allowedLossQuantity: m.allowance,
          supplierId,
          description: m.description || '',
        };
        const result =
          command.operation === 'create'
            ? await this.post<{ id: string }>('/materials', body)
            : await this.patch<{ id: string }>(`/materials/${this.materialId(m.id)}`, body);
        const materialId = result.id || this.materialId(m.id);
        for (const branchId of this.branches)
          await this.post('/thresholds/requests', {
            branchId,
            materialId,
            minimumQuantity: m.minimum,
            reason: `Định mức ${m.name}`,
          });
        break;
      }
      case 'saveRecipe': {
        const r = command.recipe;
        if (command.operation === 'delete') {
          await this.post(`/recipes/${this.recipeId(r.id)}/deactivate`, { reason: command.reason });
          break;
        }
        const body = {
          name: r.name,
          category: r.category,
          price: 0,
          note: r.note,
          ingredients: r.lines.map((i) => ({
            materialId: this.materialId(i.materialId),
            quantity: i.quantity,
          })),
        };
        if (command.operation === 'create') await this.post('/recipes', body);
        else await this.patch(`/recipes/${this.recipeId(r.id)}`, body);
        break;
      }
      case 'saveMovement': {
        const m = command.movement;
        const body =
          m.kind === 'inbound'
            ? {
                branchId: m.branchId,
                supplierId: await this.supplierId(m.supplier),
                expectedDate: m.expectedDate,
                note: m.note,
                items: m.lines.map((i) => ({
                  materialId: this.materialId(i.materialId),
                  plannedQuantity: i.quantity,
                  unitPrice: 0,
                })),
              }
            : {
                branchId: m.branchId,
                targetBranchId: m.destinationId,
                type: m.type === 'transfer' ? 'chuyen_kho' : 'cap_quay',
                reason: m.reason || m.note,
                items: m.lines.map((i) => ({
                  materialId: this.materialId(i.materialId),
                  requestedQuantity: i.quantity,
                })),
              };
        const path = m.kind === 'inbound' ? '/imports' : '/exports';
        if (command.editing) await this.patch(`${path}/${this.slip(m.id).id}`, body);
        else await this.post(path, body);
        break;
      }
      case 'deleteMovement': {
        const slip = this.slip(command.id);
        await this.post(`/${slip.kind === 'inbound' ? 'imports' : 'exports'}/${slip.id}/cancel`, {
          reason: command.reason,
        });
        break;
      }
      case 'recordMovement': {
        const slip = this.slip(command.id);
        if (slip.kind === 'inbound')
          await this.post(`/imports/${slip.id}/receive`, {
            idempotencyKey: crypto.randomUUID(),
            items: command.lines.map((i) => ({
              materialId: this.materialId(i.materialId),
              receivedQuantity: i.received || 0,
              defectQuantity: i.defective || 0,
              defectReason: i.reason,
            })),
          });
        else
          await this.post(`/exports/${slip.id}/confirm`, {
            incidentStatus: command.outcome || 'normal',
            incidentReason: command.incidentReason,
            items: command.lines.map((i) => ({
              materialId: this.materialId(i.materialId),
              actualQuantity: i.received || 0,
            })),
          });
        break;
      }
      case 'decide': {
        await this.post(
          `/approvals/${command.id}/${command.approve ? 'approve' : 'reject'}`,
          command.approve ? { note: command.reason } : { reason: command.reason },
        );
        break;
      }
      case 'beginCount': {
        const currentPeriod = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7);
        const created = await this.post<{ id: string }>('/stocktakes', {
          branchId: command.branchId,
          period: currentPeriod,
        });
        this.draftAliases.set(command.id, created.id);
        break;
      }
      case 'count': {
        const c = command.count,
          id = this.countId(c.draftId || c.id);
        await this.patch(`/stocktakes/${id}`, {
          note: c.note,
          period: c.period,
          items: c.lines.map((l) => ({
            materialId: this.materialId(l.materialId),
            actualStock: l.actual,
          })),
        });
        await this.post(`/stocktakes/${id}/complete`, {});
        const changed = c.lines.filter((l) => l.actual !== l.theoretical);
        if (actor.role !== 'staff' && changed.length) {
          await this.patch(`/stocktakes/${id}/handling`, {
            items: changed.map((l) => ({
              materialId: this.materialId(l.materialId),
              reason: l.reason,
              remedy: l.remedy,
            })),
          });
          const proposal = await this.post<{ approvalId: string }>(
            `/stocktakes/${id}/propose-adjustment`,
            { reason: c.note },
          );
          if (actor.role === 'owner')
            await this.post(`/approvals/${proposal.approvalId}/approve`, {});
        }
        this.draftAliases.delete(c.draftId || c.id);
        break;
      }
      case 'handleCount': {
        const id = this.countId(command.id);
        await this.patch(`/stocktakes/${id}/handling`, {
          items: command.lines.map((l) => ({ ...l, materialId: this.materialId(l.materialId) })),
        });
        const proposal = await this.post<{ approvalId: string }>(
          `/stocktakes/${id}/propose-adjustment`,
          { reason: 'Xử lý chênh lệch kiểm kê' },
        );
        if (actor.role === 'owner')
          await this.post(`/approvals/${proposal.approvalId}/approve`, {});
        break;
      }
      case 'sales': {
        await this.post('/sales-imports', {
          branchId: command.sales.branchId,
          period: command.sales.period,
          fileName: command.sales.filename,
          overwrite: !!command.replaceOverlapping,
          items: command.sales.lines.map((l) => ({ ...l, recipeId: this.recipeId(l.recipeId) })),
        });
        break;
      }
    }
  }
}
