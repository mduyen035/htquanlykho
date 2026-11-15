import { useEffect, useState } from 'react';
import { useApp, useScope } from '../../app/context';
import { http, isMock } from '../../app/container';
import type { Database } from '../../domain/model';
import { lossReport, stockReport } from '../../application/queries';
import { exportWorkbook } from '../../infrastructure/workbooks';
import {
  Badge,
  BranchSelect,
  Heading,
  EmptyState,
  Panel,
  Search,
  Select,
  Table,
  fmt,
  matches,
  periodLabel,
} from '../components/ui';
export function Reports({ loss = false }: { loss?: boolean }) {
  const { db, user, notify } = useApp();
  const { role } = useScope();
  const [draft, setDraft] = useState({
      branch: role === 'owner' ? 'all' : user!.branchId,
      material: 'all',
      period: '2026-10',
      date: new Date(
        new Date(db!.stockSnapshots?.[0]?.date || new Date().toISOString()).getTime() + 7 * 3600000,
      )
        .toISOString()
        .slice(0, 10),
    }),
    [filter, setFilter] = useState(draft),
    [query, setQuery] = useState(''),
    [exporting, setExporting] = useState(false);
  const [serverStocks, setServerStocks] = useState<Database['stocks'] | null>(null);
  useEffect(() => {
    if (isMock || loss) return;
    let current = true;
    const at = encodeURIComponent(`${filter.date}T23:59:59.999+07:00`);
    const from = encodeURIComponent(`${filter.date}T00:00:00+07:00`);
    void Promise.all(
      db!.branches.map(async (branch) => {
        const result = (await http.request(
          `/reports/inventory?branchId=${encodeURIComponent(branch.id)}&at=${at}&from=${from}`,
        )) as {
          items: {
            materialId: string;
            code: string;
            opening: number;
            inbound: number;
            outbound: number;
            adjustment: number;
            quantity: number;
          }[];
        };
        return result.items.map((item) => ({
          materialId: item.code || item.materialId,
          branchId: branch.id,
          opening: item.opening,
          inbound: item.inbound,
          outbound: item.outbound,
          adjustment: item.adjustment,
          quantity: item.quantity,
        }));
      }),
    )
      .then((rows) => {
        if (current) setServerStocks(rows.flat());
      })
      .catch((error) => {
        if (current)
          notify(
            `Lỗi: ${error instanceof Error ? error.message : 'Không tải được báo cáo tồn kho.'}`,
          );
      });
    return () => {
      current = false;
    };
  }, [db, filter.date, loss, notify]);
  const losses = lossReport(db!, user!, filter.period, filter.branch, filter.material).filter((l) =>
    matches(query, l.materialId, l.name),
  );
  const stocks = (
    isMock
      ? stockReport(db!, user!, filter.date, filter.branch, filter.material)
      : serverStocks || []
  ).filter(
    (s) =>
      (filter.branch === 'all' || s.branchId === filter.branch) &&
      (filter.material === 'all' || s.materialId === filter.material),
  );
  const branchName = (id: string) =>
    db!.branches.find((b) => b.id === id)?.name.replace('Trình - ', '') || id;
  const stockHeaders = [
    'Mã NVL',
    'Tên nguyên vật liệu',
    'Chi nhánh',
    'Đơn vị',
    'Tồn đầu',
    'Nhập',
    'Xuất',
    'Tồn cuối',
    'Tối thiểu',
  ];
  const lossHeaders = [
    'Mã / Nguyên vật liệu',
    'Chi nhánh',
    'Đơn vị',
    'Tồn lý thuyết',
    'Tồn thực tế',
    'Hao hụt',
    'Mức cho phép',
    'Phân loại',
  ];
  const stockRows = stocks.map((s) => {
    const m = db!.materials.find((m) => m.id === s.materialId)!;
    return [
      m.id,
      m.name,
      branchName(s.branchId),
      m.unit,
      s.opening,
      s.inbound,
      s.outbound,
      s.quantity,
      m.minimum,
    ];
  });
  const lossRows = losses.map((l) => [
    `${l.materialId} · ${l.name}`,
    branchName(l.branchId),
    l.unit,
    l.theoretical,
    l.actual,
    l.difference,
    `${fmt(l.allowance)} ${l.unit}`,
    l.classification,
  ]);
  const periods = [
    ...new Set([
      '2026-10',
      '2026-11',
      '2026-12',
      '2026-Q4',
      ...db!.sales.map((s) => s.period),
      ...db!.counts.map((c) => c.period),
    ]),
  ]
    .sort()
    .reverse();
  async function download() {
    setExporting(true);
    try {
      await exportWorkbook(
        loss ? 'bao-cao-hao-hut' : 'bao-cao-ton-kho',
        loss ? lossHeaders : stockHeaders,
        loss ? lossRows : stockRows,
      );
      notify(`Xuất báo cáo ${loss ? 'hao hụt' : 'tồn kho'} thành công!`);
    } catch {
      notify('Lỗi: Không xuất được báo cáo.');
    } finally {
      setExporting(false);
    }
  }
  const materialSelect = (
    <Select
      aria-label="Nguyên vật liệu"
      value={draft.material}
      onChange={(e) => setDraft({ ...draft, material: e.target.value })}
    >
      <option value="all">Nguyên vật liệu: Tất cả</option>
      {db!.materials.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </Select>
  );
  return (
    <div className={`reports-page ${loss ? 'loss-report' : 'stock-report'}`}>
      <Heading title={loss ? 'Báo cáo hao hụt' : 'Báo cáo tồn kho'}>
        <button
          onClick={() => void download()}
          disabled={exporting || (loss ? !losses.length : !stocks.length)}
        >
          {exporting ? 'Đang xuất…' : 'Xuất báo cáo'}
        </button>
      </Heading>
      <Panel className="report-filters">
        <div className="filters">
          {loss ? (
            <>
              <Search value={query} onChange={setQuery} />
              <BranchSelect
                value={draft.branch}
                onChange={(branch) => setDraft({ ...draft, branch })}
              />
              <Select
                aria-label="Kỳ báo cáo"
                value={draft.period}
                onChange={(e) => setDraft({ ...draft, period: e.target.value })}
              >
                {periods.map((p) => (
                  <option key={p} value={p}>
                    Kỳ: {periodLabel(p)}
                  </option>
                ))}
              </Select>
              {materialSelect}
            </>
          ) : (
            <>
              <label className="report-date-field">
                <span>Ngày xem:</span>
                <input
                  aria-label="Ngày xem"
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />
              </label>
              {materialSelect}
            </>
          )}
          <button
            className="primary"
            disabled={loss ? !draft.period : !draft.date}
            onClick={() => setFilter(draft)}
          >
            Xem báo cáo
          </button>
        </div>
      </Panel>
      <Panel
        title={loss ? 'Chi tiết hao hụt theo nguyên vật liệu' : 'Chi tiết tồn kho'}
        className="report-panel"
      >
        {loss && !losses.length ? (
          <div className="empty">
            <EmptyState subject="báo cáo hao hụt" />
            <p className="caption">
              Chưa đủ dữ liệu khớp với bộ lọc. Cần dữ liệu bán hàng và phiếu kiểm kê tương ứng với
              kỳ đã chọn.
            </p>
          </div>
        ) : loss ? (
          <Table headers={lossHeaders}>
            {losses.map((l) => (
              <tr key={`${l.branchId}-${l.materialId}`}>
                <td className="code">
                  {l.materialId} · {l.name}
                </td>
                <td>{branchName(l.branchId)}</td>
                <td>{l.unit}</td>
                <td>{fmt(l.theoretical)}</td>
                <td>{fmt(l.actual)}</td>
                <td>{fmt(l.difference)}</td>
                <td>
                  {fmt(l.allowance)} {l.unit}
                </td>
                <td>
                  <Badge text={l.classification} />
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Table headers={stockHeaders} empty={!stocks.length} emptySubject="tồn kho">
            {stockRows.map((row, i) => (
              <tr key={`${stocks[i].branchId}-${stocks[i].materialId}`}>
                {row.map((v, j) => (
                  <td
                    key={j}
                    className={j === 0 ? 'code' : ''}
                    title={
                      j === 7 && (stocks[i].adjustment ?? 0) !== 0
                        ? `Bao gồm điều chỉnh: ${fmt(stocks[i].adjustment ?? 0)}`
                        : undefined
                    }
                  >
                    {typeof v === 'number' ? fmt(v) : v}
                  </td>
                ))}
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}
