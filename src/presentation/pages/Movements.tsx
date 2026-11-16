import { useState } from 'react';
import { useApp, useScope } from '../../app/context';
import type { Line, Movement } from '../../domain/model';
import { editableMovement, stockOf } from '../../domain/rules';
import { newId } from '../../application/execute';
import {
  Badge,
  BranchSelect,
  Confirm,
  Dialog,
  Facts,
  Field,
  FormActions,
  Heading,
  IconButton,
  NonNegativeInput,
  Pager,
  Panel,
  Screen,
  Search,
  Select,
  Table,
  cancelMessage,
  dateFmt,
  fmt,
  matches,
  useScreen,
} from '../components/ui';
import { useBranchScope } from '../components/ui';

export function MovementFacts({
  movement: m,
  readOnly = false,
}: {
  movement: Movement;
  readOnly?: boolean;
}) {
  const { db } = useApp();
  useBranchScope(m.branchId);
  const inbound = m.kind === 'inbound';
  const items: [string, React.ReactNode][] = [
    ['Mã phiếu', m.id],
    ['Trạng thái', m.incidentReason ? 'Có sự cố · Đã ghi nhận' : <Badge status={m.status} />],
    ['Chi nhánh', db!.branches.find((b) => b.id === m.branchId)?.name],
    [
      inbound ? 'Nhà cung cấp' : 'Loại xuất kho',
      inbound ? m.supplier : m.type === 'internal' ? 'Xuất sử dụng nội bộ' : 'Xuất điều chuyển',
    ],
  ];
  if (!inbound) items.push(['Lý do xuất', m.reason]);
  items.push(['Ngày lập', dateFmt(m.date)]);
  if (inbound) items.push(['Ngày dự kiến nhận', dateFmt(m.expectedDate)]);
  items.push(['Người lập', m.creator]);
  // if (m.destinationId)
  //   items.push(['Chi nhánh nhận', db!.branches.find((b) => b.id === m.destinationId)?.name]);
  return (
    <Panel title={`Thông tin phiếu${readOnly ? '' : ''}`}>
      <Facts items={items} />
    </Panel>
  );
}
export function Movements({ kind }: { kind: Movement['kind'] }) {
  const { db, user, run } = useApp();
  const { allowed, role } = useScope();
  const view = useScreen();
  const inbound = kind === 'inbound';
  const [branch, setBranch] = useState(role === 'owner' ? 'all' : user!.branchId),
    [status, setStatus] = useState('all'),
    [type, setType] = useState('all'),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(1),
    [remove, setRemove] = useState<Movement | null>(null);
  const selected = db!.movements.find(
    (m) => m.id === view.id && m.kind === kind && allowed(m.branchId),
  );
  if (view.screen === 'create' && role !== 'staff')
    return <MovementForm key="new" kind={kind} onClose={view.close} />;
  if (selected && view.screen === 'edit' && role !== 'staff' && editableMovement(selected))
    return <MovementForm key={selected.id} kind={kind} value={selected} onClose={view.close} />;
  if (selected && view.screen === 'record')
    return <RecordForm key={selected.id} movement={selected} onClose={view.close} />;
  if (selected && view.screen === 'detail')
    return (
      <MovementDetail
        movement={selected}
        onClose={view.close}
        onRecord={() => view.open('record', selected.id)}
      />
    );
  const rows = db!.movements
    .filter(
      (m) =>
        m.kind === kind &&
        allowed(m.branchId) &&
        (branch === 'all' || m.branchId === branch) &&
        (status === 'all' || (status === 'incident' ? !!m.incidentReason : m.status === status)) &&
        (type === 'all' || m.type === type) &&
        matches(query, m.id, m.supplier, m.creator),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className={`movement-list ${kind}`}>
      <Heading title={`Quản lý ${inbound ? 'nhập' : 'xuất'} kho`}>
        {(!inbound || role !== 'staff') && (
          <button
            className="primary"
            disabled={role === 'staff'}
            onClick={() => view.open('create')}
          >
            + Tạo phiếu {inbound ? 'nhập' : 'xuất'} kho
          </button>
        )}
      </Heading>
      <div className="filters">
        <BranchSelect
          value={branch}
          onChange={(v) => {
            setBranch(v);
            setPage(1);
          }}
        />
        {!inbound && (
          <Select
            aria-label="Loại xuất"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Loại xuất: Tất cả</option>
            <option value="internal">Sử dụng nội bộ</option>
            <option value="transfer">Điều chuyển</option>
          </Select>
        )}
        <Select
          aria-label="Trạng thái"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Trạng thái: Tất cả</option>
          <option value="pending">Chờ phê duyệt</option>
          <option value={inbound ? 'receiving' : 'ready'}>
            {inbound ? 'Chờ kiểm hàng' : 'Chờ xuất kho'}
          </option>
          {inbound && <option value="backorder">Chờ giao bù</option>}
          <option value="completed">Hoàn thành</option>
          {!inbound && <option value="incident">Có sự cố</option>}
          <option value="rejected">Từ chối</option>
          <option value="deleted">Đã xóa</option>
        </Select>
        <Search
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
        />
      </div>
      <Table
        headers={[
          'Mã phiếu',
          'Chi nhánh',
          inbound ? 'Nhà cung cấp' : 'Loại xuất',
          ...(!inbound ? ['Lý do xuất'] : []),
          'Số mặt hàng',
          'Ngày lập',
          ...(inbound ? ['Dự kiến nhận'] : []),
          'Người lập',
          'Trạng thái',
          ...(!inbound || role !== 'staff' ? ['Thao tác'] : []),
        ]}
        empty={!rows.length}
        emptySubject="phiếu xuất kho"
      >
        {rows.slice((page - 1) * 10, page * 10).map((m) => (
          <tr key={m.id} className="clickable-row" onClick={() => view.open('detail', m.id)}>
            <td>
              <button
                className="text-button"
                onClick={(e) => {
                  e.stopPropagation();
                  view.open('detail', m.id);
                }}
              >
                {m.id}
              </button>
            </td>
            <td>{db!.branches.find((b) => b.id === m.branchId)?.name}</td>
            <td>
              {inbound ? m.supplier : m.type === 'internal' ? 'Sử dụng nội bộ' : 'Điều chuyển'}
            </td>
            {!inbound && <td>{m.reason}</td>}
            <td>{m.lines.length}</td>
            <td>{dateFmt(m.date)}</td>
            {inbound && <td>{dateFmt(m.expectedDate)}</td>}
            <td>{m.creator}</td>
            <td>
              <Badge status={m.incidentReason ? 'incident' : m.status} />
            </td>
            {(!inbound || role !== 'staff') && (
              <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                <IconButton
                  type="edit"
                  disabled={role === 'staff' || !editableMovement(m)}
                  onClick={() => view.open('edit', m.id)}
                />
                <IconButton
                  type="trash"
                  disabled={role === 'staff' || !editableMovement(m)}
                  onClick={() => setRemove(m)}
                />
              </td>
            )}
          </tr>
        ))}
      </Table>
      <Pager page={page} total={rows.length} onChange={setPage} />
      {remove && (
        <Confirm
          title=''
          message={`Bạn có chắc chắn muốn xoá phiếu ${inbound ? 'nhập' : 'xuất'} này? Vui lòng nhập lý do để tiếp tục.`}
          reasonRequired
          reasonLabel="Lý do xóa *"
          confirmLabel="Xóa phiếu"
          cancelLabel="Hủy"
          onClose={() => setRemove(null)}
          onConfirm={async (reason) => {
            if (
              await run(
                { type: 'deleteMovement', id: remove.id, reason },
                `Xóa phiếu ${inbound ? 'nhập' : 'xuất'} kho thành công!`,
              )
            )
              setRemove(null);
          }}
        />
      )}
    </div>
  );
}
function MovementDetail({
  movement: m,
  onClose,
  onRecord,
}: {
  movement: Movement;
  onClose: () => void;
  onRecord: () => void;
}) {
  const { db } = useApp();
  const inbound = m.kind === 'inbound';
  const canRecord = inbound ? ['receiving', 'backorder'].includes(m.status) : m.status === 'ready';
  return (
    <Screen
      title={`Chi tiết phiếu ${inbound ? 'nhập' : 'xuất'} kho`}
      onBack={onClose}
      className={inbound ? 'inbound-detail' : 'outbound-detail'}
    >
      <MovementFacts movement={m} />
      <Panel title={inbound ? 'Chi tiết nguyên vật liệu' : 'Nguyên vật liệu xuất kho'}>
        <Table
          headers={[
            'Mã NVL',
            'Tên nguyên vật liệu',
            'Đơn vị',
            ...(inbound
              ? ['Số lượng đặt', 'Thực nhận', 'Số lượng lỗi', 'Lý do lỗi']
              : ['Tồn khả dụng', 'Xuất dự kiến *']),
          ]}
        >
          {m.lines.map((l) => (
            <tr key={l.materialId}>
              <td>{l.materialId}</td>
              <td>{db!.materials.find((x) => x.id === l.materialId)?.name}</td>
              <td>{db!.materials.find((x) => x.id === l.materialId)?.unit}</td>
              {inbound ? (
                <>
                  <td>{fmt(l.quantity)}</td>
                  <td>
                    {l.received === undefined
                      ? 'Chưa nhận'
                      : fmt((l.received ?? 0) + (l.defective ?? 0))}
                  </td>
                  <td>{l.defective === undefined ? '—' : fmt(l.defective)}</td>
                  <td>{l.reason || '—'}</td>
                </>
              ) : (
                <>
                  <td>{fmt(stockOf(db!, m.branchId, l.materialId))}</td>
                  <td>{fmt(l.quantity)}</td>
                </>
              )}
            </tr>
          ))}
        </Table>
      </Panel>
      {m.incidentReason && (
        <Panel title="Lý do sự cố">
          <p>{m.incidentReason}</p>
        </Panel>
      )}
      {canRecord && (
        <div className="form-actions">
          <button className="primary" onClick={onRecord}>
            {inbound ? 'Ghi nhận nhập kho' : 'Xác nhận xuất kho'}
          </button>
        </div>
      )}
    </Screen>
  );
}
function MovementForm({
  kind,
  value,
  onClose,
}: {
  kind: Movement['kind'];
  value?: Movement;
  onClose: () => void;
}) {
  const { db, user, run } = useApp();
  const [m, setM] = useState<Movement>(() =>
    value
      ? structuredClone(value)
      : {
          id: newId(kind === 'inbound' ? 'PNK' : 'PXK'),
          kind,
          branchId: user!.branchId,
          supplier: '',
          type: 'internal',
          reason: '',
          note: '',
          date: new Date().toISOString(),
          expectedDate: '',
          creator: user!.name,
          status: 'pending',
          lines: [],
        },
  );
  const [dirty, setDirty] = useState(false),
    [cancel, setCancel] = useState(false),
    [picker, setPicker] = useState(false),
    [selected, setSelected] = useState(''),
    [error, setError] = useState('');
  const inbound = kind === 'inbound';
  const editing = !!value;
  const change = (patch: Partial<Movement>) => {
    setDirty(true);
    setError('');
    setM((v) => ({ ...v, ...patch }));
  };
  const close = () => (dirty ? setCancel(true) : onClose());
  const valid =
    m.lines.length > 0 &&
    m.lines.every(
      (l) =>
        Number.isFinite(l.quantity) &&
        l.quantity > 0 &&
        (inbound || l.quantity <= stockOf(db!, m.branchId, l.materialId)),
    ) &&
    !!(inbound ? m.supplier.trim() && m.expectedDate : m.reason.trim() && m.note.trim()) &&
    (m.type !== 'transfer' || !!m.destinationId);
  return (
    <Screen
      title={`${editing ? 'Sửa' : 'Tạo'} phiếu ${inbound ? 'nhập' : 'xuất'} kho`}
      onBack={close}
      className={inbound ? 'inbound-form' : 'outbound-form'}
    >
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) {
            setError('Định dạng dữ liệu không hợp lệ. Vui lòng kiểm tra và nhập lại!');
            return;
          }
          if (
            await run(
              { type: 'saveMovement', movement: m, editing },
              `${editing ? 'Sửa' : 'Tạo'} phiếu ${inbound ? 'nhập' : 'xuất'} kho thành công!${user!.role !== 'owner' && (inbound || m.type === 'transfer') ? ' Vui lòng chờ phê duyệt!' : ''}`,
            )
          )
            onClose();
          else setError('Thông tin nhập vào không hợp lệ. Vui lòng kiểm tra và thử lại!');
        }}
      >
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <Panel title="Thông tin chung">
          <div className="form-grid three">
            <Field label="Chi nhánh *">
              <BranchSelect
                value={m.branchId}
                all={false}
                disabled={editing || user!.role !== 'owner'}
                onChange={(v) => change({ branchId: v })}
              />
            </Field>
            {inbound ? (
              <>
                <Field label="Nhà cung cấp *">
                  <Select value={m.supplier} onChange={(e) => change({ supplier: e.target.value })}>
                    <option value="">Chọn nhà cung cấp</option>
                    {[...new Set(db!.materials.map((x) => x.supplier))].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Ngày dự kiến nhận *">
                  <input
                    type="date"
                    value={m.expectedDate}
                    onChange={(e) => change({ expectedDate: e.target.value })}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Loại xuất kho *">
                  <Select
                    value={m.type}
                    disabled={editing}
                    onChange={(e) => change({ type: e.target.value as Movement['type'] })}
                  >
                    <option value="internal">Sử dụng nội bộ</option>
                    <option value="transfer">Điều chuyển</option>
                  </Select>
                </Field>
                <Field label="Lý do xuất kho *">
                  <input value={m.reason} onChange={(e) => change({ reason: e.target.value })} />
                </Field>
                {m.type === 'transfer' && (
                  <Field label="Chi nhánh nhận *">
                    <Select
                      value={m.destinationId || ''}
                      onChange={(e) => change({ destinationId: e.target.value })}
                    >
                      <option value="">Chọn chi nhánh nhận</option>
                      {db!.branches
                        .filter((b) => b.id !== m.branchId)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                    </Select>
                  </Field>
                )}
              </>
            )}
          </div>
        </Panel>
        <Panel
          title={inbound ? 'Nguyên vật liệu dự kiến nhập' : 'Nguyên vật liệu xuất kho'}
          action={
            <button type="button" onClick={() => setPicker(true)}>
              + Thêm nguyên vật liệu
            </button>
          }
        >
          <Table
            headers={[
              'Mã NVL',
              'Tên nguyên vật liệu',
              'Đơn vị',
              ...(!inbound ? ['Tồn khả dụng'] : []),
              inbound ? 'Số lượng đặt *' : 'Xuất dự kiến *'
            ]}
            empty={!m.lines.length}
            emptySubject="nguyên vật liệu"
          >
            {m.lines.map((l) => (
              <tr key={l.materialId}>
                <td>{l.materialId}</td>
                <td>{db!.materials.find((x) => x.id === l.materialId)?.name}</td>
                <td>{db!.materials.find((x) => x.id === l.materialId)?.unit}</td>
                {!inbound && <td>{fmt(stockOf(db!, m.branchId, l.materialId))}</td>}
                <td>
                  <NonNegativeInput
                    aria-label={`Số lượng ${db!.materials.find((x) => x.id === l.materialId)?.name}`}
                    min="0.000001"
                    step="any"
                    value={Number.isFinite(l.quantity) ? l.quantity : ''}
                    onChange={(e) =>
                      change({
                        lines: m.lines.map((x) =>
                          x.materialId === l.materialId
                            ? { ...x, quantity: e.target.valueAsNumber }
                            : x,
                        ),
                      })
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      change({ lines: m.lines.filter((x) => x.materialId !== l.materialId) })
                    }
                  >
                    {/* × Bỏ */}
                  </button>
                </td>
              </tr>
            ))}
          </Table>
          <Field label={inbound ? 'Ghi chú' : 'Ghi chú *'}>
            <input value={m.note} onChange={(e) => change({ note: e.target.value })} />
          </Field>
        </Panel>
        <FormActions onCancel={close} disabled={!valid} />
      </form>
      {picker && (
        <Dialog
          title="Thêm nguyên vật liệu"
          onClose={() => setPicker(false)}
          className="picker-dialog"
        >
          <Field label="Nguyên vật liệu">
            <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Chọn nguyên vật liệu</option>
              {db!.materials
                .filter((x) => x.active && !m.lines.some((l) => l.materialId === x.id))
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.id} · {x.name}
                  </option>
                ))}
            </Select>
          </Field>
          <div className="form-actions">
            <button onClick={() => setPicker(false)}>Hủy</button>
            <button
              className="primary"
              disabled={!selected}
              onClick={() => {
                change({ lines: [...m.lines, { materialId: selected, quantity: 1 }] });
                setSelected('');
                setPicker(false);
              }}
            >
              Thêm
            </button>
          </div>
        </Dialog>
      )}
      {cancel && (
        <Confirm
          title=""
          message={cancelMessage}
          onClose={() => setCancel(false)}
          onConfirm={onClose}
        />
      )}
    </Screen>
  );
}
function RecordForm({ movement: m, onClose }: { movement: Movement; onClose: () => void }) {
  const { db, run } = useApp();
  const inbound = m.kind === 'inbound';
  const [lines, setLines] = useState<Line[]>(
    m.lines.map((l) => ({
      materialId: l.materialId,
      quantity: l.quantity,
      received: undefined,
      defective: inbound ? undefined : 0,
      reason: '',
    })),
  );
  const [outcome, setOutcome] = useState<'normal' | 'incident'>('normal'),
    [incidentReason, setIncidentReason] = useState(''),
    [error, setError] = useState('');
  const change = (id: string, patch: Partial<Line>) => {
    setError('');
    setLines((v) => v.map((l) => (l.materialId === id ? { ...l, ...patch } : l)));
  };
  const valid =
    lines.every((l) => {
      const actual = l.received ?? NaN,
        bad = l.defective ?? NaN;
      const old = m.lines.find((x) => x.materialId === l.materialId)!;
      return (
        Number.isFinite(actual) &&
        Number.isFinite(bad) &&
        actual >= (inbound ? 0 : 0.000001) &&
        bad >= 0 &&
        bad <= actual &&
        (!bad || !!l.reason?.trim()) &&
        actual <=
          (inbound ? old.quantity - (old.received ?? 0) : stockOf(db!, m.branchId, l.materialId))
      );
    }) &&
    (outcome !== 'incident' || !!incidentReason.trim());
  const permitted = inbound ? ['receiving', 'backorder'].includes(m.status) : m.status === 'ready';
  return (
    <Screen
      title={inbound ? 'Ghi nhận nhập kho' : 'Xác nhận xuất kho'}
      onBack={onClose}
      className={inbound ? 'receipt-screen' : 'dispatch-screen'}
    >
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) return;
          if (
            await run(
              { type: 'recordMovement', id: m.id, lines, note: '', outcome, incidentReason },
              `Ghi nhận trạng thái ${inbound ? 'nhập' : 'xuất'} kho thành công!`,
            )
          )
            onClose();
          else setError('Thông tin nhập vào không hợp lệ. Vui lòng kiểm tra và thử lại!');
        }}
      >
        {error && (
          <p role="alert" className="inline-error">
            {error}
          </p>
        )}
        <MovementFacts movement={m} readOnly={inbound} />
        <Panel title={inbound ? 'Kết quả kiểm nhận' : 'Thông tin xuất kho'}>
          {m.status === 'backorder' && (
            <p className="caption">
              Nhập số nhận thêm của đợt giao bù; số lượng đặt bên dưới là phần còn thiếu.
            </p>
          )}
          <Table
            headers={[
              'Mã / Tên NVL',
              'Đơn vị',
              ...(inbound
                ? ['Số lượng đặt', 'Thực nhận *', 'Số lượng lỗi *', 'Lý do lỗi']
                : ['Tồn khả dụng', 'Xuất dự kiến *', 'Thực xuất *']),
            ]}
          >
            {lines.map((l) => {
              const mat = db!.materials.find((x) => x.id === l.materialId)!;
              const original = m.lines.find((x) => x.materialId === l.materialId)!;
              return (
                <tr key={l.materialId}>
                  <td>
                    {l.materialId} · {mat.name}
                  </td>
                  <td>{mat.unit}</td>
                  {inbound ? (
                    <td>{fmt(original.quantity - (original.received ?? 0))}</td>
                  ) : (
                    <>
                      <td>{fmt(stockOf(db!, m.branchId, l.materialId))}</td>
                      <td>{fmt(original.quantity)}</td>
                    </>
                  )}
                  <td>
                    <NonNegativeInput
                      aria-label={`${inbound ? 'Thực nhận' : 'Thực xuất'} ${mat.name}`}
                      step="any"
                      min={inbound ? 0 : 0.000001}
                      value={Number.isFinite(l.received) ? l.received : ''}
                      onChange={(e) => change(l.materialId, { received: e.target.valueAsNumber })}
                    />
                  </td>
                  {inbound && (
                    <>
                      <td>
                        <NonNegativeInput
                          aria-label={`Số lượng lỗi ${mat.name}`}
                          min="0"
                          step="any"
                          value={Number.isFinite(l.defective) ? l.defective : ''}
                          onChange={(e) =>
                            change(l.materialId, { defective: e.target.valueAsNumber })
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Lý do lỗi ${mat.name}`}
                          placeholder="Không phát sinh"
                          value={l.reason}
                          onChange={(e) => change(l.materialId, { reason: e.target.value })}
                        />
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </Table>
          {inbound && valid && (
            <p className="caption">
              Dự kiến:{' '}
              <Badge
                status={
                  lines.some((l) => {
                    const old = m.lines.find((x) => x.materialId === l.materialId)!;
                    return (
                      (old.received ?? 0) + (l.received ?? 0) - (l.defective ?? 0) < old.quantity
                    );
                  })
                    ? 'backorder'
                    : 'completed'
                }
              />
            </p>
          )}
          {!inbound && (
            <>
              <label className="dispatch-status">
                Trạng thái{' '}
                <Select
                  aria-label="Trạng thái xử lý"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as typeof outcome)}
                >
                  <option value="normal">Bình thường</option>
                  <option value="incident">Có sự cố</option>
                </Select>
              </label>
              {outcome === 'incident' && (
                <Field label="Lý do sự cố *">
                  <textarea
                    aria-invalid={!incidentReason.trim()}
                    value={incidentReason}
                    onChange={(e) => setIncidentReason(e.target.value)}
                  />
                  {!incidentReason.trim() && (
                    <small className="field-error">Bắt buộc nhập lý do sự cố</small>
                  )}
                </Field>
              )}
            </>
          )}
        </Panel>
        <FormActions onCancel={onClose} disabled={!valid || !permitted} />
      </form>
    </Screen>
  );
}
