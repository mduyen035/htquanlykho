import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp, useScope } from '../../app/context';
import { newId } from '../../application/execute';
import {
  Badge,
  BranchSelect,
  Dialog,
  Field,
  Heading,
  Panel,
  Table,
  dateFmt,
  fmt,
} from '../components/ui';
export function Dashboard() {
  const { db, user, run, busy } = useApp();
  const { allowed, role } = useScope();
  const navigate = useNavigate();
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const [branch, setBranch] = useState(role === 'owner' ? 'all' : user!.branchId),
    [dates, setDates] = useState(false),
    [from, setFrom] = useState('2026-11-01'),
    [to, setTo] = useState(today);
  const pending = db!.proposals.filter(
    (p) =>
      p.status === 'pending' &&
      allowed(p.branchId) &&
      (branch === 'all' || p.branchId === branch) &&
      p.date.slice(0, 10) >= from &&
      p.date.slice(0, 10) <= to,
  );
  const low = db!.stocks.filter(
    (s) =>
      allowed(s.branchId) &&
      (branch === 'all' || s.branchId === branch) &&
      s.quantity < (db!.materials.find((m) => m.id === s.materialId)?.minimum || 0),
  );
  const confirmedAmount = db!.proposals
    .filter(
      (p) =>
        p.kind === 'adjustment' &&
        p.status === 'approved' &&
        allowed(p.branchId) &&
        (branch === 'all' || p.branchId === branch) &&
        (p.decidedAt || p.date).slice(0, 10) >= from &&
        (p.decidedAt || p.date).slice(0, 10) <= to,
    )
    .flatMap((p) => p.adjustments || [])
    .reduce(
      (sum, a) =>
        sum +
        Math.max(0, -a.delta) * (db!.materials.find((m) => m.id === a.materialId)?.price || 0),
      0,
    );
  const inbound = db!.movements.filter(
    (m) =>
      m.kind === 'inbound' && allowed(m.branchId) && ['receiving', 'backorder'].includes(m.status),
  );
  const outbound = db!.movements.filter(
    (m) => m.kind === 'outbound' && allowed(m.branchId) && m.status === 'ready',
  );
  const counts = db!.counts.filter(
    (c) =>
      allowed(c.branchId) &&
      (c.handlingStatus === 'pendingHandling' ||
        db!.proposals.some((p) => p.targetId === c.id && p.status === 'pending')),
  );
  const needsCount = !db!.counts.some(
    (c) =>
      c.branchId === user!.branchId && c.creator === user!.name && c.date.slice(0, 10) === today,
  );
  async function begin() {
    const id = newId('PKK');
    if (await run({ type: 'beginCount', id, branchId: user!.branchId }, ''))
      navigate(`/counts?screen=create&id=${id}`);
  }
  const metric = (label: string, value: number, unit: string, link: string, text: string) => (
    <div className="metric">
      <p>{label}</p>
      <strong>
        {fmt(value)} <small>{unit}</small>
      </strong>
      <Link to={link}>{text}</Link>
    </div>
  );
  return (
    <div className={`dashboard ${role}`}>
      <Heading title="Tổng quan">
        {role === 'manager' && (
          <Link className="button" to="/materials">
            Xem nguyên vật liệu
          </Link>
        )}
      </Heading>
      {role === 'owner' && (
        <div className="filters">
          <BranchSelect value={branch} onChange={setBranch} />
          <button className="date-chip" onClick={() => setDates(true)}>
            {dateFmt(from)} – {dateFmt(to)} <span aria-hidden>⌄</span>
          </button>
        </div>
      )}
      <div className="metrics">
        {role === 'owner' ? (
          <>
            <div className="metric">
              <p>Yêu cầu chờ phê duyệt</p>
              <strong>
                {pending.length} <small>yêu cầu</small>
              </strong>
              <a href="#pending">Xem yêu cầu bên dưới ↓</a>
            </div>
            <div className="metric">
              <p>Cảnh báo tồn thấp</p>
              <strong>
                {low.length} <small>nguyên vật liệu</small>
              </strong>
              <a href="#low">Xem cảnh báo bên dưới ↓</a>
            </div>
            <div className="metric">
              <p>Giá trị hao hụt đã xác nhận</p>
              <strong>
                {fmt(confirmedAmount)} <small>₫</small>
              </strong>
            </div>
          </>
        ) : (
          <>
            {metric(
              role === 'staff' ? 'Phiếu nhập cần nhận' : 'Phiếu nhập cần xử lý',
              inbound.length,
              'phiếu',
              '/inbound',
              role === 'staff' ? 'Xem phiếu nhập →' : 'Theo dõi nhập kho →',
            )}
            {metric(
              role === 'staff' ? 'Phiếu xuất cần xem' : 'Phiếu xuất cần xử lý',
              outbound.length,
              'phiếu',
              '/outbound',
              role === 'staff' ? 'Xem phiếu xuất →' : 'Theo dõi xuất kho →',
            )}
            {metric(
              role === 'staff' ? 'Kiểm kê cần thực hiện' : 'Kiểm kê chưa hoàn tất',
              role === 'staff' ? (needsCount ? 1 : 0) : counts.length,
              'phiếu',
              '/counts',
              role === 'staff' ? 'Ghi nhận kiểm kê →' : 'Xem lịch kiểm kê →',
            )}
          </>
        )}
      </div>
      {role === 'owner' ? (
        <>
          <section id="pending">
            <Panel title="Yêu cầu chờ phê duyệt" className="dashboard-panel">
              <Table
                headers={[
                  'Mã yêu cầu',
                  'Người gửi | Chi nhánh',
                  'Thời gian gửi',
                  'Trạng thái',
                  'Thao tác',
                ]}
                empty={!pending.length}
              >
                {pending.map((p) => (
                  <tr key={p.id}>
                    <td className="code">{p.kind === 'movement' ? p.targetId : p.id}</td>
                    <td>
                      {p.creator}
                      <small>
                        {db!.branches
                          .find((b) => b.id === p.branchId)
                          ?.name.replace('Trình - ', '')}
                      </small>
                    </td>
                    <td>
                      {new Date(p.date).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Asia/Ho_Chi_Minh',
                      })}
                      <small>{dateFmt(p.date)}</small>
                    </td>
                    <td>
                      <Badge status="pending" />
                    </td>
                    <td>
                      <Link className="button" to={`/approvals/${p.kind}?screen=detail&id=${p.id}`}>
                        Xem & duyệt
                      </Link>
                    </td>
                  </tr>
                ))}
              </Table>
            </Panel>
          </section>
          <section id="low">
            <Panel title="Nguyên vật liệu dưới mức tối thiểu" className="low-panel dashboard-panel">
              <Table
                headers={['Nguyên vật liệu', 'Chi nhánh', 'Tồn hiện tại', 'Tối thiểu']}
                empty={!low.length}
              >
                {low.map((s) => {
                  const m = db!.materials.find((m) => m.id === s.materialId)!;
                  return (
                    <tr key={`${s.branchId}-${s.materialId}`}>
                      <td className="code">
                        {m.id} | {m.name}
                      </td>
                      <td>
                        {db!.branches
                          .find((b) => b.id === s.branchId)
                          ?.name.replace('Trình - ', '')}
                      </td>
                      <td>
                        {fmt(s.quantity)} {m.unit}
                      </td>
                      <td>
                        {fmt(m.minimum)} {m.unit}
                      </td>
                    </tr>
                  );
                })}
              </Table>
            </Panel>
          </section>
        </>
      ) : (
        <>
          <Panel
            title={role === 'staff' ? 'Công việc được giao' : 'Công việc ưu tiên'}
            className="dashboard-panel"
          >
            <Table
              headers={[
                role === 'staff' ? 'Phiếu / Nội dung công việc' : 'Phiếu / Nội dung',
                'Dự kiến',
                ...(role === 'manager' ? ['Phụ trách'] : []),
                'Trạng thái',
                'Thao tác',
              ]}
              empty={!inbound.length && !outbound.length && !needsCount && !counts.length}
            >
              {inbound.map((m) => (
                <tr key={m.id}>
                  <td className="code">
                    {m.id} - {m.status === 'backorder' ? 'Giao bù' : 'Nhận hàng'} {m.supplier}
                  </td>
                  <td>{dateFmt(m.expectedDate)}</td>
                  {role === 'manager' && <td>{m.creator}</td>}
                  <td>
                    <Badge
                      status={m.status === 'backorder' ? 'pending' : 'pending'}
                      text={m.status === 'backorder' ? 'Chờ giao bù' : 'Chờ kiểm nhận'}
                    />
                  </td>
                  <td>
                    <Link
                      className={`button ${role === 'staff' ? 'primary' : ''}`}
                      to={`/inbound?screen=${role === 'staff' ? 'record' : 'detail'}&id=${m.id}`}
                    >
                      {role === 'staff'
                        ? 'Kiểm nhận'
                        : m.status === 'backorder'
                          ? 'Xử lý giao bù'
                          : 'Xem chi tiết'}
                    </Link>
                  </td>
                </tr>
              ))}
              {outbound.map((m) => (
                <tr key={m.id}>
                  <td className="code">
                    {m.id} - {m.reason}
                  </td>
                  <td>{dateFmt(m.date)}</td>
                  {role === 'manager' && <td>{m.creator}</td>}
                  <td>
                    <Badge status="receiving" text="Chờ xác nhận thực xuất" />
                  </td>
                  <td>
                    <Link className="button" to={`/outbound?screen=detail&id=${m.id}`}>
                      {role === 'staff' ? 'Xem phiếu' : 'Xem chi tiết'}
                    </Link>
                  </td>
                </tr>
              ))}
              {role === 'manager' &&
                counts.map((c) => (
                  <tr key={c.id}>
                    <td className="code">
                      {c.id} - {c.note}
                    </td>
                    <td>{dateFmt(c.date)}</td>
                    <td>{c.creator}</td>
                    <td>
                      <Badge
                        status="receiving"
                        text={
                          c.handlingStatus === 'pendingHandling' ? 'Chờ xử lý' : 'Chờ phê duyệt'
                        }
                      />
                    </td>
                    <td>
                      <Link className="button" to={`/counts?screen=detail&id=${c.id}`}>
                        Xem chi tiết
                      </Link>
                    </td>
                  </tr>
                ))}
              {role === 'staff' && needsCount && (
                <tr>
                  <td className="code">Kiểm kê cuối ca</td>
                  <td>
                    20:30<small>Hôm nay</small>
                  </td>
                  <td>
                    <Badge status="receiving" text="Chưa thực hiện" />
                  </td>
                  <td>
                    <button disabled={busy} onClick={() => void begin()}>
                      Ghi số đếm
                    </button>
                  </td>
                </tr>
              )}
            </Table>
          </Panel>
          {role === 'manager' && (
            <Panel title="Cảnh báo nguyên vật liệu" className="manager-alert-panel">
              {low.length ? (
                low.map((s) => {
                  const m = db!.materials.find((m) => m.id === s.materialId)!;
                  return (
                    <div key={s.materialId}>
                      <p className="code">
                        {m.id} | {m.name}
                      </p>
                      <div className="alert-stock">
                        <div>
                          <strong>
                            {fmt(s.quantity)} {m.unit}
                          </strong>
                          <small>Tồn hiện tại</small>
                        </div>
                        <div>
                          <strong>
                            {fmt(m.minimum)} {m.unit}
                          </strong>
                          <small>Mức tối thiểu</small>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p>Không có cảnh báo tồn thấp.</p>
              )}
              <Link className="button" to="/materials">
                Xem nguyên vật liệu
              </Link>
            </Panel>
          )}
        </>
      )}
      {dates && (
        <Dialog title="Chọn thời gian" onClose={() => setDates(false)}>
          <div className="form-grid">
            <Field label="Từ ngày">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Đến ngày">
              <input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          <div className="form-actions">
            <button className="primary" onClick={() => setDates(false)} disabled={from > to}>
              Áp dụng
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
