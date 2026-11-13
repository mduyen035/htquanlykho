import type { Database, Material, Movement, Role, User } from './model';
export class BusinessError extends Error {}
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new BusinessError(message);
}
export const canManage = (role: Role) => role !== 'staff';
export function checkBranch(user: User, branchId: string) {
  assert(
    user.role === 'owner' || user.branchId === branchId,
    'Bạn không có quyền thao tác tại chi nhánh này.',
  );
}
export function positive(value: number, label = 'Số lượng') {
  assert(Number.isFinite(value) && value > 0, `${label} phải lớn hơn 0.`);
}
export function nonnegative(value: number, label = 'Số lượng') {
  assert(Number.isFinite(value) && value >= 0, `${label} phải là số không âm.`);
}
export function validateMaterial(material: Material, all: Material[]) {
  assert(
    material.name.trim() && material.unit.trim() && material.supplier.trim(),
    'Vui lòng nhập đầy đủ tên, đơn vị và nhà cung cấp.',
  );
  assert(
    !all.some(
      (m) =>
        m.id !== material.id &&
        m.name.trim().toLocaleLowerCase('vi') === material.name.trim().toLocaleLowerCase('vi'),
    ),
    'Tên nguyên vật liệu đã tồn tại.',
  );
  nonnegative(material.minimum, 'Tồn tối thiểu');
  assert(
    Number.isInteger(material.minimum),
    'Định mức tối thiểu phải là số nguyên lớn hơn hoặc bằng 0.',
  );
  nonnegative(material.allowance, 'Hao hụt cho phép');
  nonnegative(material.price, 'Đơn giá');
}
export const stockOf = (db: Database, branchId: string, materialId: string) =>
  db.stocks.find((s) => s.branchId === branchId && s.materialId === materialId)?.quantity ?? 0;
export const editableMovement = (m: Movement) =>
  m.status === 'pending' ||
  (m.kind === 'outbound' && m.type === 'internal' && m.status === 'ready');
export function loss(theoretical: number, actual: number, allowance: number) {
  const difference = Math.round((theoretical - actual) * 1e6) / 1e6;
  return {
    difference,
    classification: difference < 0 ? 'Thừa kho' : difference > allowance ? 'Vượt mức' : 'Trong mức',
  };
}
