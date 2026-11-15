import type { Database, Movement } from '../domain/model';
const date = '2026-11-03T09:10:00+07:00';
const lines = [
  { materialId: 'NVL-001', quantity: 25 },
  { materialId: 'NVL-002', quantity: 20 },
  { materialId: 'NVL-003', quantity: 5 },
];
const movement = (
  id: string,
  branchId: string,
  status: Movement['status'],
  kind: Movement['kind'] = 'inbound',
  type: Movement['type'] = 'internal',
): Movement => ({
  id,
  branchId,
  status,
  kind,
  type,
  destinationId: type === 'transfer' ? 'st' : undefined,
  date,
  expectedDate: '2026-11-04',
  supplier: 'Cà phê Tây Nguyên',
  creator: 'Nguyễn Thị Hương',
  reason: type === 'transfer' ? 'Bổ sung kho' : 'Bổ sung quầy',
  note: 'Bổ sung nguyên liệu cho tuần đầu tháng 11.',
  lines: structuredClone(
    kind === 'inbound' ? lines : lines.map((l, i) => ({ ...l, quantity: [5, 4, 1][i] })),
  ),
});
export function seed(): Database {
  const recipes: Database['recipes'] = [
    'CÀ PHÊ SỮA MÁY',
    'CÀ PHÊ ĐEN MÁY',
    'LATTE/CAPPUCCINO',
    'BẠC XỈU CREAMY (Đá)',
    'BẠC XỈU COZY (Nóng)',
    'BẠC XỈU CREAMY',
    'ESPRESSO',
    'AMERICANO CAM',
    'HỒNG TRÀ TRÂN CHÂU ĐEN',
    'HỒNG TRÀ BƠ SỮA',
    'HỒNG TRÀ KHOAI TÍM',
    'HỒNG TRÀ CỐM DẺO',
  ].map((name, i) => ({
    id: `MON-${String(i + 1).padStart(3, '0')}`,
    name,
    category: i < 8 ? 'Espresso' : 'Trà sữa',
    version: 2,
    note: 'Định lượng cho một ly. Dữ liệu minh họa.',
    active: true,
    lines: [
      { materialId: 'NVL-002', quantity: 0.015 },
      { materialId: 'NVL-005', quantity: 0.1 },
    ],
    history: [
      {
        version: 2,
        date,
        approver: 'Bùi Đức Mạnh',
        lines: [
          { materialId: 'NVL-002', quantity: 0.015 },
          { materialId: 'NVL-005', quantity: 0.1 },
        ],
      },
    ],
  }));
  const materials: Database['materials'] = [
    {
      id: 'NVL-001',
      description: 'Hạt rang vừa, bảo quản kín, tránh ẩm.',
      name: 'Cà phê hạt Arabica',
      unit: 'kg',
      minimum: 20,
      allowance: 0.8,
      supplier: 'Cà phê Tây Nguyên',
      price: 280000,
      active: true,
    },
    {
      id: 'NVL-002',
      name: 'Cà phê hạt Robusta',
      unit: 'kg',
      minimum: 15,
      allowance: 0.6,
      supplier: 'Cà phê Tây Nguyên',
      price: 180000,
      active: true,
    },
    {
      id: 'NVL-003',
      name: 'Bột cacao',
      unit: 'kg',
      minimum: 5,
      allowance: 0.3,
      supplier: 'Cà phê Tây Nguyên',
      price: 150000,
      active: true,
    },
    {
      id: 'NVL-004',
      name: 'Sữa tươi không đường',
      unit: 'ml',
      minimum: 20000,
      allowance: 1200,
      supplier: 'Vinamilk - Đà Nẵng',
      price: 0.8,
      active: true,
    },
    {
      id: 'NVL-005',
      name: 'Sữa đặc',
      unit: 'lon',
      minimum: 10,
      allowance: 0.5,
      supplier: 'Vinamilk - Đà Nẵng',
      price: 25000,
      active: true,
    },
    {
      id: 'NVL-006',
      name: 'Siro đào',
      unit: 'ml',
      minimum: 0,
      allowance: 100,
      supplier: 'Đà Nẵng Food',
      price: 0.4,
      active: true,
    },
  ];
  const movements = [
    movement('PNK-0009', 'st', 'pending'),
    movement('PNK-0008', 'hc', 'receiving'),
    movement('PNK-0007', 'hc', 'backorder'),
    movement('PNK-0006', 'hc', 'completed'),
    movement('PNK-0005', 'st', 'completed'),
    movement('PNK-0004', 'hc', 'pending'),
    movement('PXK-0013', 'hc', 'pending', 'outbound', 'transfer'),
    movement('PXK-0012', 'hc', 'ready', 'outbound'),
    movement('PXK-0011', 'hc', 'completed', 'outbound'),
  ];
  recipes[0].size = 'M · 350 ml';
  recipes[0].note = 'Hòa tan sữa đặc trước khi thêm đá.';
  recipes[0].lines = [
    { materialId: 'NVL-002', quantity: 0.02 },
    { materialId: 'NVL-005', quantity: 0.05 },
  ];
  recipes[0].history = [
    {
      version: 1,
      date: '2026-09-01T09:00:00+07:00',
      approver: 'Bùi Đức Mạnh',
      note: 'Công thức khởi tạo',
      lines: [
        { materialId: 'NVL-002', quantity: 0.015 },
        { materialId: 'NVL-005', quantity: 0.05 },
      ],
    },
    {
      version: 2,
      date: '2026-10-20T10:15:00+07:00',
      approver: 'Bùi Đức Mạnh',
      note: 'Chuẩn hóa Robusta 0,020 kg',
      lines: structuredClone(recipes[0].lines),
    },
  ];
  const db: Database = {
    branches: [
      { id: 'hc', name: 'Trình - Hải Châu' },
      { id: 'st', name: 'Trình - Sơn Trà' },
      { id: 'tk', name: 'Trình - Thanh Khê' },
      { id: 'nhs', name: 'Trình - Ngũ Hành Sơn' },
      { id: 'lc', name: 'Trình - Liên Chiểu' },
    ],
    materials,
    recipes,
    movements,
    stocks: ['hc', 'st', 'tk'].flatMap((branchId, bi) =>
      materials
        .filter(
          (m, i) =>
            branchId === 'hc' ||
            (branchId === 'st' && [0, 1, 3, 4].includes(i)) ||
            (branchId === 'tk' && [1, 2, 4].includes(i)),
        )
        .map((m) => {
          const i = materials.findIndex((x) => x.id === m.id);
          const quantity =
            bi === 1 && i === 0 ? 8 : bi === 1 && i === 3 ? 24000 : [40, 32, 12, 18000, 24, 0][i];
          const inbound = bi === 1 && i === 0 ? 0 : [15, 12, 3, 10000, 0, 0][i];
          const outbound = bi === 1 && i === 0 ? 7 : [5, 4, 1, 16000, 10, 0][i];
          return {
            materialId: m.id,
            branchId,
            quantity,
            inbound,
            outbound,
            opening: quantity - inbound + outbound,
          };
        }),
    ),
    proposals: [
      {
        id: 'CT-0012',
        kind: 'recipe',
        branchId: 'hc',
        date,
        creator: 'Nguyễn Thị Hương',
        reason: 'Tăng lượng Robusta cho vị cà phê đậm hơn theo phản hồi khách hàng.',
        status: 'pending',
        targetId: 'MON-001',
        operation: 'update',
        beforeRecipe: structuredClone(recipes[0]),
        recipe: {
          ...structuredClone(recipes[0]),
          note: 'Tăng độ đậm, giữ 25–30 giây',
          lines: [
            { materialId: 'NVL-002', quantity: 0.025 },
            { materialId: 'NVL-005', quantity: 0.05 },
          ],
        },
      },
      {
        id: 'NVL-DC-0015',
        kind: 'material',
        branchId: 'hc',
        date,
        creator: 'Nguyễn Thị Hương',
        reason:
          'Tăng định mức dự trữ Arabica từ 20 lên 25 kg để phù hợp nhu cầu bán hàng đầu tháng.',
        status: 'pending',
        targetId: 'NVL-001',
        operation: 'update',
        beforeMaterial: structuredClone(materials[0]),
        material: { ...materials[0], minimum: 25 },
      },
      {
        id: 'DC-0024',
        kind: 'adjustment',
        branchId: 'hc',
        date,
        creator: 'Nguyễn Thị Hương',
        reason: 'Đối chiếu chênh lệch kiểm kê',
        status: 'pending',
        targetId: 'PKK-0006',
        operation: 'update',
        adjustments: [{ materialId: 'NVL-001', delta: -0.5 }],
      },
      ...movements
        .filter((m) => m.status === 'pending')
        .map((m) => ({
          id: `PD-${m.id}`,
          kind: 'movement' as const,
          branchId: m.branchId,
          date,
          creator: m.creator,
          reason: m.note,
          status: 'pending' as const,
          targetId: m.id,
          operation: 'create' as const,
        })),
    ],
    counts: [
      {
        id: 'PKK-0006',
        branchId: 'hc',
        date: '2026-11-02T20:30:00+07:00',
        period: '2026-11',
        creator: 'Nguyễn Minh Anh',
        note: 'Kiểm kê cuối ca',
        reason: 'Hao hụt khi bảo quản và lấy nguyên liệu.',
        remedy: 'Kiểm tra hộp kín, đề xuất điều chỉnh.',
        lines: [
          { materialId: 'NVL-001', theoretical: 40, actual: 39.5 },
          { materialId: 'NVL-002', theoretical: 32, actual: 32 },
          { materialId: 'NVL-003', theoretical: 12, actual: 12 },
        ],
      },
      ...['hc', 'st', 'tk'].map((branchId, i) => ({
        id: `PKK-00${i + 1}`,
        branchId,
        date: '2026-10-31T20:30:00+07:00',
        period: '2026-10',
        salesVersion: 'BH-' + branchId,
        creator: 'Nguyễn Minh Anh',
        note: 'Kiểm kê cuối kỳ',
        reason: 'Đối soát cuối kỳ',
        remedy: 'Kiểm tra bảo quản',
        lines:
          i === 0
            ? [
                { materialId: 'NVL-001', theoretical: 40, actual: 39.5 },
                { materialId: 'NVL-002', theoretical: 32, actual: 30 },
              ]
            : i === 1
              ? [{ materialId: 'NVL-004', theoretical: 24000, actual: 22000 }]
              : [{ materialId: 'NVL-003', theoretical: 12, actual: 11.8 }],
      })),
    ],
    sales: ['hc', 'st', 'tk'].map((branchId) => ({
      id: `BH-${branchId}`,
      branchId,
      period: '2026-10',
      filename: 'ban-hang-thang-10.xlsx',
      date,
      lines: [{ recipeId: 'MON-001', quantity: 100 }],
      consumption: [
        { materialId: 'NVL-002', quantity: 1.5 },
        { materialId: 'NVL-005', quantity: 5 },
      ],
    })),
    audit: [],
  };
  db.stockSnapshots = [{ date, stocks: structuredClone(db.stocks) }];
  return db;
}
