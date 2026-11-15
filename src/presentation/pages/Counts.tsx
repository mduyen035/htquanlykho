import { useState } from 'react';
import { useApp, useScope } from '../../app/context';
import type { Count, CountDraft } from '../../domain/model';
import { newId } from '../../application/execute';
import {
  Badge,
  NonNegativeInput,
  BranchSelect,
  Confirm,
  Facts,
  Field,
  FormActions,
  Heading,
  Panel,
  Screen,
  Select,
  Table,
  cancelMessage,
  dateFmt,
  dateTimeFmt,
  fmt,
  useScreen,
} from '../components/ui';
import { useBranchScope } from '../components/ui';
const localNow = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
export function Counts() {
  const { db, user, run, busy } = useApp();
  const { role, allowed } = useScope();
  const view = useScreen();
  const [branch, setBranch] = useState(role === 'owner' ? 'all' : user!.branchId),
    [from, setFrom] = useState('2026-10-01'),
    [to, setTo] = useState(localNow().slice(0, 10));
  async function create(branchId = user!.branchId) {
    const id = newId('PKK');
    if (await run({ type: 'beginCount', id, branchId }, '')) view.open('create', id);
  }
  const draft = db!.countDrafts?.find(
    (d) => d.id === view.id && d.creatorId === user!.id && allowed(d.branchId),
  );
  const detail = db!.counts.find((c) => c.id === view.id && allowed(c.branchId));
  if (view.screen === 'create' && draft)
    return <CountForm key={draft.id} draft={draft} onClose={view.close} onBranch={create} />;
  if (view.screen === 'detail' && detail)
    return <CountDetail count={detail} onClose={view.close} />;
  const rows = db!.counts
    .filter(
      (c) =>
        allowed(c.branchId) &&
        (branch === 'all' || branch === c.branchId) &&
        c.date.slice(0, 10) >= from &&
        c.date.slice(0, 10) <= to,
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <Heading title="Kiểm kê định kỳ">
        <button
          className="primary"
          disabled={busy}
          onClick={() => void create(branch === 'all' ? user!.branchId : branch)}
        >
          + Tạo phiếu kiểm kê
        </button>
      </Heading>
      <div className="filters">
        <BranchSelect value={branch} onChange={setBranch} />
        <input
          type="date"
          aria-label="Từ ngày"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          type="date"
          aria-label="Đến ngày"
          value={to}
          min={from}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      <Table
        headers={[
          'Mã phiếu',
          'Chi nhánh',
          'Ngày kiểm kê',
          'Người lập',
          'Số chênh lệch',
          'Trạng thái xử lý',
          'Ghi chú',
        ]}
        empty={!rows.length}
        emptySubject="phiếu kiểm kê"
      >
        {rows.map((c) => {
          const pending =
            c.handlingStatus === 'pendingHandling' ||
            db!.proposals.some((p) => p.targetId === c.id && p.status === 'pending');
          return (
            <tr key={c.id} className="clickable-row" onClick={() => view.open('detail', c.id)}>
              <td>
                <button
                  className="text-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    view.open('detail', c.id);
                  }}
                >
                  {c.id}
                </button>
              </td>
              <td>{db!.branches.find((b) => b.id === c.branchId)?.name}</td>
              <td>{dateFmt(c.date)}</td>
              <td>{c.creator}</td>
              <td>
                {c.lines.filter((l) => Math.abs(l.actual - l.theoretical) >= 1e-6).length} mặt hàng
              </td>
              <td>
                <Badge
                  status={pending ? 'receiving' : 'completed'}
                  text={pending ? 'Chờ xử lý' : 'Đã ghi nhận'}
                />
              </td>
              <td>{c.note}</td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
function CountDetail({ count: c, onClose }: { count: Count; onClose: () => void }) {
  const { db, user, run } = useApp();
  useBranchScope(c.branchId);
  const staff = user!.role === 'staff';
  const changed = c.lines.filter((l) => Math.abs(l.actual - l.theoretical) >= 1e-6);
  const pending = db!.proposals.find((p) => p.targetId === c.id);
  const [handling, setHandling] = useState<Record<string, { reason: string; remedy: string }>>({});
  const event = db!.audit.find((a) => a.targetId === c.id && a.action === 'count');
  return (
    <Screen title="Chi tiết phiếu kiểm kê" onBack={onClose} backFirst>
      <Panel title="Thông tin chung">
        <Facts
          items={[
            ['Mã phiếu', c.id],
            ['Chi nhánh', db!.branches.find((b) => b.id === c.branchId)?.name],
            ['Loại kiểm kê', c.note || 'Định kỳ cuối ca'],
            ['Thời gian kiểm kê', dateTimeFmt(c.date)],
            ['Người lập phiếu', c.creator],
            [
              'Trạng thái phiếu',
              c.handlingStatus === 'pendingHandling' || pending?.status === 'pending'
                ? 'Chờ xử lý'
                : 'Đã ghi nhận',
            ],
          ]}
        />
      </Panel>
      <Panel title="Thông tin kiểm kê">
        <Table
          headers={['Mã NVL', 'Nguyên vật liệu', 'Đơn vị', 'Tồn hệ thống', 'Thực tế', 'Chênh lệch']}
        >
          {c.lines.map((l) => (
            <tr key={l.materialId}>
              <td>{l.materialId}</td>
              <td>{db!.materials.find((m) => m.id === l.materialId)?.name}</td>
              <td>{db!.materials.find((m) => m.id === l.materialId)?.unit}</td>
              <td>{fmt(l.theoretical)}</td>
              <td>{fmt(l.actual)}</td>
              <td>{fmt(l.actual - l.theoretical)}</td>
            </tr>
          ))}
        </Table>
      </Panel>
      {changed.map((l) => (
        <Panel key={l.materialId} title={`Thông tin xử lý chênh lệch ${l.materialId}`}>
          {!staff && c.handlingStatus === 'pendingHandling' ? (
            <div className="form-grid">
              <Field label={`Nguyên nhân ${l.materialId} *`}>
                <input
                  value={handling[l.materialId]?.reason || ''}
                  onChange={(e) =>
                    setHandling((v) => ({
                      ...v,
                      [l.materialId]: {
                        remedy: v[l.materialId]?.remedy || '',
                        reason: e.target.value,
                      },
                    }))
                  }
                />
              </Field>
              <Field label={`Biện pháp xử lý ${l.materialId} *`}>
                <input
                  value={handling[l.materialId]?.remedy || ''}
                  onChange={(e) =>
                    setHandling((v) => ({
                      ...v,
                      [l.materialId]: {
                        reason: v[l.materialId]?.reason || '',
                        remedy: e.target.value,
                      },
                    }))
                  }
                />
              </Field>
            </div>
          ) : (
            <Facts
              columns={5}
              items={[
                ['Nguyên nhân', l.reason || c.reason],
                ['Biện pháp xử lý', l.remedy || c.remedy],
                ['Người đề xuất', pending?.creator || '—'],
                ['Người phê duyệt', pending?.decidedBy || '—'],
                ['Trạng thái xử lý', pending ? <Badge status={pending.status} /> : 'Đã ghi nhận'],
              ]}
            />
          )}
        </Panel>
      ))}
      {!staff && c.handlingStatus === 'pendingHandling' && (
        <div className="form-actions">
          <button
            className="primary"
            disabled={
              !changed.every(
                (l) =>
                  handling[l.materialId]?.reason.trim() && handling[l.materialId]?.remedy.trim(),
              )
            }
            onClick={async () => {
              await run(
                {
                  type: 'handleCount',
                  id: c.id,
                  lines: changed.map((l) => ({
                    materialId: l.materialId,
                    ...handling[l.materialId],
                  })),
                },
                user!.role === 'owner'
                  ? 'Đã xử lý chênh lệch và cập nhật tồn kho.'
                  : 'Đã gửi đề xuất điều chỉnh tồn kho, chờ Chủ cửa hàng phê duyệt.',
              );
            }}
          >
            {user!.role === 'owner' ? 'Áp dụng điều chỉnh' : 'Gửi đề xuất điều chỉnh'}
          </button>
        </div>
      )}
      <p className="caption count-confirmation">
        Xác nhận: {c.creator} · {dateTimeFmt(event?.date || c.date)}.
      </p>
    </Screen>
  );
}
function CountForm({
  draft,
  onClose,
  onBranch,
}: {
  draft: CountDraft;
  onClose: () => void;
  onBranch: (branch: string) => Promise<void>;
}) {
  const { db, user, run } = useApp();
  const staff = user!.role === 'staff';
  const [date, setDate] = useState(localNow()),
    [kind, setKind] = useState('Định kỳ cuối ca'),
    [actuals, setActuals] = useState<Record<string, string>>({}),
    [handling, setHandling] = useState<Record<string, { reason: string; remedy: string }>>({}),
    [cancel, setCancel] = useState(false),
    [error, setError] = useState('');
  async function discardDraft() {
    if (await run({ type: 'cancelCount', id: draft.id }, '')) onClose();
  }
  async function changeBranch(branchId: string) {
    if (branchId === draft.branchId) return;
    if (await run({ type: 'cancelCount', id: draft.id }, '')) await onBranch(branchId);
  }
  const changed = draft.lines.filter(
    (l) =>
      actuals[l.materialId] !== undefined &&
      actuals[l.materialId] !== '' &&
      Math.abs(Number(actuals[l.materialId]) - l.theoretical) >= 1e-6,
  );
  const valid =
    draft.lines.every(
      (l) =>
        actuals[l.materialId] !== undefined &&
        actuals[l.materialId] !== '' &&
        Number.isFinite(Number(actuals[l.materialId])) &&
        Number(actuals[l.materialId]) >= 0,
    ) &&
    !!date &&
    (staff ||
      changed.every(
        (l) => handling[l.materialId]?.reason.trim() && handling[l.materialId]?.remedy.trim(),
      ));
  return (
    <Screen title="Tạo phiếu kiểm kê" onBack={() => setCancel(true)} backFirst>
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) return;
          const count: Count = {
            id: draft.id,
            draftId: draft.id,
            branchId: draft.branchId,
            date: new Date(`${date}:00+07:00`).toISOString(),
            period: date.slice(0, 7),
            creator: user!.name,
            note: kind,
            reason: '',
            remedy: '',
            lines: draft.lines.map((l) => ({
              ...l,
              actual: Number(actuals[l.materialId]),
              reason: handling[l.materialId]?.reason || '',
              remedy: handling[l.materialId]?.remedy || '',
            })),
          };
          if (await run({ type: 'count', count }, 'Tạo phiếu kiểm kê kho thành công!')) onClose();
          else setError('Định dạng dữ liệu không hợp lệ. Vui lòng kiểm tra và nhập lại!');
        }}
      >
        {error && (
          <p role="alert" className="inline-error">
            {error}
          </p>
        )}
        <Panel title="Thông tin chung">
          <div className="form-grid three">
            <Field label="Chi nhánh *">
              <BranchSelect
                value={draft.branchId}
                all={false}
                onChange={(v) => void changeBranch(v)}
              />
            </Field>
            <Field label="Loại kiểm kê *">
              <Select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option>Định kỳ cuối ca</option>
                <option>Định kỳ cuối tháng</option>
              </Select>
            </Field>
            <Field label="Thời gian kiểm kê *">
              <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
        </Panel>
        <Panel title="Thông tin kiểm kê">
          <Table
            headers={[
              'Mã NVL',
              'Tên nguyên vật liệu',
              'Đơn vị',
              'Tồn hệ thống',
              'Thực tế *',
              'Chênh lệch',
            ]}
          >
            {draft.lines.map((l) => (
              <tr key={l.materialId}>
                <td>{l.materialId}</td>
                <td>{db!.materials.find((m) => m.id === l.materialId)?.name}</td>
                <td>{db!.materials.find((m) => m.id === l.materialId)?.unit}</td>
                <td>{fmt(l.theoretical)}</td>
                <td>
                  <NonNegativeInput
                    aria-label={`Thực tế ${db!.materials.find((m) => m.id === l.materialId)?.name}`}
                    step="any"
                    min="0"
                    value={actuals[l.materialId] ?? ''}
                    onChange={(e) => setActuals((v) => ({ ...v, [l.materialId]: e.target.value }))}
                  />
                </td>
                <td>
                  {actuals[l.materialId] !== undefined && actuals[l.materialId] !== ''
                    ? fmt(Number(actuals[l.materialId]) - l.theoretical)
                    : '—'}
                </td>
              </tr>
            ))}
          </Table>
        </Panel>
        {!staff &&
          changed.map((l) => (
            <Panel key={l.materialId} title={`Thông tin xử lý chênh lệch ${l.materialId}`}>
              <div className="form-grid">
                <Field label={`Nguyên nhân ${l.materialId} *`}>
                  <input
                    value={handling[l.materialId]?.reason || ''}
                    onChange={(e) =>
                      setHandling((v) => ({
                        ...v,
                        [l.materialId]: {
                          remedy: v[l.materialId]?.remedy || '',
                          reason: e.target.value,
                        },
                      }))
                    }
                  />
                </Field>
                <Field label={`Biện pháp xử lý ${l.materialId} *`}>
                  <input
                    value={handling[l.materialId]?.remedy || ''}
                    onChange={(e) =>
                      setHandling((v) => ({
                        ...v,
                        [l.materialId]: {
                          reason: v[l.materialId]?.reason || '',
                          remedy: e.target.value,
                        },
                      }))
                    }
                  />
                </Field>
              </div>
            </Panel>
          ))}
        <FormActions onCancel={() => setCancel(true)} disabled={!valid} />
      </form>
      {cancel && (
        <Confirm
          title=""
          // title="Xác nhận hủy"
          message={cancelMessage}
          onClose={() => setCancel(false)}
          onConfirm={() => void discardDraft()}
        />
      )}
    </Screen>
  );
}
