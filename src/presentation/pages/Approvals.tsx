import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../../app/context';
import { proposalNames, statuses, type Proposal, type ProposalKind } from '../../domain/model';
import { stockOf } from '../../domain/rules';
import {
  Badge,
  BranchSelect,
  Confirm,
  Facts,
  Heading,
  Panel,
  Screen,
  Select,
  Table,
  dateFmt,
  dateTimeFmt,
  fmt,
  useScreen,
} from '../components/ui';
import { useBranchScope } from '../components/ui';

export function ApprovalDetail({
  proposal: p,
  onClose,
}: {
  proposal: Proposal;
  onClose: () => void;
}) {
  const { db, run, busy } = useApp();
  useBranchScope(p.branchId || 'all');
  const [decision, setDecision] = useState<'reject' | null>(null);
  const movement = db!.movements.find((m) => m.id === p.targetId);
  const count = db!.counts.find((c) => c.id === p.targetId);
  const label = p.kind === 'movement' ? p.targetId : p.id;
  const items: [string, React.ReactNode][] = [
    ['Mã phiếu', label],
    ['Trạng thái', <Badge status={p.status} />],
    ['Thời gian tạo', dateTimeFmt(p.date)],
    ['Người yêu cầu', p.creator],
  ];
  if (['movement', 'adjustment'].includes(p.kind))
    items.push(['Chi nhánh', db!.branches.find((b) => b.id === p.branchId)?.name]);
  if (movement)
    items.push([
      'Loại phiếu',
      movement.kind === 'inbound' ? 'Kế hoạch nhập hàng' : 'Kế hoạch xuất điều chuyển',
    ]);
  if (p.recipe) items.push(['Món đồ uống', `${p.recipe.id} · ${p.recipe.name}`]);
  if (p.material) items.push(['Nguyên vật liệu', `${p.material.id} · ${p.material.name}`]);
  const oldMaterial = p.beforeMaterial ?? db!.materials.find((m) => m.id === p.targetId);
  const oldRecipe = p.beforeRecipe ?? db!.recipes.find((r) => r.id === p.targetId);
  return (
    <Screen title={`Đề xuất ${label}`} onBack={onClose} className="approval-detail">
      <Panel title="Thông tin đề xuất">
        <Facts items={items} />
      </Panel>
      {p.adjustments && (
        <Panel title="Bảng đối chiếu đề xuất">
          <Table
            headers={[
              'Nguyên vật liệu',
              'Đơn vị',
              'Lúc lập đề xuất',
              'Hiện tại',
              'Điều chỉnh',
              'Lý do từng mặt hàng',
            ]}
          >
            {p.adjustments.map((a) => {
              const m = db!.materials.find((m) => m.id === a.materialId);
              const original = count?.lines.find((l) => l.materialId === a.materialId);
              return (
                <tr key={a.materialId}>
                  <td>
                    {a.materialId} · {m?.name}
                  </td>
                  <td>{m?.unit}</td>
                  <td>
                    {fmt(
                      a.theoretical ??
                        original?.theoretical ??
                        stockOf(db!, p.branchId, a.materialId),
                    )}
                  </td>
                  <td>{fmt(stockOf(db!, p.branchId, a.materialId))}</td>
                  <td>{fmt(a.delta)}</td>
                  <td>{a.reason || original?.reason || count?.reason || p.reason}</td>
                </tr>
              );
            })}
          </Table>
        </Panel>
      )}
      {movement && (
        <Panel title="Danh sách mặt hàng đề xuất">
          <Table headers={['Mã NVL', 'Tên nguyên vật liệu', 'Số lượng đặt', 'Đơn vị']}>
            {movement.lines.map((l) => (
              <tr key={l.materialId}>
                <td>{l.materialId}</td>
                <td>{db!.materials.find((m) => m.id === l.materialId)?.name}</td>
                <td>{fmt(l.quantity)}</td>
                <td>{db!.materials.find((m) => m.id === l.materialId)?.unit}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}
      {p.recipe && (
        <Panel title="So sánh công thức trước / sau">
          <Table
            headers={['Thuộc tính', 'Trước thay đổi · Đang áp dụng', 'Sau thay đổi · Đề xuất']}
          >
            {[
              ...new Set([
                ...(oldRecipe?.lines.map((l) => l.materialId) || []),
                ...p.recipe.lines.map((l) => l.materialId),
              ]),
            ].map((id) => {
              const mat = db!.materials.find((m) => m.id === id);
              const before = oldRecipe?.lines.find((l) => l.materialId === id);
              const after = p.recipe!.lines.find((l) => l.materialId === id);
              return (
                <tr key={id}>
                  <td>{mat?.name} / 1 đồ uống</td>
                  <td>{before ? `${fmt(before.quantity)} ${mat?.unit}` : '—'}</td>
                  <td>
                    {p.operation === 'delete'
                      ? 'Ngừng áp dụng'
                      : after
                        ? `${fmt(after.quantity)} ${mat?.unit}`
                        : 'Đã loại bỏ'}
                  </td>
                </tr>
              );
            })}
            <tr>
              <td>Ghi chú pha chế</td>
              <td>{oldRecipe?.note || '—'}</td>
              <td>{p.recipe.note || '—'}</td>
            </tr>
          </Table>
        </Panel>
      )}
      {p.material && (
        <Panel title="So sánh nguyên vật liệu trước / sau">
          <Table
            headers={['Thuộc tính', 'Trước thay đổi · Đang áp dụng', 'Sau thay đổi · Đề xuất']}
          >
            {[
              [
                'Tên / Đơn vị',
                oldMaterial ? `${oldMaterial.name} / ${oldMaterial.unit}` : '—',
                `${p.material.name} / ${p.material.unit}`,
              ],
              [
                'Định mức tồn tối thiểu',
                oldMaterial ? `${fmt(oldMaterial.minimum)} ${oldMaterial.unit}` : '—',
                `${fmt(p.material.minimum)} ${p.material.unit}`,
              ],
              ['Nhà cung cấp', oldMaterial?.supplier || '—', p.material.supplier],
              [
                'Trạng thái',
                oldMaterial
                  ? oldMaterial.active
                    ? 'Đang sử dụng'
                    : 'Ngừng sử dụng'
                  : 'Chưa áp dụng',
                p.operation === 'delete'
                  ? 'Ngừng sử dụng (sau khi duyệt)'
                  : 'Đang sử dụng (sau khi duyệt)',
              ],
            ].map(([a, b, c]) => (
              <tr key={a}>
                <td>{a}</td>
                <td>{b}</td>
                <td>{c}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}
      <Panel title="Lý do đề xuất">
        <p>{p.reason}</p>
      </Panel>
      {p.decidedBy && (
        <Panel title="Quyết định phê duyệt">
          <Facts
            columns={3}
            items={[
              ['Người phê duyệt', p.decidedBy],
              ['Thời gian', dateTimeFmt(p.decidedAt!)],
              ['Kết quả', statuses[p.status]],
            ]}
          />
          <p>{p.decisionReason || 'Đồng ý đề xuất'}</p>
        </Panel>
      )}
      {p.status === 'pending' && (
        <div className="form-actions">
          <button className="danger filled" disabled={busy} onClick={() => setDecision('reject')}>
            Từ chối
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              await run(
                { type: 'decide', id: p.id, approve: true, reason: '' },
                'Phê duyệt đề xuất thành công!',
              );
            }}
          >
            Đồng ý
          </button>
        </div>
      )}
      {decision && (
        <Confirm
          title="Thông báo"
          message={`Đề xuất ${label}. Vui lòng nhập lý do từ chối!`}
          reasonRequired
          reasonLabel="Lý do từ chối *"
          cancelLabel="Hủy"
          onClose={() => setDecision(null)}
          onConfirm={async (reason) => {
            if (
              await run(
                { type: 'decide', id: p.id, approve: false, reason },
                'Đã từ chối đề xuất thành công!',
              )
            )
              setDecision(null);
          }}
        />
      )}
    </Screen>
  );
}
export function Approvals() {
  const { kind = 'adjustment' } = useParams();
  const { db } = useApp();
  const view = useScreen();
  const [branch, setBranch] = useState('all'),
    [status, setStatus] = useState('all'),
    [history, setHistory] = useState(false);
  const proposalKind = Object.keys(proposalNames).includes(kind)
    ? (kind as ProposalKind)
    : 'adjustment';
  const selected = db!.proposals.find((p) => p.id === view.id && p.kind === proposalKind);
  if (view.screen === 'detail' && selected)
    return <ApprovalDetail proposal={selected} onClose={view.close} />;
  const rows = db!.proposals
    .filter(
      (p) =>
        p.kind === proposalKind &&
        (branch === 'all' || p.branchId === branch) &&
        (status === 'all' || p.status === status) &&
        (!history || p.status !== 'pending'),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const headers =
    proposalKind === 'adjustment'
      ? ['Mã phiếu', 'Ngày tạo', 'Chi nhánh', 'Người đề xuất', 'Lý do đề xuất', 'Trạng thái']
      : proposalKind === 'movement'
        ? ['Mã phiếu', 'Ngày tạo', 'Chi nhánh', 'Loại phiếu', 'Người đề xuất', 'Trạng thái']
        : [
            'Mã phiếu',
            'Ngày tạo',
            proposalKind === 'recipe' ? 'Món đồ uống' : 'Nguyên vật liệu',
            'Người đề xuất',
            'Nội dung thay đổi',
            'Trạng thái',
          ];
  return (
    <>
      <Heading title={proposalNames[proposalKind]}>
        <button onClick={() => setHistory(!history)}>
          {history ? '← Danh sách' : 'Lịch sử phê duyệt'}
        </button>
      </Heading>
      <div className="filters">
        <BranchSelect value={branch} onChange={setBranch} />
        <Select aria-label="Trạng thái" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Trạng thái: Tất cả</option>
          <option value="pending">Chờ phê duyệt</option>
          <option value="approved">Đã phê duyệt</option>
          <option value="rejected">Từ chối</option>
        </Select>
      </div>
      <Table headers={headers} empty={!rows.length} emptySubject="yêu cầu phê duyệt">
        {rows.map((p) => {
          const movement = db!.movements.find((m) => m.id === p.targetId);
          return (
            <tr key={p.id} className="clickable-row" onClick={() => view.open('detail', p.id)}>
              <td>
                <button
                  className="text-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    view.open('detail', p.id);
                  }}
                >
                  {p.kind === 'movement' ? p.targetId : p.id}
                </button>
              </td>
              <td>{dateFmt(p.date)}</td>
              {p.kind === 'adjustment' ? (
                <>
                  <td>{db!.branches.find((b) => b.id === p.branchId)?.name}</td>
                  <td>{p.creator}</td>
                  <td>{p.reason}</td>
                </>
              ) : p.kind === 'movement' ? (
                <>
                  <td>{db!.branches.find((b) => b.id === p.branchId)?.name}</td>
                  <td>{movement?.kind === 'inbound' ? 'Nhập hàng' : 'Xuất điều chuyển'}</td>
                  <td>{p.creator}</td>
                </>
              ) : (
                <>
                  <td>{p.recipe?.name || p.material?.name || p.targetId}</td>
                  <td>{p.creator}</td>
                  <td>{p.reason}</td>
                </>
              )}
              <td>
                <Badge status={p.status} />
              </td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
