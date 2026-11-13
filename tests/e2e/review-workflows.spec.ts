import { test, expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill('buiducmanh');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Trinh@123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('Tổng quan');
}
test('rejection requires a reason and leaves a read-only decision on the detail page', async ({
  page,
}) => {
  await login(page);
  await page.goto('/approvals/adjustment?screen=detail&id=DC-0024');
  await page.getByRole('button', { name: 'Từ chối', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Xác nhận', exact: true })).toBeDisabled();
  await page.screenshot({ path: 'test-results/audit/approval-rejection.png', fullPage: true });
  await page
    .getByLabel('Lý do từ chối *', { exact: true })
    .fill('Cần kiểm tra lại biên bản kiểm kê.');
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.feature-screen')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Quyết định phê duyệt', exact: true }),
  ).toBeVisible();
  await expect(page.locator('main')).toContainText('Cần kiểm tra lại biên bản kiểm kê.');
  await expect(page.getByRole('button', { name: 'Đồng ý', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/audit/approval-rejected.png', fullPage: true });
});
test('quarter replacement explicitly confirms removal of overlapping months', async ({ page }) => {
  await login(page);
  await page.goto('/sales');
  await page.getByLabel('Loại kỳ', { exact: true }).selectOption('quarter');
  const book = new ExcelJS.Workbook();
  book.addWorksheet('Sales').addRows([
    ['MaMon', 'SoLuong'],
    ['MON-001', 30],
  ]);
  await page.locator('input[type=file]').setInputFiles({
    name: 'quarter.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await book.xlsx.writeBuffer()),
  });
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Tháng 10/2026');
  await expect(page.getByRole('dialog')).toContainText('thay thế toàn bộ');
  await page.screenshot({
    path: 'test-results/audit/sales-overlap-confirmation.png',
    fullPage: true,
  });
  await page.getByRole('dialog').getByRole('button', { name: 'Hủy', exact: true }).click();
  let data = await page.evaluate(() => JSON.parse(localStorage.getItem('trinh-inventory-v1')!));
  expect(
    data.sales.some(
      (s: { branchId: string; period: string }) => s.branchId === 'hc' && s.period === '2026-10',
    ),
  ).toBeTruthy();
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await page.getByRole('button', { name: 'Ghi đè', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  data = await page.evaluate(() => JSON.parse(localStorage.getItem('trinh-inventory-v1')!));
  expect(
    data.sales
      .filter((s: { branchId: string }) => s.branchId === 'hc')
      .map((s: { period: string }) => s.period),
  ).toEqual(['2026-Q4']);
  expect(
    data.stocks.find(
      (s: { branchId: string; materialId: string }) =>
        s.branchId === 'hc' && s.materialId === 'NVL-002',
    ).quantity,
  ).toBeCloseTo(32.9);
});
