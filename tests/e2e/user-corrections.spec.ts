import { test, expect, type Page } from '@playwright/test';
async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill('buiducmanh');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Trinh@123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('Tổng quan');
}
test('branch label follows filters and breadcrumbs return home', async ({ page }) => {
  await login(page);
  await page.getByLabel('Chi nhánh', { exact: true }).selectOption('st');
  await expect(page.locator('.account .scope')).toHaveText('Trình - Sơn Trà');
  await page.getByLabel('Chi nhánh', { exact: true }).selectOption('all');
  await expect(page.locator('.account .scope')).toHaveText('Tất cả chi nhánh');
  await page.goto('/materials');
  await page.getByLabel('Chi nhánh', { exact: true }).selectOption('tk');
  await expect(page.locator('.account .scope')).toHaveText('Trình - Thanh Khê');
  await page.getByRole('button', { name: 'NVL-001', exact: true }).click();
  await expect(page.locator('.account .scope')).toHaveText('Trình - Thanh Khê');
  await page
    .getByRole('navigation', { name: 'Đường dẫn trang' })
    .getByRole('link', { name: 'Chủ cửa hàng', exact: true })
    .click();
  await expect(page.locator('main h1')).toHaveText('Tổng quan');
  await page
    .getByRole('navigation', { name: 'Đường dẫn trang' })
    .getByRole('link', { name: 'Tổng quan', exact: true })
    .click();
  await expect(page.locator('main h1')).toHaveText('Tổng quan');
});
test('expanded sidebar fits desktop heights, logout is centered and navigation stays while scrolling', async ({
  page,
}) => {
  await login(page);
  await page.goto('/recipes');
  for (const height of [900, 768, 650]) {
    await page.setViewportSize({ width: 1440, height });
    const metrics = await page.locator('.sidebar').evaluate((el) => {
      const nav = el.querySelector('nav')!,
        logout = el.querySelector('.sidebar-footer button')!.getBoundingClientRect(),
        box = el.getBoundingClientRect();
      return {
        overflow: nav.scrollHeight - nav.clientHeight,
        center: Math.abs(logout.left + logout.width / 2 - (box.left + box.width / 2)),
        bottom: logout.bottom,
        height: innerHeight,
      };
    });
    expect(metrics.overflow).toBeLessThanOrEqual(1);
    expect(metrics.center).toBeLessThan(2);
    expect(metrics.bottom).toBeLessThanOrEqual(metrics.height);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect
      .poll(() =>
        page.locator('.topbar').evaluate((el) => Math.round(el.getBoundingClientRect().top)),
      )
      .toBe(0);
    expect(await page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().top)).toBe(0);
    await page.screenshot({ path: `test-results/audit/navigation-${height}.png`, fullPage: false });
  }
});
test('recipe creation uses add-material button, saves immediately and deletion requires reason', async ({
  page,
}) => {
  await login(page);
  await page.goto('/recipes');
  await page.getByLabel('Tìm kiếm', { exact: true }).fill('NO-MATCH');
  await expect(page.locator('.empty-state')).toHaveText(
    'Không tìm thấy dữ liệu món đồ uống phù hợp.',
  );
  await expect(page.getByRole('img', { name: 'Không có kết quả tìm kiếm' })).toBeVisible();
  await page.screenshot({ path: 'test-results/audit/recipe-empty.png' });
  await page.getByLabel('Tìm kiếm', { exact: true }).fill('');
  await page.getByRole('button', { name: '+ Thiết lập công thức mới', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Thiết lập công thức mới', exact: true });
  await expect(form.getByRole('combobox', { name: 'Chọn nguyên vật liệu' })).toHaveCount(0);
  await form.getByLabel('Tên món *', { exact: true }).fill('Món chủ cửa hàng mới');
  await form.getByRole('button', { name: '+ Thêm nguyên vật liệu', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Thêm nguyên vật liệu', exact: true });
  await picker.getByLabel('Nguyên vật liệu *', { exact: true }).selectOption('NVL-001');
  await picker.getByRole('button', { name: 'Thêm nguyên vật liệu', exact: true }).click();
  await expect(form.locator('tbody')).toContainText('Cà phê hạt Arabica');
  await page.screenshot({ path: 'test-results/audit/recipe-new-button.png' });
  await form.getByRole('button', { name: 'Lưu thông tin', exact: true }).click();
  await expect(form).toHaveCount(0);
  const row = page.locator('tbody tr').filter({ hasText: 'Món chủ cửa hàng mới' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Xóa', exact: true }).click();
  const confirm = page.getByRole('dialog');
  await expect(confirm.getByRole('button', { name: 'Xác nhận', exact: true })).toBeDisabled();
  await confirm.getByLabel('Lý do xóa *', { exact: true }).fill('   ');
  await expect(confirm.getByRole('button', { name: 'Xác nhận', exact: true })).toBeDisabled();
  await confirm.getByLabel('Lý do xóa *', { exact: true }).fill('Ngừng bán món thử');
  await confirm.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(row).toHaveCount(0);
});
