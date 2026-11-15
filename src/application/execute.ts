import type { Audit, Database, Material, Movement, Proposal, Stock, User } from '../domain/model';
import {
  assert,
  canManage,
  checkBranch,
  editableMovement,
  nonnegative,
  positive,
  stockOf,
  validateMaterial,
} from '../domain/rules';
import type { Command } from './ports';
import { periodsOverlap } from './queries';
export const newId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
export const nextCode = (prefix: string, ids: string[], width = 4) =>
  `${prefix}-${String(Math.max(0, ...ids.filter((id) => new RegExp(`^${prefix}-\\d+$`).test(id)).map((id) => Number(id.slice(prefix.length + 1)))) + 1).padStart(width, '0')}`;
const now = () => new Date().toISOString();
function stock(db: Database, branchId: string, materialId: string): Stock {
  let s = db.stocks.find((s) => s.branchId === branchId && s.materialId === materialId);
  if (!s) {
    s = { branchId, materialId, quantity: 0, opening: 0, inbound: 0, outbound: 0 };
    db.stocks.push(s);
  }
  return s;
}
function proposal(
  db: Database,
  user: User,
  data: Omit<Proposal, 'id' | 'date' | 'creator' | 'status'>,
) {
  if (user.role === 'owner') {
    for (const pending of db.proposals.filter(
      (p) => p.targetId === data.targetId && p.status === 'pending',
    )) {
      pending.status = 'rejected';
      pending.decisionReason = 'Được thay thế bởi thay đổi trực tiếp của Chủ cửa hàng.';
      pending.decidedBy = user.name;
      pending.decidedAt = now();
    }
  }
  assert(
    !db.proposals.some((p) => p.targetId === data.targetId && p.status === 'pending'),
    'Đối tượng đã có đề xuất chờ phê duyệt.',
  );
  db.proposals.unshift({
    ...data,
    id: newId(data.kind === 'adjustment' ? 'DC' : 'PD'),
    date: now(),
    creator: user.name,
    status: 'pending',
  });
}
function available(db: Database, id: string): Material {
  const m = db.materials.find((m) => m.id === id && m.active);
  assert(m, 'Nguyên vật liệu không tồn tại hoặc đã ngừng sử dụng.');
  return m;
}
function validateMovement(db: Database, m: Movement) {
  assert(
    m.lines.length > 0 && new Set(m.lines.map((l) => l.materialId)).size === m.lines.length,
    'Cần ít nhất một nguyên vật liệu và không được trùng lặp.',
  );
  assert(
    db.branches.some((b) => b.id === m.branchId),
    'Chi nhánh không hợp lệ.',
  );
  assert(
    m.kind === 'inbound' ? m.supplier.trim() && m.expectedDate : m.reason.trim() && m.note.trim(),
    'Vui lòng nhập đầy đủ thông tin bắt buộc.',
  );
  if (m.type === 'transfer')
    assert(
      m.destinationId &&
        m.destinationId !== m.branchId &&
        db.branches.some((b) => b.id === m.destinationId),
      'Chọn chi nhánh nhận khác chi nhánh xuất.',
    );
  for (const l of m.lines) {
    available(db, l.materialId);
    positive(l.quantity);
    if (m.kind === 'outbound')
      assert(
        l.quantity <= stockOf(db, m.branchId, l.materialId),
        'Số lượng xuất vượt tồn kho khả dụng.',
      );
  }
}
function applyApproval(db: Database, p: Proposal, user: User, reason: string) {
  if (p.kind === 'movement') {
    const m = db.movements.find((m) => m.id === p.targetId);
    assert(m && m.status === 'pending', 'Phiếu không còn chờ phê duyệt.');
    validateMovement(db, m);
    m.status = m.kind === 'inbound' ? 'receiving' : 'ready';
  }
  if (p.kind === 'material' && p.material) {
    validateMaterial(p.material, db.materials);
    if (p.operation === 'delete') {
      assert(
        !db.stocks.some((s) => s.materialId === p.targetId && s.quantity > 0) &&
          !db.recipes.some((r) => r.active && r.lines.some((l) => l.materialId === p.targetId)),
        'Nguyên vật liệu còn tồn kho hoặc đang được sử dụng.',
      );
    }
    const item = { ...p.material, active: p.operation !== 'delete' };
    const i = db.materials.findIndex((m) => m.id === p.targetId);
    if (i < 0) db.materials.push(item);
    else db.materials[i] = item;
  }
  if (p.kind === 'recipe' && p.recipe) {
    for (const l of p.recipe.lines) available(db, l.materialId);
    const i = db.recipes.findIndex((r) => r.id === p.targetId);
    const old = db.recipes[i];
    const item = {
      ...p.recipe,
      active: p.operation !== 'delete',
      version: (old?.version ?? 0) + 1,
      history: [
        ...(old?.history ?? []),
        {
          version: (old?.version ?? 0) + 1,
          date: now(),
          approver: user.name,
          lines: structuredClone(p.recipe.lines),
          note: reason || p.recipe.note,
        },
      ],
    };
    if (i < 0) db.recipes.push(item);
    else db.recipes[i] = item;
  }
  if (p.kind === 'adjustment')
    for (const a of p.adjustments ?? []) {
      const s = stock(db, p.branchId, a.materialId);
      assert(s.quantity + a.delta >= 0, 'Tồn kho đã thay đổi, điều chỉnh này gây âm kho.');
      s.quantity += a.delta;
      s.adjustment = (s.adjustment ?? 0) + a.delta;
    }

  p.status = 'approved';
  p.decisionReason = reason;
  p.decidedAt = now();
  p.decidedBy = user.name;
  if (p.kind === 'adjustment') {
    const count = db.counts.find((c) => c.id === p.targetId);
    if (count) count.handlingStatus = 'complete';
  }
}
/** Pure transaction. Validate all lines before commit; repositories persist only successful results. */
export function executeCommand(source: Database, command: Command, user: User): Database {
  const db = structuredClone(source);
  const before = JSON.stringify({ ...source, audit: [], stockSnapshots: [] });
  let targetId = '';
  switch (command.type) {
    case 'saveMaterial': {
      assert(canManage(user.role), 'Nhân viên không được quản lý nguyên vật liệu.');
      const m = { ...command.material, name: command.material.name.trim() };
      targetId = m.id;
      validateMaterial(m, db.materials);
      assert(
        command.operation === 'create'
          ? !db.materials.some((x) => x.id === m.id)
          : db.materials.some((x) => x.id === m.id),
        'Mã nguyên vật liệu không hợp lệ.',
      );
      if (command.operation === 'delete') {
        assert(command.reason?.trim(), 'Bắt buộc nhập lý do xóa nguyên vật liệu.');
        assert(
          !db.stocks.some((s) => s.materialId === m.id && s.quantity > 0),
          'Không thể ngừng sử dụng nguyên vật liệu còn tồn kho.',
        );
        assert(
          !db.recipes.some((r) => r.active && r.lines.some((l) => l.materialId === m.id)),
          'Nguyên vật liệu đang được sử dụng trong công thức.',
        );
      }
      proposal(db, user, {
        kind: 'material',
        branchId: user.branchId,
        targetId: m.id,
        operation: command.operation,
        material: m,
        beforeMaterial: db.materials.find((x) => x.id === m.id),
        reason:
          command.reason?.trim() ||
          `${command.operation === 'delete' ? 'Ngừng sử dụng' : command.operation === 'create' ? 'Thêm' : 'Cập nhật'} ${m.name}`,
      });
      break;
    }
    case 'saveRecipe': {
      assert(canManage(user.role), 'Bạn không có quyền quản lý công thức.');
      if (command.operation === 'delete')
        assert(command.reason?.trim(), 'Bắt buộc nhập lý do xóa công thức.');
      const r = command.recipe;
      targetId = r.id;
      const current = db.recipes.find((x) => x.id === r.id);
      assert(command.operation === 'create' ? !current : !!current, 'Công thức không hợp lệ.');
      if (command.operation === 'update') {
        assert(r.note.trim(), 'Ghi chú pha chế là bắt buộc.');
        assert(
          JSON.stringify([r.name, r.category, r.lines, r.note]) !==
            JSON.stringify([current!.name, current!.category, current!.lines, current!.note]),
          'Đề xuất chỉnh sửa phải có thay đổi so với công thức đang áp dụng.',
        );
      }
      assert(
        r.name.trim() && r.category && r.lines.length,
        'Nhập tên món và ít nhất một nguyên vật liệu.',
      );
      assert(
        !db.recipes.some(
          (x) => x.id !== r.id && x.name.toLocaleLowerCase('vi') === r.name.toLocaleLowerCase('vi'),
        ),
        'Tên món đã tồn tại.',
      );
      assert(
        new Set(r.lines.map((l) => l.materialId)).size === r.lines.length,
        'Nguyên vật liệu trong công thức không được trùng.',
      );
      for (const l of r.lines) {
        available(db, l.materialId);
        positive(l.quantity, 'Định lượng');
      }
      proposal(db, user, {
        kind: 'recipe',
        branchId: user.branchId,
        targetId: r.id,
        operation: command.operation,
        recipe: r,
        beforeRecipe: db.recipes.find((x) => x.id === r.id),
        reason: command.reason?.trim() || r.note || `Thay đổi công thức ${r.name}`,
      });
      break;
    }
    case 'saveMovement': {
      assert(canManage(user.role), 'Nhân viên chỉ được xem và ghi nhận phiếu.');
      const m = command.movement;
      checkBranch(user, m.branchId);
      validateMovement(db, m);
      targetId = m.id;
      if (command.editing) {
        const previous = db.movements.find((x) => x.id === m.id);
        assert(
          previous && editableMovement(previous),
          'Không thể sửa phiếu ở trạng thái hiện tại.',
        );
        checkBranch(user, previous.branchId);
        assert(
          m.branchId === previous.branchId && m.kind === previous.kind,
          'Không được thay đổi chi nhánh và loại phiếu khi sửa.',
        );
        Object.assign(previous, m, {
          date: previous.date,
          status: previous.status,
          creator: previous.creator,
        });
        const p = db.proposals.find((p) => p.targetId === m.id && p.status === 'pending');
        if (p) p.reason = m.reason || m.note;
      } else {
        assert(!db.movements.some((x) => x.id === m.id), 'Mã phiếu đã tồn tại.');
        const status = m.kind === 'inbound' || m.type === 'transfer' ? 'pending' : 'ready';
        db.movements.unshift({ ...m, status, date: now(), creator: user.name });
        if (status === 'pending')
          proposal(db, user, {
            kind: 'movement',
            branchId: m.branchId,
            targetId: m.id,
            operation: 'create',
            reason: m.reason || m.note,
          });
      }
      break;
    }
    case 'deleteMovement': {
      assert(canManage(user.role), 'Bạn không có quyền xóa phiếu.');
      const m = db.movements.find((m) => m.id === command.id);
      assert(m && editableMovement(m), 'Chỉ được xóa phiếu chưa thực hiện.');
      checkBranch(user, m.branchId);
      assert(command.reason.trim(), 'Bắt buộc nhập lý do xóa.');
      targetId = m.id;
      m.status = 'deleted';
      m.note += `\nLý do xóa: ${command.reason}`;
      db.proposals
        .filter((p) => p.targetId === m.id && p.status === 'pending')
        .forEach((p) => {
          p.status = 'rejected';
          p.decisionReason = command.reason;
          p.decidedBy = user.name;
          p.decidedAt = now();
        });
      break;
    }
    case 'recordMovement': {
      const m = db.movements.find((m) => m.id === command.id);
      assert(m, 'Không tìm thấy phiếu.');
      checkBranch(user, m.branchId);
      targetId = m.id;
      if (m.kind === 'outbound' && command.outcome === 'incident')
        assert(command.incidentReason?.trim(), 'Bắt buộc nhập lý do sự cố.');
      assert(
        m.kind === 'inbound' ? ['receiving', 'backorder'].includes(m.status) : m.status === 'ready',
        'Phiếu chưa được phép ghi nhận hoặc đã hoàn thành.',
      );
      assert(
        command.lines.length === m.lines.length &&
          new Set(command.lines.map((l) => l.materialId)).size === m.lines.length,
        'Thiếu hoặc trùng nguyên vật liệu.',
      );
      const deltas = m.lines.map((l) => {
        const input = command.lines.find((x) => x.materialId === l.materialId);
        assert(input, 'Thiếu dữ liệu kiểm nhận.');
        const actual = input.received ?? NaN;
        const bad = m.kind === 'inbound' ? (input.defective ?? NaN) : 0;
        nonnegative(actual, 'Thực nhận/xuất');
        nonnegative(bad, 'Số lượng lỗi');
        assert(bad <= actual, 'Số lượng lỗi không được vượt thực nhận.');
        if (bad > 0) assert(input.reason?.trim(), 'Nhập lý do hàng lỗi.');
        if (m.kind === 'inbound')
          assert(
            actual <= l.quantity - (l.received ?? 0),
            'Thực nhận vượt số lượng còn phải giao.',
          );
        else {
          positive(actual, 'Thực xuất');
          assert(
            actual <= stockOf(db, m.branchId, l.materialId),
            'Thực xuất vượt tồn kho hiện tại.',
          );
        }
        return { l, input, good: actual - bad, actual, bad };
      });
      for (const { l, input, good, actual, bad } of deltas) {
        const s = stock(db, m.branchId, l.materialId);
        if (m.kind === 'inbound') {
          s.quantity += good;
          s.inbound += good;
          l.received = (l.received ?? 0) + good;
        } else {
          s.quantity -= actual;
          s.outbound += actual;
          l.received = actual;
          if (m.type === 'transfer') {
            const dest = stock(db, m.destinationId!, l.materialId);
            dest.quantity += good;
            dest.inbound += good;
          }
        }
        l.defective = (l.defective ?? 0) + bad;
        l.reason = input.reason;
      }
      m.status =
        m.kind === 'inbound' && m.lines.some((l) => (l.received ?? 0) < l.quantity)
          ? 'backorder'
          : 'completed';
      m.note += command.note ? `\n${command.note}` : '';
      m.incidentReason =
        command.outcome === 'incident' ? command.incidentReason?.trim() : undefined;
      break;
    }
    case 'decide': {
      assert(user.role === 'owner', 'Chỉ Chủ cửa hàng được phê duyệt.');
      const p = db.proposals.find((p) => p.id === command.id);
      assert(p && p.status === 'pending', 'Đề xuất không còn chờ phê duyệt.');
      assert(command.approve || command.reason.trim(), 'Vui lòng nhập lý do từ chối.');
      targetId = p.id;
      if (command.approve) {
        applyApproval(db, p, user, command.reason);
      } else if (p.kind === 'movement') {
        const m = db.movements.find((m) => m.id === p.targetId);
        if (m) m.status = 'rejected';
      }
      p.status = command.approve ? 'approved' : 'rejected';
      p.decisionReason = command.reason;
      p.decidedAt = now();
      p.decidedBy = user.name;
      if (p.kind === 'adjustment') {
        const count = db.counts.find((c) => c.id === p.targetId);
        if (count) count.handlingStatus = 'complete';
      }
      break;
    }
    case 'beginCount': {
      checkBranch(user, command.branchId);
      assert(
        db.branches.some((b) => b.id === command.branchId),
        'Chi nhánh không hợp lệ.',
      );
      db.countDrafts ??= [];
      assert(!db.countDrafts.some((d) => d.id === command.id), 'Mã phiếu đã tồn tại.');
      db.countDrafts.push({
        id: command.id,
        branchId: command.branchId,
        creatorId: user.id,
        createdAt: now(),
        lines: db.materials
          .filter((m) => m.active)
          .map((m) => ({ materialId: m.id, theoretical: stockOf(db, command.branchId, m.id) })),
      });
      targetId = command.id;
      break;
    }
    case 'cancelCount': {
      const draft = db.countDrafts?.find((d) => d.id === command.id);
      assert(draft, 'Không tìm thấy phiếu kiểm kê nháp.');
      checkBranch(user, draft.branchId);
      assert(draft.creatorId === user.id, 'Chỉ người tạo mới được hủy phiếu nháp.');
      db.countDrafts = db.countDrafts!.filter((d) => d.id !== command.id);
      targetId = command.id;
      break;
    }
    case 'count': {
      const c = command.count;
      checkBranch(user, c.branchId);
      assert(c.lines.length && c.date && c.note.trim(), 'Nhập đầy đủ thông tin kiểm kê.');
      targetId = c.id;
      assert(!db.counts.some((x) => x.id === c.id), 'Phiếu kiểm kê đã được lưu.');
      const draft = c.draftId ? db.countDrafts?.find((d) => d.id === c.draftId) : undefined;
      if (c.draftId)
        assert(
          draft && draft.creatorId === user.id && draft.branchId === c.branchId,
          'Bản nháp kiểm kê không hợp lệ.',
        );
      if (draft)
        assert(
          c.lines.length === draft.lines.length,
          'Nhập đầy đủ số đếm cho các nguyên vật liệu trong phiếu.',
        );
      assert(
        new Set(c.lines.map((l) => l.materialId)).size === c.lines.length,
        'Nguyên vật liệu kiểm kê không được trùng.',
      );
      const lines = c.lines.map((l) => {
        available(db, l.materialId);
        nonnegative(l.actual, 'Số lượng thực tế');
        const frozen = draft?.lines.find((x) => x.materialId === l.materialId);
        if (draft) assert(frozen, 'Nguyên vật liệu không thuộc phiếu đã khởi tạo.');
        return {
          ...l,
          theoretical: frozen?.theoretical ?? stockOf(db, c.branchId, l.materialId),
          reason: user.role === 'staff' ? '' : l.reason || c.reason,
          remedy: user.role === 'staff' ? '' : l.remedy || c.remedy,
        };
      });
      const adjustments = lines
        .filter((l) => Math.abs(l.actual - l.theoretical) >= 1e-6)
        .map((l) => ({
          materialId: l.materialId,
          delta: Math.round((l.actual - l.theoretical) * 1e6) / 1e6,
          theoretical: l.theoretical,
          reason: l.reason,
        }));
      if (adjustments.length && user.role !== 'staff')
        assert(
          lines
            .filter((l) => Math.abs(l.actual - l.theoretical) >= 1e-6)
            .every((l) => l.reason?.trim() && l.remedy?.trim()),
          'Có chênh lệch: cần nguyên nhân và biện pháp xử lý.',
        );
      db.counts.unshift({
        ...c,
        salesVersion: db.sales.find(
          (s) => s.branchId === c.branchId && periodsOverlap(s.period, c.period),
        )?.id,
        creator: user.name,
        handlingStatus: adjustments.length
          ? user.role === 'staff'
            ? 'pendingHandling'
            : 'pendingApproval'
          : 'complete',
        lines,
      });
      if (draft) db.countDrafts = db.countDrafts!.filter((d) => d.id !== draft.id);
      if (adjustments.length && user.role !== 'staff')
        proposal(db, user, {
          kind: 'adjustment',
          branchId: c.branchId,
          targetId: c.id,
          operation: 'update',
          reason: c.reason,
          adjustments,
        });
      break;
    }
    case 'handleCount': {
      assert(canManage(user.role), 'Chỉ Quản lý / Chủ cửa hàng được xử lý chênh lệch.');
      const c = db.counts.find((c) => c.id === command.id);
      assert(c && c.handlingStatus === 'pendingHandling', 'Phiếu không còn chờ xử lý chênh lệch.');
      checkBranch(user, c.branchId);
      targetId = c.id;
      const changed = c.lines.filter((l) => Math.abs(l.actual - l.theoretical) >= 1e-6);
      for (const l of changed) {
        const handling = command.lines.find((x) => x.materialId === l.materialId);
        assert(handling, 'Thiếu thông tin xử lý.');
        assert(
          handling.reason.trim() && handling.remedy.trim(),
          'Nhập nguyên nhân và biện pháp xử lý cho từng nguyên vật liệu chênh lệch.',
        );
        l.reason = handling.reason;
        l.remedy = handling.remedy;
      }
      c.reason = changed.map((l) => `${l.materialId}: ${l.reason}`).join('; ');
      c.remedy = changed.map((l) => `${l.materialId}: ${l.remedy}`).join('; ');
      c.handlingStatus = 'pendingApproval';
      proposal(db, user, {
        kind: 'adjustment',
        branchId: c.branchId,
        targetId: c.id,
        operation: 'update',
        reason: c.reason,
        adjustments: changed.map((l) => ({
          materialId: l.materialId,
          delta: Math.round((l.actual - l.theoretical) * 1e6) / 1e6,
          theoretical: l.theoretical,
          reason: l.reason,
        })),
      });
      break;
    }
    case 'sales': {
      assert(canManage(user.role), 'Bạn không có quyền nhập dữ liệu bán hàng.');
      const s = command.sales;
      checkBranch(user, s.branchId);
      targetId = s.id;
      assert(
        s.lines.length && /^\d{4}-(0[1-9]|1[0-2]|Q[1-4])$/.test(s.period),
        'Dữ liệu kỳ báo cáo không hợp lệ.',
      );
      assert(
        new Set(s.lines.map((l) => l.recipeId)).size === s.lines.length,
        'Mỗi mã món chỉ xuất hiện một lần.',
      );
      const consumption = new Map<string, number>();
      for (const line of s.lines) {
        nonnegative(line.quantity, 'Số lượng bán');
        const r = db.recipes.find((r) => r.id === line.recipeId && r.active);
        if (!r) continue;
        for (const l of r.lines)
          consumption.set(
            l.materialId,
            (consumption.get(l.materialId) ?? 0) + l.quantity * line.quantity,
          );
      }
      const previous = db.sales.filter(
        (x) => x.branchId === s.branchId && periodsOverlap(x.period, s.period),
      );
      assert(
        previous.length === 0 || command.replaceOverlapping,
        'Kỳ đã có dữ liệu hoặc chồng lấn tháng/quý. Cần xác nhận ghi đè trước khi lưu.',
      );
      db.sales = db.sales.filter(
        (x) => !(x.branchId === s.branchId && periodsOverlap(x.period, s.period)),
      );
      db.sales.unshift({
        ...s,
        consumption: [...consumption].map(([materialId, quantity]) => ({ materialId, quantity })),
        missingRecipeIds: s.lines
          .filter((l) => !db.recipes.some((r) => r.id === l.recipeId && r.active))
          .map((l) => l.recipeId),
      });
      break;
    }
  }
  // Owner changes take effect immediately while retaining a decision history.
  if (user.role === 'owner' && command.type !== 'decide') {
    for (const p of db.proposals.filter((p) => p.status === 'pending' && p.targetId === targetId))
      applyApproval(db, p, user, p.reason);
  }
  for (const s of db.stocks) {
    s.quantity = Math.round(s.quantity * 1e6) / 1e6;
    s.inbound = Math.round(s.inbound * 1e6) / 1e6;
    s.outbound = Math.round(s.outbound * 1e6) / 1e6;
    if (s.adjustment) s.adjustment = Math.round(s.adjustment * 1e6) / 1e6;
  }
  if (JSON.stringify(source.stocks) !== JSON.stringify(db.stocks)) {
    db.stockSnapshots = [
      ...(source.stockSnapshots ?? [{ date: now(), stocks: structuredClone(source.stocks) }]),
      { date: now(), stocks: structuredClone(db.stocks) },
    ];
  }
  const event: Audit = {
    id: newId('LOG'),
    date: now(),
    actor: user.name,
    action: command.type,
    targetId,
    before,
    after: JSON.stringify({ ...db, audit: [], stockSnapshots: [] }),
  };
  db.audit.unshift(event);
  return db;
}
