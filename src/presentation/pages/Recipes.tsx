import { useState } from 'react';
import { useApp } from '../../app/context';
import type { Recipe } from '../../domain/model';
import { newId } from '../../application/execute';
import {
  Confirm,
  Dialog,
  Field,
  FormActions,
  Heading,
  IconButton,
  Panel,
  Search,
  Select,
  Table,
  dateFmt,
  dateTimeFmt,
  Facts,
  cancelMessage,
  fmt,
  matches,
} from '../components/ui';
export function Recipes() {
  const { db, run, user } = useApp();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [edit, setEdit] = useState<Recipe | null>(null);
  const [detail, setDetail] = useState<Recipe | null>(null);
  const [remove, setRemove] = useState<Recipe | null>(null);
  const rows = db!.recipes.filter(
    (r) =>
      r.active && (category === 'all' || category === r.category) && matches(query, r.id, r.name),
  );
  return (
    <>
      <Heading title="Quản lý công thức món">
        <Select
          aria-label="Nhóm món đồ uống"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">Nhóm món đồ uống: Tất cả</option>
          <option>Espresso</option>
          <option>Trà sữa</option>
        </Select>
        <Search value={query} onChange={setQuery} />
        <button
          className="primary"
          onClick={() =>
            setEdit({
              id: newId('MON'),
              name: '',
              category: 'Espresso',
              version: 0,
              active: true,
              note: '',
              lines: [],
              history: [],
            })
          }
        >
          + Thiết lập công thức mới
        </button>
      </Heading>
      <p className="recipe-date caption">Tại ngày {dateFmt(new Date().toISOString())}</p>
      <Panel className="recipe-panel">
        <Table
          headers={['Mã', 'Tên', 'Phiên bản', 'Loại món', 'Số lượng NVL', 'Thao tác']}
          empty={!rows.length}
          emptySubject="món đồ uống"
        >
          {rows.map((r) => (
            <tr key={r.id} className="clickable-row" onClick={() => setDetail(r)}>
              <td>
                <button
                  className="text-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetail(r);
                  }}
                >
                  {r.id}
                </button>
              </td>
              <td>{r.name}</td>
              <td>v{r.version}.0</td>
              <td>{r.category}</td>
              <td>{r.lines.length}</td>
              <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                <IconButton type="edit" onClick={() => setEdit(r)} />
                <IconButton type="trash" onClick={() => setRemove(r)} />
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
      {edit && <RecipeForm recipe={edit} onClose={() => setEdit(null)} />}
      {detail && (
        <Dialog
          title="Xem công thức"
          onClose={() => setDetail(null)}
          className="recipe-detail-dialog"
        >
          <Panel title="Thông tin chung">
            <Facts
              columns={3}
              items={[
                ['Mã món', detail.id],
                ['Tên món', detail.name],
                ['Size đồ uống', detail.size || 'M · 350 ml'],
                ['Phiên bản hiện tại', `v${detail.version}.0`],
              ]}
            />
          </Panel>
          <Panel title="Định lượng nguyên vật liệu">
            <RecipeLines recipe={detail} />
            <p>Ghi chú pha chế: {detail.note}</p>
          </Panel>
          <Panel title="Lịch sử phê duyệt">
            <Table
              headers={['Phiên bản', 'Thời gian phê duyệt', 'Người phê duyệt', 'Ghi chú phê duyệt']}
            >
              {[...detail.history]
                .sort((a, b) => b.version - a.version)
                .map((h) => (
                  <tr key={h.version}>
                    <td>v{h.version}.0</td>
                    <td>{dateTimeFmt(h.date)}</td>
                    <td>{h.approver}</td>
                    <td>{h.note || '—'}</td>
                  </tr>
                ))}
            </Table>
          </Panel>
        </Dialog>
      )}
      {remove && (
        <Confirm
          title={`Xóa công thức ${remove.name}?`}
          reasonRequired
          reasonLabel="Lý do xóa *"
          onClose={() => setRemove(null)}
          onConfirm={async (reason) => {
            if (
              await run(
                { type: 'saveRecipe', recipe: remove, operation: 'delete', reason },
                user!.role === 'owner'
                  ? 'Xóa công thức thành công.'
                  : 'Đã gửi đề xuất xóa công thức, chờ Chủ cửa hàng phê duyệt.',
              )
            )
              setRemove(null);
          }}
        />
      )}
    </>
  );
}
function RecipeLines({ recipe }: { recipe: Recipe }) {
  const { db } = useApp();
  return (
    <Table headers={['Mã NVL', 'Tên nguyên vật liệu', 'Định lượng / món', 'Đơn vị']}>
      {recipe.lines.map((l) => (
        <tr key={l.materialId}>
          <td>{l.materialId}</td>
          <td>{db!.materials.find((m) => m.id === l.materialId)?.name}</td>
          <td>{fmt(l.quantity)}</td>
          <td>{db!.materials.find((m) => m.id === l.materialId)?.unit}</td>
        </tr>
      ))}
    </Table>
  );
}
function RecipeForm({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const { db, run, user } = useApp();
  const [r, setR] = useState(structuredClone(recipe));
  const [selected, setSelected] = useState('');
  const [picker, setPicker] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [error, setError] = useState('');
  const changed =
    JSON.stringify([r.name, r.category, r.lines, r.note]) !==
    JSON.stringify([recipe.name, recipe.category, recipe.lines, recipe.note]);
  return (
    <Dialog
      title={r.version ? 'Sửa công thức' : 'Thiết lập công thức mới'}
      onClose={() => setCancel(true)}
      className="recipe-form-dialog"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await run(
              { type: 'saveRecipe', recipe: r, operation: r.version ? 'update' : 'create' },
              user!.role === 'owner'
                ? 'Lưu công thức thành công. Công thức mới đã được áp dụng.'
                : 'Đã gửi công thức chờ phê duyệt. Phiên bản hiện tại vẫn được áp dụng.',
            )
          )
            onClose();
          else
            setError(
              'Định lượng không hợp lệ, tên món đã tồn tại hoặc công thức chưa có thay đổi. Vui lòng kiểm tra lại.',
            );
        }}
      >
        {(error || r.lines.some((l) => !Number.isFinite(l.quantity) || l.quantity <= 0)) && (
          <p role="alert" className="inline-error">
            {error || 'Thông tin nhập vào không hợp lệ. Vui lòng kiểm tra và thử lại!'}
          </p>
        )}
        <Panel title="Thông tin món">
          <div className="form-grid">
            <Field label="Tên món *">
              <input
                autoFocus
                required
                value={r.name}
                onChange={(e) => setR({ ...r, name: e.target.value })}
              />
            </Field>
            <Field label="Loại món *">
              <Select value={r.category} onChange={(e) => setR({ ...r, category: e.target.value })}>
                <option>Espresso</option>
                <option>Trà sữa</option>
              </Select>
            </Field>
          </div>
        </Panel>
        <Panel title="Định lượng">
          <div className="recipe-add-material">
            <button type="button" onClick={() => setPicker(true)}>
              + Thêm nguyên vật liệu
            </button>
          </div>
          <Table
            headers={['Tên nguyên vật liệu', 'Định lượng *', 'Đơn vị', '']}
            empty={!r.lines.length}
            emptySubject="nguyên vật liệu"
          >
            {r.lines.map((l) => (
              <tr key={l.materialId}>
                <td>{db!.materials.find((m) => m.id === l.materialId)?.name}</td>
                <td>
                  <input
                    type="number"
                    min="0.000001"
                    step="any"
                    aria-label={`Định lượng ${l.materialId}`}
                    required
                    value={Number.isFinite(l.quantity) ? l.quantity : ''}
                    aria-invalid={!Number.isFinite(l.quantity) || l.quantity <= 0}
                    onChange={(e) =>
                      setR({
                        ...r,
                        lines: r.lines.map((x) =>
                          x.materialId === l.materialId
                            ? { ...x, quantity: e.target.valueAsNumber }
                            : x,
                        ),
                      })
                    }
                  />
                  {(!Number.isFinite(l.quantity) || l.quantity <= 0) && (
                    <small className="field-error">
                      {!Number.isFinite(l.quantity)
                        ? 'Định lượng là bắt buộc.'
                        : l.quantity === 0
                          ? 'Không được bằng 0.'
                          : 'Không được là số âm.'}
                    </small>
                  )}
                </td>
                <td>{db!.materials.find((m) => m.id === l.materialId)?.unit}</td>
                <td>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setR({ ...r, lines: r.lines.filter((x) => x.materialId !== l.materialId) })
                    }
                    aria-label={`Bỏ ${l.materialId}`}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </Table>
          <Field label={r.version ? 'Ghi chú *' : 'Ghi chú'}>
            <input
              required={!!r.version}
              value={r.note}
              onChange={(e) => setR({ ...r, note: e.target.value })}
            />
          </Field>
        </Panel>
        <FormActions
          onCancel={() => setCancel(true)}
          disabled={
            !r.name.trim() ||
            !r.lines.length ||
            !r.lines.every((l) => Number.isFinite(l.quantity) && l.quantity > 0) ||
            (!!r.version && (!changed || !r.note.trim()))
          }
        />
      </form>
      {picker && (
        <Dialog title="Thêm nguyên vật liệu" onClose={() => setPicker(false)}>
          <Field label="Nguyên vật liệu *">
            <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Chọn nguyên vật liệu</option>
              {db!.materials
                .filter((m) => m.active && !r.lines.some((l) => l.materialId === m.id))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </Select>
          </Field>
          <div className="form-actions">
            <button type="button" onClick={() => setPicker(false)}>
              Hủy
            </button>
            <button
              type="button"
              className="primary"
              disabled={!selected}
              onClick={() => {
                setR({ ...r, lines: [...r.lines, { materialId: selected, quantity: 0.01 }] });
                setSelected('');
                setPicker(false);
              }}
            >
              Thêm nguyên vật liệu
            </button>
          </div>
        </Dialog>
      )}
      {cancel && (
        <Confirm
          title="Hủy thao tác? Dữ liệu đã nhập sẽ không được lưu."
          message={cancelMessage}
          onClose={() => setCancel(false)}
          onConfirm={onClose}
        />
      )}
    </Dialog>
  );
}
