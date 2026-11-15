import { describe, expect, it } from 'vitest';
import { seed } from '../src/infrastructure/seed';
import { executeCommand } from '../src/application/execute';
import { lossReport, stockReport, salesPreview } from '../src/application/queries';
import { loss, stockOf } from '../src/domain/rules';
import { mapDatabase } from '../src/infrastructure/schema';
import type { User } from '../src/domain/model';
const owner: User = { id: '1', name: 'Owner', role: 'owner', branchId: 'hc' };
const manager: User = { ...owner, role: 'manager' };
const staff: User = { ...owner, role: 'staff' };
describe('Approval and material lifecycle', () => {
  it('does not activate a new material until owner approval', () => {
    const db = seed();
    const material = { ...db.materials[0], id: 'NEW', name: 'Trà mới' };
    const pending = executeCommand(
      db,
      { type: 'saveMaterial', material, operation: 'create' },
      manager,
    );
    expect(pending.materials.find((m) => m.id === 'NEW')).toBeUndefined();
    const command = {
      type: 'decide' as const,
      id: pending.proposals[0].id,
      approve: true,
      reason: '',
    };
    expect(() => executeCommand(pending, command, manager)).toThrow('Chỉ Chủ cửa hàng');
    const approved = executeCommand(pending, command, owner);
    expect(approved.materials.find((m) => m.id === 'NEW')?.name).toBe('Trà mới');
    expect(() => executeCommand(approved, command, owner)).toThrow('không còn chờ');
  });
  it('rejects duplicate material names', () => {
    const db = seed();
    expect(() =>
      executeCommand(
        db,
        { type: 'saveMaterial', material: { ...db.materials[0], id: 'NEW' }, operation: 'create' },
        owner,
      ),
    ).toThrow('đã tồn tại');
  });
  it('prevents staff edits and manager cross-branch operations', () => {
    const db = seed();
    expect(() =>
      executeCommand(
        db,
        { type: 'saveMaterial', material: db.materials[0], operation: 'update' },
        staff,
      ),
    ).toThrow();
    expect(() =>
      executeCommand(db, { type: 'deleteMovement', id: 'PNK-0009', reason: 'Hủy' }, manager),
    ).toThrow('chi nhánh');
  });
  it('requires a rejection reason and retains original recipe until approved', () => {
    const db = seed();
    const old = db.recipes[0];
    db.proposals = db.proposals.filter((p) => p.kind !== 'recipe');
    const pending = executeCommand(
      db,
      {
        type: 'saveRecipe',
        recipe: { ...old, lines: [{ materialId: 'NVL-002', quantity: 0.02 }] },
        operation: 'update',
      },
      manager,
    );
    expect(pending.recipes[0].lines).toEqual(old.lines);
    expect(() =>
      executeCommand(
        pending,
        { type: 'decide', id: pending.proposals[0].id, approve: false, reason: '' },
        owner,
      ),
    ).toThrow('lý do');
    const approved = executeCommand(
      pending,
      { type: 'decide', id: pending.proposals[0].id, approve: true, reason: '' },
      owner,
    );
    expect(approved.recipes[0].version).toBe(3);
    expect(approved.recipes[0].history[0]).toEqual(old.history[0]);
  });
});
describe('Warehouse transactions', () => {
  it('creation and approval never increase stock', () => {
    const db = seed();
    const movement = { ...db.movements[0], id: 'NEW', branchId: manager.branchId };
    const created = executeCommand(db, { type: 'saveMovement', movement, editing: false }, manager);
    expect(created.stocks).toEqual(db.stocks);
    const approved = executeCommand(
      created,
      { type: 'decide', id: created.proposals[0].id, approve: true, reason: '' },
      owner,
    );
    expect(approved.stocks).toEqual(db.stocks);
    expect(approved.movements[0].status).toBe('receiving');
  });
  it('receives only good quantities, then handles backorder without double credit', () => {
    const db = seed();
    const m = db.movements.find((m) => m.id === 'PNK-0008')!;
    const lines = m.lines.map((l) => ({
      ...l,
      received: l.quantity,
      defective: l.materialId === 'NVL-001' ? 2 : 0,
      reason: 'Bao bì lỗi',
    }));
    const first = executeCommand(db, { type: 'recordMovement', id: m.id, lines, note: '' }, staff);
    expect(stockOf(first, 'hc', 'NVL-001')).toBe(63);
    expect(first.movements.find((x) => x.id === m.id)?.status).toBe('backorder');
    const rest = lines.map((l) => ({
      ...l,
      received: l.materialId === 'NVL-001' ? 2 : 0,
      defective: 0,
    }));
    const second = executeCommand(
      first,
      { type: 'recordMovement', id: m.id, lines: rest, note: '' },
      staff,
    );
    expect(stockOf(second, 'hc', 'NVL-001')).toBe(65);
    expect(second.movements.find((x) => x.id === m.id)?.status).toBe('completed');
    expect(() =>
      executeCommand(second, { type: 'recordMovement', id: m.id, lines: rest, note: '' }, staff),
    ).toThrow();
  });
  it('rolls back all lines if any receipt is invalid', () => {
    const db = seed();
    const before = structuredClone(db);
    const m = db.movements.find((m) => m.id === 'PNK-0008')!;
    expect(() =>
      executeCommand(
        db,
        {
          type: 'recordMovement',
          id: m.id,
          note: '',
          lines: m.lines.map((l, i) => ({
            ...l,
            received: l.quantity + (i === 2 ? 1 : 0),
            defective: 0,
          })),
        },
        staff,
      ),
    ).toThrow();
    expect(db).toEqual(before);
  });
  it('checks current availability at dispatch and prevents repeated completion', () => {
    const db = seed();
    const m = db.movements.find((m) => m.id === 'PXK-0012')!;
    const lines = m.lines.map((l) => ({ ...l, received: l.quantity, defective: 0 }));
    const next = executeCommand(db, { type: 'recordMovement', id: m.id, lines, note: '' }, staff);
    expect(stockOf(next, 'hc', 'NVL-001')).toBe(35);
    expect(() =>
      executeCommand(next, { type: 'recordMovement', id: m.id, lines, note: '' }, staff),
    ).toThrow();
    lines[0].received = 1000;
    expect(() =>
      executeCommand(db, { type: 'recordMovement', id: m.id, lines, note: '' }, staff),
    ).toThrow('vượt tồn');
  });
  it('soft-deletes only unexecuted movements and records the reason in audit', () => {
    const db = seed();
    const next = executeCommand(
      db,
      { type: 'deleteMovement', id: 'PNK-0009', reason: 'Đặt nhầm' },
      owner,
    );
    expect(next.movements.find((m) => m.id === 'PNK-0009')?.status).toBe('deleted');
    expect(next.audit[0].actor).toBe('Owner');
    expect(next.stocks).toEqual(db.stocks);
    expect(() =>
      executeCommand(db, { type: 'deleteMovement', id: 'PNK-0006', reason: 'Hủy' }, owner),
    ).toThrow();
  });
});
describe('Count, sales and reports', () => {
  it('uses authoritative stock rather than the theoretical value supplied by the UI', () => {
    const db = seed();
    const c = {
      ...db.counts[0],
      id: 'NEW-COUNT',
      lines: [{ materialId: 'NVL-001', actual: 39, theoretical: 999 }],
    };
    const next = executeCommand(db, { type: 'count', count: c }, staff);
    expect(next.counts[0].lines[0].theoretical).toBe(40);
    expect(next.stocks).toEqual(db.stocks);
    expect(next.counts[0].handlingStatus).toBe('pendingHandling');
    const handled = executeCommand(
      next,
      {
        type: 'handleCount',
        id: c.id,
        lines: [{ materialId: 'NVL-001', reason: 'Hao hụt bảo quản', remedy: 'Bổ sung hộp kín' }],
      },
      manager,
    );
    expect(handled.proposals[0].adjustments?.[0].delta).toBe(-1);
    const approved = executeCommand(
      handled,
      { type: 'decide', id: handled.proposals[0].id, approve: true, reason: '' },
      owner,
    );
    expect(stockOf(approved, 'hc', 'NVL-001')).toBe(39);
  });
  it('overwrites theoretical consumption without changing physical stock', () => {
    const db = seed();
    const sales = {
      id: 'NEW-SALES',
      branchId: 'hc',
      period: '2026-11',
      filename: 'test.xlsx',
      date: '2026-11-10',
      lines: [{ recipeId: 'MON-001', quantity: 20 }],
    };
    const first = executeCommand(db, { type: 'sales', sales }, manager);
    const second = executeCommand(
      first,
      { type: 'sales', sales, replaceOverlapping: true },
      manager,
    );
    expect(second.sales.filter((s) => s.branchId === 'hc' && s.period === '2026-11')).toHaveLength(
      1,
    );
    expect(stockOf(second, 'hc', 'NVL-002')).toBe(stockOf(first, 'hc', 'NVL-002'));
    expect(stockOf(first, 'hc', 'NVL-002')).toBe(stockOf(db, 'hc', 'NVL-002'));
    expect(
      first.sales[0].consumption.find((i) => i.materialId === 'NVL-002')?.quantity,
    ).toBeCloseTo(0.4);
    const changed = executeCommand(
      second,
      {
        type: 'sales',
        sales: { ...sales, lines: [{ recipeId: 'MON-001', quantity: 10 }] },
        replaceOverlapping: true,
      },
      manager,
    );
    expect(stockOf(changed, 'hc', 'NVL-002')).toBe(stockOf(db, 'hc', 'NVL-002'));
    expect(
      changed.sales[0].consumption.find((i) => i.materialId === 'NVL-002')?.quantity,
    ).toBeCloseTo(0.2);
  });
  it('classifies loss independently of the inventory minimum', () => {
    expect(loss(32, 30, 0.6).classification).toBe('Vượt mức');
    expect(loss(40, 39.5, 0.8).classification).toBe('Trong mức');
    expect(loss(40, 41, 0.8).classification).toBe('Thừa kho');
  });
  it('requires sales and count data for the selected branch and period', () => {
    const db = seed();
    expect(lossReport(db, owner, '2026-10', 'all', 'all')).toHaveLength(4);
    expect(lossReport(db, manager, '2026-10', 'all', 'all')).toHaveLength(2);
    db.sales = [];
    expect(lossReport(db, owner, '2026-10', 'all', 'all')).toEqual([]);
  });
  it('does not reuse an old reconciliation after the sales file has changed', () => {
    const db = seed();
    db.sales.find((s) => s.branchId === 'hc')!.id = 'replacement';
    expect(lossReport(db, manager, '2026-10', 'all', 'all')).toHaveLength(0);
  });
  it('rejects invalid API DTOs at the repository boundary', () => {
    expect(mapDatabase(seed()).materials).toHaveLength(6);
    const db = seed();
    db.stocks[0].quantity = -1;
    expect(() => mapDatabase(db)).toThrow();
    expect(() => mapDatabase({ materials: [] })).toThrow();
  });
});
describe('SDD corrections', () => {
  it('atomically replaces overlapping month/quarter imports after explicit confirmation', () => {
    const db = seed();
    const sale = {
      id: 'MONTH11',
      branchId: 'hc',
      period: '2026-11',
      filename: 'sales.xlsx',
      date: '2026-11-13',
      lines: [{ recipeId: 'MON-001', quantity: 20 }],
    };
    const november = executeCommand(db, { type: 'sales', sales: sale }, manager);
    const quarter = {
      ...sale,
      id: 'Q4',
      period: '2026-Q4',
      lines: [{ recipeId: 'MON-001', quantity: 30 }],
    };
    expect(() => executeCommand(november, { type: 'sales', sales: quarter }, manager)).toThrow(
      'xác nhận',
    );
    const replaced = executeCommand(
      november,
      { type: 'sales', sales: quarter, replaceOverlapping: true },
      manager,
    );
    expect(replaced.sales.filter((s) => s.branchId === 'hc').map((s) => s.period)).toEqual([
      '2026-Q4',
    ]);
    expect(stockOf(replaced, 'hc', 'NVL-002')).toBe(stockOf(db, 'hc', 'NVL-002'));
    const again = executeCommand(
      replaced,
      { type: 'sales', sales: quarter, replaceOverlapping: true },
      manager,
    );
    expect(stockOf(again, 'hc', 'NVL-002')).toBe(stockOf(db, 'hc', 'NVL-002'));
  });
  it('requires an integer minimum and a recorded reason before material deletion', () => {
    const db = seed();
    expect(() =>
      executeCommand(
        db,
        {
          type: 'saveMaterial',
          operation: 'create',
          material: { ...db.materials[0], id: 'NEW', name: 'Mới', minimum: 0.5 },
        },
        manager,
      ),
    ).toThrow('số nguyên');
    expect(() =>
      executeCommand(
        db,
        { type: 'saveMaterial', operation: 'delete', material: db.materials[5] },
        owner,
      ),
    ).toThrow('lý do xóa');
    const next = executeCommand(
      db,
      {
        type: 'saveMaterial',
        operation: 'delete',
        material: db.materials[5],
        reason: 'Ngừng kinh doanh',
      },
      owner,
    );
    expect(next.proposals[0].reason).toBe('Ngừng kinh doanh');
  });
  it('freezes book quantities at count creation while stock moves later', () => {
    const initial = executeCommand(
      seed(),
      { type: 'beginCount', id: 'DRAFT', branchId: 'hc' },
      manager,
    );
    const moved = executeCommand(
      initial,
      {
        type: 'recordMovement',
        id: 'PXK-0012',
        note: '',
        lines: initial.movements
          .find((m) => m.id === 'PXK-0012')!
          .lines.map((l) => ({ ...l, received: l.quantity, defective: 0 })),
      },
      staff,
    );
    const count = {
      ...initial.counts[0],
      id: 'DRAFT',
      draftId: 'DRAFT',
      lines: initial.countDrafts![0].lines.map((l) => ({
        ...l,
        actual: l.theoretical,
        theoretical: 999,
      })),
    };
    const saved = executeCommand(moved, { type: 'count', count }, manager);
    expect(saved.counts[0].lines[0].theoretical).toBe(40);
    expect(stockOf(saved, 'hc', 'NVL-001')).toBe(35);
  });
  it('discards an unfinished stocktake without changing stock', () => {
    const original = seed();
    const started = executeCommand(
      original,
      { type: 'beginCount', id: 'DRAFT-CANCEL', branchId: 'hc' },
      staff,
    );
    expect(started.countDrafts?.some((d) => d.id === 'DRAFT-CANCEL')).toBe(true);
    const cancelled = executeCommand(started, { type: 'cancelCount', id: 'DRAFT-CANCEL' }, staff);
    expect(cancelled.countDrafts?.some((d) => d.id === 'DRAFT-CANCEL')).toBe(false);
    expect(cancelled.stocks).toEqual(original.stocks);
  });
  it('requires a reason for every discrepancy and blocks staff handling', () => {
    const db = seed();
    const count = {
      ...db.counts[0],
      id: 'COUNT2',
      reason: '',
      remedy: '',
      lines: [
        {
          materialId: 'NVL-001',
          actual: 39,
          theoretical: 0,
          reason: 'Rơi vãi',
          remedy: 'Đóng hộp',
        },
        { materialId: 'NVL-002', actual: 31, theoretical: 0 },
      ],
    };
    expect(() => executeCommand(db, { type: 'count', count }, manager)).toThrow('nguyên nhân');
    const blind = executeCommand(db, { type: 'count', count }, staff);
    expect(() =>
      executeCommand(blind, { type: 'handleCount', id: 'COUNT2', lines: [] }, staff),
    ).toThrow('Chỉ Quản lý');
  });
  it('keeps missing recipes in sales and excludes only those drinks from consumption', () => {
    const db = seed();
    const lines = [
      { recipeId: 'MON-001', quantity: 10 },
      { recipeId: 'UNKNOWN', name: 'Trà đào', quantity: 20 },
    ];
    const preview = salesPreview(db, lines);
    expect(preview.total).toBe(30);
    expect(preview.missing).toEqual(['UNKNOWN']);
    const saved = executeCommand(
      db,
      {
        type: 'sales',
        sales: {
          id: 'NEW',
          branchId: 'hc',
          period: '2026-Q3',
          filename: 'sales.xlsx',
          date: '2026-11-13',
          lines,
        },
      },
      manager,
    );
    expect(saved.sales[0].missingRecipeIds).toEqual(['UNKNOWN']);
    expect(saved.sales[0].consumption.find((c) => c.materialId === 'NVL-002')?.quantity).toBe(0.2);
  });
  it('checks incident reason, then records actual dispatch and audit without allowing repeats', () => {
    const db = seed();
    const lines = db.movements
      .find((m) => m.id === 'PXK-0012')!
      .lines.map((l) => ({ ...l, received: l.quantity }));
    expect(() =>
      executeCommand(
        db,
        {
          type: 'recordMovement',
          id: 'PXK-0012',
          lines,
          note: '',
          outcome: 'incident',
          incidentReason: '',
        },
        staff,
      ),
    ).toThrow('lý do sự cố');
    const saved = executeCommand(
      db,
      {
        type: 'recordMovement',
        id: 'PXK-0012',
        lines,
        note: '',
        outcome: 'incident',
        incidentReason: 'Rơi vãi',
      },
      staff,
    );
    expect(saved.movements.find((m) => m.id === 'PXK-0012')?.incidentReason).toBe('Rơi vãi');
    expect(stockOf(saved, 'hc', 'NVL-001')).toBe(35);
    expect(saved.audit[0].action).toBe('recordMovement');
  });
  it('uses the selected stock report day and protects historical snapshots', () => {
    const db = seed();
    expect(stockReport(db, owner, '2026-11-03', 'hc', 'NVL-001')[0].quantity).toBe(40);
    db.stocks[0].quantity = 1;
    expect(stockReport(db, owner, '2026-11-03', 'hc', 'NVL-001')[0].quantity).toBe(40);
    expect(stockReport(db, owner, '2020-01-01', 'all', 'all')).toEqual([]);
    expect(stockReport(db, staff, '2026-11-03', 'all', 'all')).toEqual([]);
  });
});

