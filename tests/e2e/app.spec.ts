import { test, expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
async function login(page: Page, account = 'buiducmanh') {
  await page.goto('/');
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill(account);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Trinh@123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan', exact: true })).toBeVisible();
}
test('owner can search and create materials without an approval step', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Nguyên vật liệu', exact: true }).click();
  await page.getByLabel('Tìm kiếm', { exact: true }).fill('Arabica');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByLabel('Tìm kiếm', { exact: true }).fill('');
  await page.getByRole('button', { name: '+ Thêm nguyên vật liệu', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tên nguyên vật liệu *', { exact: true }).fill('Trà sen thử nghiệm');
  await dialog.getByLabel('Nhà cung cấp *').fill('Nhà cung cấp demo');
  await dialog.getByLabel('Đơn vị *', { exact: true }).fill('kg');
  await dialog.getByRole('button', { name: 'Lưu thông tin' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('thành công');
  await expect(page.locator('tbody')).toContainText('Trà sen thử nghiệm');
  await expect(page.locator('tbody tr').filter({ hasText: 'Trà sen thử nghiệm' })).toContainText(
    'Đang sử dụng',
  );
});
test('role restrictions and blind staff count survive direct navigation', async ({ page }) => {
  await login(page, 'nguyenminhanh');
  await expect(page.getByRole('link', { name: 'Dữ liệu bán hàng', exact: true })).toHaveCount(0);
  await page.goto('/approvals/adjustment');
  await expect(page.getByRole('heading', { name: 'Tổng quan', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Kiểm kê định kỳ', exact: true }).click();
  await page.getByRole('button', { name: '+ Tạo phiếu kiểm kê' }).click();
  await expect(page.getByRole('columnheader', { name: 'Tồn hệ thống' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Chênh lệch', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Chi nhánh', { exact: true }).last().locator('option')).toHaveCount(
    1,
  );
});
test('renders desktop routes and original assets without browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  for (const route of [
    'materials',
    'inbound',
    'outbound',
    'counts',
    'recipes',
    'sales',
    'loss-report',
    'stock-report',
    'approvals/adjustment',
    'approvals/movement',
    'approvals/recipe',
    'approvals/material',
  ]) {
    await page.goto(`/${route}`);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Đang tải' })).toHaveCount(0);
    expect(await page.locator('body').evaluate((el) => el.scrollWidth <= innerWidth)).toBeTruthy();
  }
  await page.goto('/materials');
  await expect(page.locator('tbody tr')).toHaveCount(6);
  const geometry = await page.locator('.brand img').evaluate((img: HTMLImageElement) => ({
    width: img.getBoundingClientRect().width,
    height: img.getBoundingClientRect().height,
    loaded: img.naturalWidth > 0,
  }));
  expect(geometry).toEqual({ width: 96, height: 96, loaded: true });
  await page.screenshot({ path: 'test-results/previews/materials-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('exports xlsx and displays missing-data state', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Báo cáo hao hụt', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất báo cáo' }).click();
  expect((await download).suggestedFilename()).toBe('bao-cao-hao-hut.xlsx');
  await page.getByLabel('Kỳ báo cáo', { exact: true }).selectOption('2026-12');
  await page.getByRole('button', { name: 'Xem báo cáo' }).click();
  await expect(page.locator('.report-panel')).toContainText('Chưa đủ dữ liệu');
});
test('mobile navigation and dialogs fit a small viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByRole('button', { name: 'Mở menu' }).click();
  await page.getByRole('link', { name: 'Nguyên vật liệu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nguyên vật liệu', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '+ Thêm nguyên vật liệu', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.locator('body').evaluate((el) => el.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: 'test-results/previews/materials-mobile.png', fullPage: true });
});
test('imports a real xlsx, previews it and overwrites without double consumption', async ({
  page,
}) => {
  await login(page);
  await page.goto('/sales');
  await page.getByLabel('Kỳ báo cáo', { exact: true }).selectOption('11');
  async function upload(quantity: number) {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Sales');
    sheet.addRows([
      ['MaMon', 'SoLuong'],
      ['MON-001', quantity],
    ]);
    const buffer = Buffer.from(await book.xlsx.writeBuffer());
    await page.locator('input[type=file]').setInputFiles({
      name: 'ban-hang.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Thông tin kỳ đối soát' })).toBeVisible();
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  }
  await upload(20);
  await expect(page.getByRole('status')).toContainText('Lưu dữ liệu thành công');
  await upload(10);
  await page.getByRole('button', { name: 'Ghi đè', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('thành công');
  await page.goto('/materials');
  const row = page.locator('tbody tr').filter({ hasText: 'NVL-002' });
  await expect(row).toContainText('31,8');
});
test('receives an approved purchase and persists only newly received stock', async ({ page }) => {
  await login(page);
  await page.goto('/inbound');
  await page.getByRole('button', { name: 'PNK-0008', exact: true }).click();
  await page.getByRole('button', { name: 'Ghi nhận nhập kho', exact: true }).click();
  for (const [name, quantity] of [
    ['Cà phê hạt Arabica', '25'],
    ['Cà phê hạt Robusta', '20'],
    ['Bột cacao', '5'],
  ]) {
    await page.getByLabel(`Thực nhận ${name}`, { exact: true }).fill(quantity);
    await page.getByLabel(`Số lượng lỗi ${name}`, { exact: true }).fill('0');
  }
  await page.getByRole('button', { name: 'Lưu thông tin', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Ghi nhận trạng thái nhập kho thành công');
  await page.goto('/materials');
  await expect(page.locator('tbody tr').filter({ hasText: 'NVL-001' })).toContainText('65');
});
test('checks every local design asset at its rendered slot', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.login-logo')).toBeVisible();
  const loginAsset = await page.locator('.login-logo').evaluate((img: HTMLImageElement) => ({
    loaded: img.naturalWidth > 0,
    width: img.getBoundingClientRect().width,
    height: img.getBoundingClientRect().height,
  }));
  expect(loginAsset).toEqual({ loaded: true, width: 128, height: 128 });
  const backgroundLoaded = await page.locator('.login-page').evaluate(async (el) => {
    const url = getComputedStyle(el).backgroundImage.slice(5, -2);
    const img = new Image();
    img.src = url;
    await img.decode();
    return img.naturalWidth > 0;
  });
  expect(backgroundLoaded).toBeTruthy();
  await page.screenshot({ path: 'test-results/previews/login-desktop.png', fullPage: true });
  await login(page);
  await page.goto('/materials');
  await expect(page.locator('tbody tr')).toHaveCount(6);
  const assets = await page.locator('img').evaluateAll((imgs) =>
    imgs.map((img) => ({
      src: img.getAttribute('src'),
      loaded: (img as HTMLImageElement).naturalWidth > 0,
      width: img.getBoundingClientRect().width,
      height: img.getBoundingClientRect().height,
    })),
  );
  expect(assets.every((a) => a.loaded)).toBeTruthy();
  for (const asset of assets) {
    if (asset.src?.endsWith('chevron.svg')) expect([asset.width, asset.height]).toEqual([24, 24]);
    if (asset.src?.endsWith('edit.svg') || asset.src?.endsWith('trash.svg'))
      expect([asset.width, asset.height]).toEqual([17, 17]);
  }
  await page.screenshot({ path: 'test-results/previews/materials-desktop.png', fullPage: true });
});
