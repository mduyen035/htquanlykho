import {
  useEffect,
  useRef,
  useId,
  useState,
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type InputHTMLAttributes,
} from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp, useScope } from '../../app/context';
import { statuses, type Status } from '../../domain/model';
export const fmt = (n: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(n);
export const dateFmt = (date: string) =>
  new Date(date).toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
export function Heading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="page-heading">
      <h1>{title}</h1>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function Panel({
  title,
  children,
  action,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <div className="panel-heading">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  const namedChildren = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    if (
      !['input', 'select', 'textarea'].includes(String(child.type)) &&
      child.type !== Select &&
      child.type !== Input
    )
      return child;
    const control = child as ReactElement<{ 'aria-label'?: string }>;
    return cloneElement(control, { 'aria-label': control.props['aria-label'] || label });
  });
  return (
    <label className="field">
      <span>
        {label.includes('*') ? (
          <>
            {label.replace(/\s*\*$/, '')}
            <span className="required"> *</span>
          </>
        ) : (
          label
        )}
      </span>
      {namedChildren}
    </label>
  );
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} />;
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}
export function BranchSelect({
  value,
  onChange,
  all = true,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  all?: boolean;
  disabled?: boolean;
}) {
  const { branches } = useScope();
  useBranchScope(value);
  return (
    <Select
      aria-label="Chi nhánh"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {all && branches.length > 1 && <option value="all">Chi nhánh: Tất cả</option>}
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </Select>
  );
}
export function Search({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="search">
      <input
        aria-label="Tìm kiếm"
        placeholder="Tìm theo mã hoặc tên…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span aria-hidden>⌕</span>
    </div>
  );
}
export function Badge({ status, text }: { status?: Status; text?: string }) {
  return (
    <span
      className={`badge ${status || (text === 'Vượt mức' || text === 'Thừa kho' ? 'rejected' : text === 'Dưới mức tối thiểu' ? 'pending' : 'completed')}`}
    >
      {text || (status && statuses[status])}
    </span>
  );
}
export function EmptyState({ subject = '' }: { subject?: string }) {
  return (
    <span className="empty-state" role="status">
      <svg
        className="empty-search-icon"
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        aria-label="Không có kết quả tìm kiếm"
        role="img"
      >
        <circle cx="20" cy="20" r="13" stroke="currentColor" strokeWidth="2" />
        <path
          d="m30 30 11 11M16 16l8 8m0-8-8 8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span>Không tìm thấy dữ liệu{subject ? ` ${subject}` : ''} phù hợp.</span>
    </span>
  );
}
export function Table({
  headers,
  children,
  empty = false,
  emptySubject = '',
}: {
  headers: string[];
  children: ReactNode;
  empty?: boolean;
  emptySubject?: string;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={`${h}-${i}`} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td className="empty" colSpan={headers.length}>
                <EmptyState subject={emptySubject} />
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
  className = '',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      className={`${wide ? 'wide' : ''} ${className}`}
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby={titleId}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="close" onClick={onClose} aria-label="Đóng">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function FormActions({
  onCancel,
  disabled = false,
  label = 'Lưu thông tin',
}: {
  onCancel: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const { busy } = useApp();
  return (
    <div className="form-actions">
      <button type="button" onClick={onCancel}>
        Hủy
      </button>
      <button className="primary" disabled={disabled || busy}>
        {busy ? 'Đang lưu…' : label}
      </button>
    </div>
  );
}
export function IconButton({
  type,
  onClick,
  disabled = false,
}: {
  type: 'edit' | 'trash';
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="icon-button"
      title={type === 'edit' ? 'Sửa' : 'Xóa'}
      aria-label={type === 'edit' ? 'Sửa' : 'Xóa'}
      onClick={onClick}
      disabled={disabled}
    >
      <img src={`/assets/${type}.svg`} alt="" />
    </button>
  );
}
export function Confirm({
  title,
  onClose,
  onConfirm,
  reasonRequired = false,
  message = 'Bạn có chắc chắn muốn thực hiện thao tác này?',
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Quay lại',
  reasonLabel = 'Lý do *',
}: {
  title: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  reasonRequired?: boolean;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  reasonLabel?: string;
}) {
  const [reason, setReason] = useState('');
  const { busy } = useApp();
  return (
    <Dialog title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (reasonRequired && !reason.trim()) return;
          onConfirm(reason);
        }}
      >
        <p>{message}</p>
        {reasonRequired && (
          <Field label={reasonLabel}>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              autoFocus
            />
          </Field>
        )}
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            {cancelLabel}
          </button>
          <button className="primary" disabled={busy || (reasonRequired && !reason.trim())}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export const matches = (query: string, ...values: string[]) =>
  values.join(' ').toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'));
export function useBranchScope(id: string) {
  const { pathname } = useLocation();
  const { setViewBranch } = useApp();
  useEffect(() => {
    setViewBranch({ path: pathname, id });
  }, [pathname, id, setViewBranch]);
}
export function Pager({
  page,
  total,
  onChange,
  size = 10,
}: {
  page: number;
  total: number;
  onChange: (n: number) => void;
  size?: number;
}) {
  if (total <= size) return null;
  return (
    <div className="pager">
      <span>{total} bản ghi</span>
      <button disabled={page === 1} onClick={() => onChange(page - 1)}>
        ‹ Trước
      </button>
      <span>
        Trang {page}/{Math.ceil(total / size)}
      </span>
      <button disabled={page * size >= total} onClick={() => onChange(page + 1)}>
        Sau ›
      </button>
    </div>
  );
}
export function useScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return {
    screen: params.get('screen') || 'list',
    id: params.get('id') || '',
    branch: params.get('branch') || '',
    open: (screen: string, id?: string, extra: Record<string, string> = {}) =>
      navigate(`${pathname}?${new URLSearchParams({ screen, ...(id ? { id } : {}), ...extra })}`),
    close: () => navigate(pathname),
  };
}
export function Screen({
  title,
  onBack,
  children,
  backFirst = false,
  className = '',
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
  backFirst?: boolean;
  className?: string;
}) {
  return (
    <div className={`feature-screen ${className}`}>
      <div className={`page-heading ${backFirst ? 'back-first' : ''}`}>
        {backFirst && (
          <button type="button" onClick={onBack}>
            ← Danh sách
          </button>
        )}
        <h1>{title}</h1>
        {!backFirst && (
          <button type="button" onClick={onBack}>
            ← Danh sách
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
export function Facts({ items, columns = 4 }: { items: [string, ReactNode][]; columns?: number }) {
  return (
    <dl className={`details-grid columns-${columns}`}>
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
export function PeriodSelect({
  value,
  onChange,
  label = 'Kỳ báo cáo',
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {['2026-10', '2026-11', '2026-12', '2026-Q4'].map((p) => (
        <option key={p} value={p}>
          {p.includes('Q')
            ? `Kỳ: Quý ${p.slice(-1)}/${p.slice(0, 4)}`
            : `Kỳ: Tháng ${Number(p.slice(5))}/${p.slice(0, 4)}`}
        </option>
      ))}
    </Select>
  );
}
export const periodLabel = (p: string) =>
  p.includes('Q')
    ? `Quý ${p.slice(-1)}/${p.slice(0, 4)}`
    : `Tháng ${Number(p.slice(5))}/${p.slice(0, 4)}`;
export const dateTimeFmt = (date: string) =>
  `${dateFmt(date)} · ${new Date(date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}`;
export const cancelMessage =
  'Bạn có chắc chắn muốn hủy thao tác? Các dữ liệu đã nhập sẽ không được lưu.';