describe('Owner direct actions and required deletion reasons', () => {
  it('applies owner material changes immediately and keeps a completed history', () => {
    const db = seed();
    const next = executeCommand(
      db,
      {
        type: 'saveMaterial',
        operation: 'create',
        material: { ...db.materials[0], id: 'OWNER-NEW', name: 'Trà chủ cửa hàng' },
      },
      owner,
    );
    expect(next.materials.find((m) => m.id === 'OWNER-NEW')?.active).toBe(true);
    expect(next.proposals[0].status).toBe('approved');
    expect(next.proposals[0].decidedBy).toBe(owner.name);
    expect(next.stocks).toEqual(db.stocks);
  });
  it('applies owner recipes immediately, requires deletion reasons for every role and preserves history', () => {
    const db = seed();
    const r = {
      ...db.recipes[0],
      id: 'OWNER-RECIPE',
      name: 'Món thử mới',
      version: 0,
      history: [],
    };
    const created = executeCommand(
      db,
      { type: 'saveRecipe', operation: 'create', recipe: r },
      owner,
    );
    const current = created.recipes.find((x) => x.id === r.id)!;
    expect(current.version).toBe(1);
    for (const actor of [owner, manager])
      expect(() =>
        executeCommand(
          created,
          { type: 'saveRecipe', operation: 'delete', recipe: current, reason: '  ' },
          actor,
        ),
      ).toThrow('lý do xóa');
    const removed = executeCommand(
      created,
      { type: 'saveRecipe', operation: 'delete', recipe: current, reason: 'Ngừng bán món' },
      owner,
    );
    expect(removed.recipes.find((x) => x.id === r.id)?.active).toBe(false);
    expect(removed.proposals[0].reason).toBe('Ngừng bán món');
    expect(removed.proposals[0].status).toBe('approved');
  });
  it('skips approval for owner purchase plans without changing stock before receipt', () => {
    const db = seed();
    const next = executeCommand(
      db,
      {
        type: 'saveMovement',
        editing: false,
        movement: { ...db.movements.find((m) => m.kind === 'inbound')!, id: 'OWNER-PURCHASE' },
      },
      owner,
    );
    expect(next.movements[0].status).toBe('receiving');
    expect(next.proposals[0].status).toBe('approved');
    expect(next.stocks).toEqual(db.stocks);
  });
  it('applies owner count adjustments directly after per-line explanations', () => {
    const db = seed();
    const next = executeCommand(
      db,
      {
        type: 'count',
        count: {
          ...db.counts[0],
          id: 'OWNER-COUNT',
          reason: 'Hao hụt',
          remedy: 'Bảo quản kín',
          lines: [{ materialId: 'NVL-001', actual: 39, theoretical: 40 }],
        },
      },
      owner,
    );
    expect(stockOf(next, 'hc', 'NVL-001')).toBe(39);
    expect(next.counts[0].handlingStatus).toBe('complete');
    expect(next.proposals[0].status).toBe('approved');
  });
});
