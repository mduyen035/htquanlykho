export type Role = 'owner' | 'manager' | 'staff';
export interface User {
  id: string;
  name: string;
  role: Role;
  branchId: string;
}
export interface Branch {
  id: string;
  name: string;
}
export type Status =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'receiving'
  | 'backorder'
  | 'ready'
  | 'completed'
  | 'incident'
  | 'deleted';
export interface Material {
  id: string;
  name: string;
  unit: string;
  minimum: number;
  allowance: number;
  supplier: string;
  active: boolean;
  price: number;
  description?: string;
}
export interface Stock {
  materialId: string;
  branchId: string;
  opening: number;
  inbound: number;
  outbound: number;
  quantity: number;
  adjustment?: number;
}
export interface Line {
  materialId: string;
  quantity: number;
  received?: number;
  defective?: number;
  reason?: string;
}
export interface Movement {
  id: string;
  kind: 'inbound' | 'outbound';
  branchId: string;
  destinationId?: string;
  supplier: string;
  type: 'internal' | 'transfer';
  reason: string;
  note: string;
  date: string;
  expectedDate: string;
  creator: string;
  status: Status;
  incidentReason?: string;
  lines: Line[];
}
export interface Recipe {
  id: string;
  name: string;
  category: string;
  size?: string;
  version: number;
  note: string;
  active: boolean;
  lines: Line[];
  history: { version: number; date: string; approver: string; lines: Line[]; note?: string }[];
}
export interface Count {
  id: string;
  branchId: string;
  date: string;
  period: string;
  salesVersion?: string;
  draftId?: string;
  handlingStatus?: 'pendingHandling' | 'pendingApproval' | 'complete';
  creator: string;
  note: string;
  reason: string;
  remedy: string;
  lines: {
    materialId: string;
    actual: number;
    theoretical: number;
    reason?: string;
    remedy?: string;
  }[];
}
export interface CountDraft {
  id: string;
  branchId: string;
  creatorId: string;
  createdAt: string;
  lines: { materialId: string; theoretical: number }[];
}
export type ProposalKind = 'adjustment' | 'movement' | 'recipe' | 'material';
export interface Proposal {
  id: string;
  kind: ProposalKind;
  branchId: string;
  date: string;
  creator: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  targetId: string;
  operation: 'create' | 'update' | 'delete';
  material?: Material;
  beforeMaterial?: Material;
  recipe?: Recipe;
  beforeRecipe?: Recipe;
  adjustments?: { materialId: string; delta: number; theoretical?: number; reason?: string }[];
  decisionReason?: string;
  decidedBy?: string;
  decidedAt?: string;
}
export interface Sales {
  id: string;
  branchId: string;
  period: string;
  filename: string;
  date: string;
  lines: { recipeId: string; quantity: number; name?: string }[];
  missingRecipeIds?: string[];
  consumption: { materialId: string; quantity: number }[];
}
export interface Audit {
  id: string;
  date: string;
  actor: string;
  action: string;
  targetId: string;
  before: string;
  after: string;
}
export interface Database {
  branches: Branch[];
  materials: Material[];
  stocks: Stock[];
  movements: Movement[];
  recipes: Recipe[];
  proposals: Proposal[];
  counts: Count[];
  sales: Sales[];
  audit: Audit[];
  countDrafts?: CountDraft[];
  stockSnapshots?: { date: string; stocks: Stock[] }[];
}
export const roles: Record<Role, string> = {
  owner: 'Chủ cửa hàng',
  manager: 'Quản lý',
  staff: 'Nhân viên',
};
export const statuses: Record<Status, string> = {
  pending: 'Chờ phê duyệt',
  approved: 'Đã phê duyệt',
  rejected: 'Từ chối',
  receiving: 'Chờ kiểm hàng',
  backorder: 'Chờ giao bù',
  ready: 'Chờ xuất kho',
  completed: 'Hoàn thành',
  incident: 'Có sự cố',
  deleted: 'Đã xóa',
};
export const proposalNames: Record<ProposalKind, string> = {
  adjustment: 'Điều chỉnh tồn kho',
  movement: 'Kế hoạch Xuất/Nhập Hàng',
  recipe: 'Thay đổi công thức',
  material: 'Thay đổi nguyên vật liệu',
};
