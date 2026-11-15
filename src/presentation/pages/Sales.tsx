import { useRef, useState } from 'react';
import { useApp } from '../../app/context';
import { newId } from '../../application/execute';
import { salesPreview, periodsOverlap } from '../../application/queries';
import { exportWorkbook, parseSales } from '../../infrastructure/workbooks';
import {
  Badge,
  BranchSelect,
  Confirm,
  Facts,
  Field,
  Heading,
  Panel,
  Select,
  Table,
  fmt,
  periodLabel,
} from '../components/ui';
import { useBranchScope } from '../components/ui';
type SalesLine = { recipeId: string; quantity: number; name?: string };
export function SalesPage() {
  const { db, user, run, notify, busy } = useApp();
  const [branch, setBranch] = useState(user!.branchId),
    [periodType, setPeriodType] = useState('month'),
    [periodNumber, setPeriodNumber] = useState('10'),
    [year, setYear] = useState('2026'),
    [file, setFile] = useState<File | null>(null),
    [lines, setLines] = useState<SalesLine[] | null>(null),
    [preview, setPreview] = useState(false),
    [error, setError] = useState(''),
    [reading, setReading] = useState(false),
    [confirm, setConfirm] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const readId = useRef(0);
  useBranchScope(branch);
  const period = `${year}-${periodType === 'month' ? periodNumber.padStart(2, '0') : `Q${periodNumber}`}`;
  const existing = db!.sales.filter(
    (s) => s.branchId === branch && periodsOverlap(s.period, period),
  );
  const result = salesPreview(db!, lines || []);
  async function choose(f: File | undefined) {
    const token = ++readId.current;
    setFile(f || null);
    setLines(null);
    setPreview(false);
    setError('');
    if (!f) return;
    setReading(true);
    try {
      const parsed = await parseSales(f);
      const grouped = new Map<string, SalesLine>();
      for (const l of parsed) {
        const recipe = db!.recipes.find(
          (r) =>
            r.id === l.recipeId ||
            r.name.toLocaleLowerCase('vi') === (l.name || l.recipeId).toLocaleLowerCase('vi'),
        );
        const id = recipe?.id || l.recipeId;
        const old = grouped.get(id);
        grouped.set(id, {
          recipeId: id,
          name: recipe?.name || l.name || l.recipeId,
          quantity: (old?.quantity || 0) + l.quantity,
        });
      }
      if (token === readId.current) setLines([...grouped.values()]);
    } catch (e) {
      if (token === readId.current)
        setError(e instanceof Error ? e.message : 'Không đọc được tệp dữ liệu.');
    } finally {
      if (token === readId.current) setReading(false);
    }
  }
  function clear() {
    ++readId.current;
    setFile(null);
    setLines(null);
    setPreview(false);
    setError('');
    setReading(false);
    if (ref.current) ref.current.value = '';
  }
  async function save(replaceOverlapping = false) {
    if (!file || !lines) return;
    if (
      await run(
        {
          type: 'sales',
          replaceOverlapping,
          sales: {
            id: newId('BH'),
            branchId: branch,
            period,
            filename: file.name,
            date: new Date().toISOString(),
            lines,
          },
        },
        'Lưu dữ liệu thành công!',
      )
    ) {
      setConfirm(false);
      clear();
    }
  }
  return (
    <div className="sales-page">
      <Heading title="Dữ liệu bán hàng" />
      <div className="sales-steps">
        <span>Chọn kỳ và tải dữ liệu</span>
        {preview && (
          <>
            <span aria-hidden>→</span>
            <strong>Xem trước và xác nhận</strong>
          </>
        )}
      </div>
      <input
        ref={ref}
        hidden
        type="file"
        accept=".xlsx"
        aria-label="Tệp dữ liệu bán hàng"
        onChange={(e) => void choose(e.target.files?.[0])}
      />
      {!preview ? (
        <>
          <Panel title="Thông tin kỳ báo cáo">
            <div className="form-grid">
              <Field label="Chi nhánh">
                <BranchSelect value={branch} all={false} onChange={setBranch} />
              </Field>
              <Field label="Loại kỳ">
                <Select
                  value={periodType}
                  onChange={(e) => {
                    setPeriodType(e.target.value);
                    setPeriodNumber(e.target.value === 'month' ? '10' : '4');
                  }}
                >
                  <option value="month">Tháng</option>
                  <option value="quarter">Quý</option>
                </Select>
              </Field>
              <Field label="Kỳ báo cáo">
                <Select value={periodNumber} onChange={(e) => setPeriodNumber(e.target.value)}>
                  {Array.from({ length: periodType === 'month' ? 12 : 4 }, (_, i) =>
                    String(i + 1),
                  ).map((n) => (
                    <option key={n} value={n}>
                      {periodType === 'month' ? 'Tháng' : 'Quý'} {n}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Năm">
                <Select value={year} onChange={(e) => setYear(e.target.value)}>
                  {Array.from({ length: 12 }, (_, i) => String(2020 + i)).map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </Panel>
          <Panel title="Đính kèm dữ liệu bán hàng">
            {error && (
              <p className="inline-error" role="alert">
                Định dạng dữ liệu không hợp lệ. Vui lòng kiểm tra và nhập lại!
              </p>
            )}
            {file ? (
              <div className={`selected-file ${error ? 'invalid-file' : ''}`}>
                <div>
                  <strong>{file.name}</strong>
                  <small>
                    {reading
                      ? 'Đang kiểm tra dữ liệu…'
                      : error || `${lines?.length || 0} món · Tệp hợp lệ`}
                  </small>
                </div>
                <button
                  onClick={() => {
                    if (ref.current) ref.current.value = '';
                    ref.current?.click();
                  }}
                >
                  Thay tệp dữ liệu
                </button>
              </div>
            ) : (
              <div
                className="dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void choose(e.dataTransfer.files[0]);
                }}
              >
                <span className="upload-arrow" aria-hidden>
                  ↑
                </span>
                <p>Kéo thả tệp vào đây hoặc chọn từ thiết bị</p>
                <button onClick={() => ref.current?.click()}>Chọn tệp dữ liệu</button>
              </div>
            )}
          </Panel>
          <div className="form-actions">
            <button onClick={clear}>Hủy</button>
            <button
              className="primary"
              disabled={!file || !lines?.length || !!error || reading}
              onClick={() => setPreview(true)}
            >
              Tiếp tục
            </button>
          </div>
          <div className="template-link">
            <button
              className="text-button"
              onClick={async () => {
                try {
                  await exportWorkbook(
                    'mau-du-lieu-ban-hang',
                    ['MaMon', 'TenMon', 'SoLuong'],
                    [
                      ['MON-001', 'CÀ PHÊ SỮA MÁY', 100],
                      ['MON-007', 'ESPRESSO', 60],
                    ],
                  );
                } catch {
                  notify('Lỗi: Không xuất được tệp mẫu.');
                }
              }}
            >
              Tải tệp mẫu Excel
            </button>
          </div>
        </>
      ) : (
        <>
          <Panel title="Thông tin kỳ đối soát">
            <Facts
              columns={3}
              items={[
                ['Chi nhánh', db!.branches.find((b) => b.id === branch)?.name],
                ['Kỳ ghi nhận', periodLabel(period)],
                ['Tổng số đồ uống bán ra', `${fmt(result.total)} đồ uống`],
              ]}
            />
          </Panel>
          {!!result.missing.length && (
            <p role="alert" className="inline-error">
              Một số món bán ra chưa có công thức pha chế trong hệ thống. Vui lòng kiểm tra danh
              sách món được đánh dấu để bổ sung công thức!
            </p>
          )}
          <div className="sales-preview-grid">
            <Panel title="Danh sách món bán ra">
              <Table headers={['Tên món', 'Số lượng bán', 'Tình trạng']}>
                {lines!.map((l) => (
                  <tr
                    key={l.recipeId}
                    className={result.missing.includes(l.recipeId) ? 'invalid-row' : ''}
                  >
                    <td>{l.name || l.recipeId}</td>
                    <td>{fmt(l.quantity)}</td>
                    <td>
                      <Badge
                        status={result.missing.includes(l.recipeId) ? 'rejected' : 'completed'}
                        text={
                          result.missing.includes(l.recipeId)
                            ? 'Thiếu công thức'
                            : 'Đang áp dụng'
                        }
                      />
                    </td>
                  </tr>
                ))}
              </Table>
            </Panel>
            <Panel title="Kết quả tiêu hao nguyên vật liệu lý thuyết">
              <Table
                headers={['Nguyên vật liệu', 'Tổng tiêu hao', 'Đơn vị']}
                empty={!result.consumption.length}
              >
                {result.consumption.map((l) => (
                  <tr key={l.materialId}>
                    <td>{db!.materials.find((m) => m.id === l.materialId)?.name}</td>
                    <td>{fmt(l.quantity)}</td>
                    <td>{db!.materials.find((m) => m.id === l.materialId)?.unit}</td>
                  </tr>
                ))}
              </Table>
            </Panel>
          </div>
          <div className="form-actions">
            <button onClick={() => setPreview(false)}>Hủy</button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => (existing.length ? setConfirm(true) : void save())}
            >
              Xác nhận
            </button>
          </div>
        </>
      )}
      {confirm && (
        <Confirm
          title="Thông báo"
          message={
            existing.every((s) => s.period === period)
              ? 'Dữ liệu bán hàng của kỳ này đã tồn tại trong hệ thống. Bạn có muốn ghi đè không?'
              : `Kỳ này chồng lấn với ${existing.map((s) => periodLabel(s.period)).join(', ')}. Các kỳ cũ này sẽ được thay thế toàn bộ và tiêu hao sẽ được tính lại, không cộng dồn. Bạn có muốn ghi đè không?`
          }
          confirmLabel="Ghi đè"
          cancelLabel="Hủy"
          onClose={() => setConfirm(false)}
          onConfirm={() => void save(true)}
        />
      )}
    </div>
  );
}
