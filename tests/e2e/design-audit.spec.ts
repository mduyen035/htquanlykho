import { test, expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
async function login(page: Page, username = 'buiducmanh') {
  await page.goto('/');
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill(username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Trinh@123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('Tổng quan');
  await page.evaluate(() => document.fonts.ready);
}
async function shot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `test-results/audit/${name}.png`, fullPage: true });
  expect(await page.locator('body').evaluate((el) => el.scrollWidth <= innerWidth)).toBeTruthy();
}
test('owner screen inventory and full-page drill downs match design structure', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  await shot(page, 'owner-dashboard');
  for (const path of [
    'materials',
    'inbound',
    'outbound',
    'counts',
    'recipes',
    'sales',
    'stock-report',
    'loss-report',
    'approvals/adjustment',
    'approvals/movement',
    'approvals/recipe',
    'approvals/material',
  ]) {
    await page.goto('/' + path);
    await expect(page.locator('main h1')).toBeVisible();
    await shot(page, path.replaceAll('/', '-'));
  }
  for (const [path, id] of [
    ['materials', 'NVL-001'],
    ['inbound', 'PNK-0008'],
    ['outbound', 'PXK-0012'],
    ['counts', 'PKK-0006'],
    ['approvals/adjustment', 'DC-0024'],
    ['approvals/movement', 'PD-PNK-0009'],
    ['approvals/recipe', 'CT-0012'],
    ['approvals/material', 'NVL-DC-0015'],
  ]) {
    await page.goto(`/${path}?screen=detail&id=${id}`);
    await expect(page.locator('.feature-screen')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await shot(page, `${path.replaceAll('/', '-')}-detail`);
    await page.getByRole('button', { name: '← Danh sách', exact: true }).click();
    await expect(page.locator('.feature-screen')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
test('creation, editing, confirmation and recipe states use the specified surface', async ({
  page,
}) => {
  test.setTimeout(120000);
  await login(page);
  await page.goto('/materials');
  await page.getByRole('button', { name: '+ Thêm nguyên vật liệu', exact: true }).click();
  await shot(page, 'material-create');
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page
    .locator('tbody tr')
    .filter({ hasText: 'NVL-001' })
    .getByRole('button', { name: 'Sửa', exact: true })
    .click();
  await shot(page, 'material-edit');
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  for (const [kind, id] of [
    ['inbound', 'PNK-0009'],
    ['outbound', 'PXK-0013'],
  ]) {
    await page.goto(`/${kind}?screen=edit&id=${id}`);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await shot(page, `${kind}-edit`);
    await page.goto(`/${kind}?screen=create`);
    await expect(page.locator('.feature-screen')).toBeVisible();
    await shot(page, `${kind}-create`);
  }
  await page.goto('/inbound?screen=record&id=PNK-0008');
  await shot(page, 'inbound-record');
  await page.goto('/outbound?screen=record&id=PXK-0012');
  await shot(page, 'outbound-record');
  await page.getByLabel('Trạng thái xử lý', { exact: true }).selectOption('incident');
  await expect(page.getByRole('button', { name: 'Lưu thông tin', exact: true })).toBeDisabled();
  await shot(page, 'outbound-incident');
  await page.goto('/recipes');
  await page.getByRole('button', { name: 'MON-001', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lịch sử phê duyệt' })).toBeVisible();
  await shot(page, 'recipe-detail');
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('button', { name: '+ Thiết lập công thức mới', exact: true }).click();
  await shot(page, 'recipe-create');
});
test('manager and employee dashboards are separate and counting remains blind', async ({
  page,
}) => {
  test.setTimeout(120000);
  await login(page, 'nguyenthihuong');
  await expect(page.getByRole('heading', { name: 'Công việc ưu tiên' })).toBeVisible();
  await shot(page, 'manager-dashboard');
  await page.goto('/counts');
  await page.getByRole('button', { name: '+ Tạo phiếu kiểm kê', exact: true }).click();
  await expect(page.locator('.feature-screen')).toBeVisible();
  for (const [name, quantity] of [
    ['Cà phê hạt Arabica', '39.5'],
    ['Cà phê hạt Robusta', '32'],
    ['Bột cacao', '12'],
    ['Sữa tươi không đường', '18000'],
    ['Sữa đặc', '24'],
    ['Siro đào', '0'],
  ])
    await page.getByLabel(`Thực tế ${name}`, { exact: true }).fill(quantity);
  await expect(page.getByRole('button', { name: 'Lưu thông tin', exact: true })).toBeDisabled();
  await page
    .getByLabel('Nguyên nhân NVL-001 *', { exact: true })
    .fill('Hao hụt khi bảo quản và lấy nguyên liệu.');
  await page
    .getByLabel('Biện pháp xử lý NVL-001 *', { exact: true })
    .fill('Kiểm tra hộp kín, đề xuất điều chỉnh −0,5 kg.');
  await expect(page.getByRole('button', { name: 'Lưu thông tin', exact: true })).toBeEnabled();
  await shot(page, 'manager-count-create');
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await login(page, 'nguyenminhanh');
  await expect(page.getByRole('heading', { name: 'Công việc được giao' })).toBeVisible();
  await shot(page, 'staff-dashboard');
  await page.goto('/counts');
  await page.getByRole('button', { name: '+ Tạo phiếu kiểm kê', exact: true }).click();
  await expect(page.locator('.feature-screen')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Tồn hệ thống', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole('columnheader', { name: 'Chênh lệch', exact: true })).toHaveCount(0);
  await expect(page.getByLabel(/Nguyên nhân/)).toHaveCount(0);
  await shot(page, 'staff-count-create');
  for (const [name, quantity] of [
    ['Cà phê hạt Arabica', '39'],
    ['Cà phê hạt Robusta', '32'],
    ['Bột cacao', '12'],
    ['Sữa tươi không đường', '18000'],
    ['Sữa đặc', '24'],
    ['Siro đào', '0'],
  ])
    await page.getByLabel(`Thực tế ${name}`, { exact: true }).fill(quantity);
  await page.getByRole('button', { name: 'Lưu thông tin', exact: true }).click();
  await expect(page.locator('.feature-screen')).toHaveCount(0);
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('trinh-inventory-v1')!));
  expect(data.counts[0].handlingStatus).toBe('pendingHandling');
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await login(page, 'nguyenthihuong');
  await page.goto(`/counts?screen=detail&id=${data.counts[0].id}`);
  await expect(
    page.getByRole('button', { name: 'Gửi đề xuất điều chỉnh', exact: true }),
  ).toBeDisabled();
  await shot(page, 'manager-count-handling');
});
test('sales preview covers quarter, missing recipes and validation errors', async ({ page }) => {
  await login(page);
  await page.goto('/sales');
  await page.getByLabel('Loại kỳ', { exact: true }).selectOption('quarter');
  await expect(page.getByLabel('Kỳ báo cáo', { exact: true }).locator('option')).toHaveCount(4);
  await shot(page, 'sales-quarter');
  const book = new ExcelJS.Workbook();
  book.addWorksheet('Sales').addRows([
    ['Mã món', 'Tên món', 'Số lượng bán'],
    ['MON-001', 'CÀ PHÊ SỮA MÁY', 100],
    ['UNKNOWN', 'Trà đào', 50],
  ]);
  await page.locator('input[type=file]').setInputFiles({
    name: 'sales.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await book.xlsx.writeBuffer()),
  });
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Kết quả tiêu hao nguyên vật liệu lý thuyết', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.invalid-row')).toContainText('Trà đào');
  await shot(page, 'sales-preview-missing');
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  const bad = new ExcelJS.Workbook();
  bad.addWorksheet('Sales').addRows([['Tên món'], ['Cà phê']]);
  await page.locator('input[type=file]').setInputFiles({
    name: 'bad.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await bad.xlsx.writeBuffer()),
  });
  await expect(page.getByRole('alert')).toContainText('Định dạng dữ liệu không hợp lệ');
  await expect(page.getByRole('button', { name: 'Tiếp tục', exact: true })).toBeDisabled();
  await shot(page, 'sales-invalid');
});
test('login shows both specified error states while retaining typed credentials', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Hãy nhập đầy đủ thông tin!');
  await shot(page, 'login-empty');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('xxxx Tên đăng nhập hoặc mật khẩu không đúng');
  await expect(page.getByLabel('Tên đăng nhập', { exact: true })).toHaveValue('buiducmanh');
  await shot(page, 'login-wrong');
});
