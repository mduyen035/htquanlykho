import { useState } from 'react';
import { useApp, useScope } from '../../app/context';
import { isMock } from '../../app/container';
import type { Material } from '../../domain/model';
import { nextCode } from '../../application/execute';
import { stockOf } from '../../domain/rules';
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
  fmt,
  matches,
  useScreen,
} from '../components/ui';
import { useBranchScope } from '../components/ui';
export function Materials() {
  const { db, user, run } = useApp();
  const { role } = useScope();
  const view = useScreen();
  const [branch, setBranch] = useState(
      role === 'owner' ? view.branch || user!.branchId : user!.branchId,
    ),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState<Material | null>(null),
    [remove, setRemove] = useState<Material | null>(null);
  const candidates = [
    ...db!.materials.map((m) => ({ ...m, pending: false })),
    ...db!.proposals
      .filter(
        (p) =>
          p.kind === 'material' &&
          p.operation === 'create' &&
          p.status === 'pending' &&
          p.branchId === branch &&
          p.material &&
          !db!.materials.some((m) => m.id === p.targetId),
      )
      .map((p) => ({ ...p.material!, pending: true })),
  ];
  useBranchScope(branch);
  const selected = candidates.find((m) => m.id === view.id);
  const rows = candidates.filter(
    (m) =>
      matches(query, m.id, m.name) && (filter === 'all' ? m.active || m.pending : filter === m.id),
  );
  if (view.screen === 'detail' && selected)
    return (
      <Screen title="Chi tiết nguyên vật liệu" onBack={view.close}>
        <Panel title="Thông tin chung">
          <Facts
            items={[
              ['Mã nguyên vật liệu', selected.id],
              ['Tên nguyên vật liệu', selected.name],
              ['Đơn vị', selected.unit],
              [
                'Trạng thái',
                selected.pending
                  ? 'Chờ phê duyệt'
                  : selected.active
                    ? 'Đang sử dụng'
                    : 'Ngừng sử dụng',
              ],
              ['Nhà cung cấp', selected.supplier],
              ['Mô tả', selected.description || '—'],
            ]}
          />
        </Panel>
        {role !== 'staff' && (
          <Panel title="Tồn kho theo chi nhánh">
            <Table headers={['Chi nhánh', 'Tồn kho', 'Định mức tối thiểu', 'Trạng thái']}>
              <tr>
                <td>{db!.branches.find((b) => b.id === branch)?.name}</td>
                <td>
                  {fmt(stockOf(db!, branch, selected.id))} {selected.unit}
                </td>
                <td>
                  {fmt(selected.minimum)} {selected.unit}
                </td>
                <td>
                  <Badge
                    status={selected.pending ? 'pending' : undefined}
                    text={
                      selected.pending
                        ? 'Chờ phê duyệt'
                        : !selected.active
                          ? 'Ngừng sử dụng'
                          : stockOf(db!, branch, selected.id) < selected.minimum
                            ? 'Dưới mức tối thiểu'
                            : 'Đang sử dụng'
                    }
                  />
                </td>
              </tr>
            </Table>
          </Panel>
        )}
      </Screen>
    );
  return (
    <div className="materials-list">
      <Heading title="Nguyên vật liệu">
        {role !== 'staff' && (
          <button
            className="primary"
            onClick={() =>
              setEdit({
                id: nextCode(
                  'NVL',
                  [...db!.materials.map((m) => m.id), ...db!.proposals.map((p) => p.targetId)],
                  3,
                ),
                name: '',
                unit: '',
                minimum: 0,
                allowance: 0,
                supplier: '',
                active: true,
                price: 0,
              })
            }
          >
            + Thêm nguyên vật liệu
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
          all={false}
        />
        <Select
          aria-label="Nguyên vật liệu"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Nguyên vật liệu: Tất cả</option>
          {candidates.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
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
          'Mã NVL',
          'Tên nguyên vật liệu',
          'Đơn vị',
          ...(role !== 'staff' ? ['Tồn kho', 'Định mức tối thiểu'] : []),
          'Trạng thái',
          ...(role !== 'staff' ? ['Thao tác'] : []),
        ]}
        empty={!rows.length}
        emptySubject="nguyên vật liệu"
      >
        {rows.slice((page - 1) * 10, page * 10).map((m) => (
          <tr
            key={m.id}
            className="clickable-row"
            onClick={() => view.open('detail', m.id, { branch })}
          >
            <td>
              <button
                className="text-button"
                onClick={(e) => {
                  e.stopPropagation();
                  view.open('detail', m.id, { branch });
                }}
              >
                {m.id}
              </button>
            </td>
            <td>{m.name}</td>
            <td>{m.unit}</td>
            {role !== 'staff' && (
              <>
                <td>{fmt(stockOf(db!, branch, m.id))}</td>
                <td>{fmt(m.minimum)}</td>
              </>
            )}
            <td>
              <Badge
                status={m.pending ? 'pending' : undefined}
                text={
                  m.pending
                    ? 'Chờ phê duyệt'
                    : !m.active
                      ? 'Ngừng sử dụng'
                      : stockOf(db!, branch, m.id) < m.minimum
                        ? 'Dưới mức tối thiểu'
                        : 'Đang sử dụng'
                }
              />
            </td>
            {role !== 'staff' && (
              <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                <IconButton
                  type="edit"
                  disabled={!m.active || m.pending}
                  onClick={() => setEdit(m)}
                />
                <IconButton
                  type="trash"
                  disabled={
                    !m.active ||
                    m.pending ||
                    db!.stocks.some((s) => s.materialId === m.id && s.quantity > 0)
                  }
                  onClick={() => setRemove(m)}
                />
              </td>
            )}
          </tr>
        ))}
      </Table>
      <Pager page={page} total={rows.length} onChange={setPage} />
      {edit && <MaterialForm material={edit} onClose={() => setEdit(null)} />}
      {remove && (
        <Confirm
          title="Xóa nguyên vật liệu"
          message={`Bạn có chắc chắn muốn xóa/ngừng sử dụng nguyên vật liệu ${remove.id} · ${remove.name}?`}
          onClose={() => setRemove(null)}
          confirmLabel="Xác nhận"
          cancelLabel="Hủy"
          reasonRequired
          reasonLabel="Lý do xóa *"
          onConfirm={async (reason) => {
            if (
              await run(
                { type: 'saveMaterial', material: remove, operation: 'delete', reason },
                user!.role === 'owner'
                  ? 'Xóa nguyên vật liệu thành công.'
                  : 'Đã gửi đề xuất xóa nguyên vật liệu. Vui lòng chờ phê duyệt!',
              )
            )
              setRemove(null);
          }}
        />
      )}
    </div>
  );
}
function MaterialForm({ material, onClose }: { material: Material; onClose: () => void }) {
  const { db, user, run } = useApp();
  const [value, setValue] = useState(material),
    [dirty, setDirty] = useState(false),
    [cancel, setCancel] = useState(false),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState('');
  const editing = db!.materials.some((m) => m.id === material.id);
  const set = (key: keyof Material, v: string | number) => {
    setDirty(true);
    setError('');
    setValue((prev) => ({ ...prev, [key]: v }));
  };
  const close = () => (dirty ? setCancel(true) : onClose());
  const valid =
    !!(value.name.trim() && value.unit.trim() && value.supplier.trim()) &&
    Number.isInteger(value.minimum) &&
    value.minimum >= 0;
  async function save() {
    if (
      await run(
        { type: 'saveMaterial', material: value, operation: editing ? 'update' : 'create' },
        `${editing ? 'Sửa' : 'Thêm'} nguyên vật liệu thành công.${user!.role === 'owner' ? '' : ' Vui lòng chờ phê duyệt!'}`,
      )
    )
      onClose();
    else {
      setConfirm(false);
      setError(
        'Thông tin không hợp lệ hoặc trùng tên nguyên vật liệu. Vui lòng kiểm tra và nhập lại!',
      );
    }
  }
  return (
    <Dialog
      title={editing ? 'Sửa nguyên vật liệu' : 'Thêm nguyên vật liệu'}
      onClose={close}
      className={`material-dialog ${editing ? 'material-edit' : 'material-create'}`}
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          if (editing) setConfirm(true);
          else void save();
        }}
      >
        {error && (
          <p role="alert" className="inline-error">
            {error}
          </p>
        )}
        <div className="form-grid">
          <Field label={editing ? 'Mã NVL' : 'Mã nguyên vật liệu'}>
            <input value={editing || isMock ? value.id : 'Tự động cấp khi lưu'} disabled />
          </Field>
          {editing ? (
            <Field label="Trạng thái đề xuất">
              <input disabled value={user!.role === 'owner' ? 'Đang sử dụng' : 'Chờ phê duyệt'} />
            </Field>
          ) : (
            <Field label="Định mức *">
              <NonNegativeInput
                min="0"
                step="any"
                value={Number.isFinite(value.minimum) ? value.minimum : ''}
                placeholder="Nhập định mức"
                onChange={(e) => set('minimum', e.target.valueAsNumber)}
              />
            </Field>
          )}
          <div className={editing ? 'span-two' : ''}>
            <Field label="Tên nguyên vật liệu *">
              <input
                autoFocus
                value={value.name}
                placeholder="Nhập tên nguyên vật liệu"
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>
          </div>
          {!editing && (
            <Field label="Nhà cung cấp *">
              <input
                value={value.supplier}
                placeholder="Nhập nhà cung cấp"
                onChange={(e) => set('supplier', e.target.value)}
              />
            </Field>
          )}
          <Field label="Đơn vị *">
            <input
              value={value.unit}
              placeholder="Nhập đơn vị"
              onChange={(e) => set('unit', e.target.value)}
            />
          </Field>
          {editing ? (
            <Field label="Định mức tối thiểu *">
              <NonNegativeInput
                min="0"
                step="any"
                value={Number.isFinite(value.minimum) ? value.minimum : ''}
                onChange={(e) => set('minimum', e.target.valueAsNumber)}
              />
            </Field>
          ) : (
            <Field label="Trạng thái">
              <input disabled value={user!.role === 'owner' ? 'Đang sử dụng' : 'Chờ phê duyệt'} />
            </Field>
          )}
          {editing && (
            <div className="span-two">
              <Field label="Nhà cung cấp *">
                <input value={value.supplier} onChange={(e) => set('supplier', e.target.value)} />
              </Field>
            </div>
          )}
        </div>
        {/* {user!.role === 'owner' && (
          <details className="optional-settings">
            <summary>Định mức hao hụt cho phép</summary>
            <Field label={`Hao hụt cho phép / kỳ (${value.unit || 'đơn vị NVL'})`}>
              <input
                type="number"
                min="0"
                step="any"
                value={value.allowance}
                onChange={(e) => set('allowance', e.target.valueAsNumber)}
              />
            </Field>
          </details>
        )} */}
        <FormActions onCancel={close} disabled={!valid} />
      </form>
      {cancel && (
        <Confirm
          title="Xác nhận hủy"
          message={cancelMessage}
          onClose={() => setCancel(false)}
          onConfirm={onClose}
        />
      )}{' '}
      {confirm && (
        <Confirm
          title="Xác nhận lưu thay đổi"
          message="Bạn có chắc chắn muốn lưu thay đổi nguyên vật liệu?"
          onClose={() => setConfirm(false)}
          onConfirm={() => void save()}
        />
      )}
    </Dialog>
  );
}
