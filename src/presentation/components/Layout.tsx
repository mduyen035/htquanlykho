import { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../../app/context';
import { roles } from '../../domain/model';
const titles: Record<string, string> = {
  '/': 'Tổng quan',
  '/materials': 'Quản lý kho hàng › Nguyên vật liệu',
  '/inbound': 'Nhập kho › Quản lý nhập kho',
  '/outbound': 'Xuất kho › Quản lý xuất kho',
  '/counts': 'QUẢN LÝ KHO HÀNG › Kiểm kê định kỳ',
  '/recipes': 'Chủ cửa hàng › Công thức món',
  '/sales': 'Dữ liệu bán hàng',
  '/loss-report': 'Báo cáo hao hụt',
  '/stock-report': 'Báo cáo tồn kho',
  '/approvals/adjustment': 'Phê duyệt › Điều chỉnh tồn kho',
  '/approvals/movement': 'Phê duyệt › Kế hoạch xuất - nhập hàng',
  '/approvals/recipe': 'Phê duyệt › Thay đổi công thức',
  '/approvals/material': 'Phê duyệt › Thay đổi nguyên vật liệu',
};
export function Layout() {
  const { user, db, loading, error, reload, logout, notice, notify, viewBranch } = useApp();
  const { pathname, search } = useLocation();
  const params = new URLSearchParams(search);
  const screen = params.get('screen');
  const screenNames: Record<string, string> = {
    create:
      pathname === '/counts'
        ? 'Tạo phiếu kiểm kê'
        : `Tạo phiếu ${pathname === '/inbound' ? 'nhập' : 'xuất'} kho`,
    detail:
      pathname === '/materials'
        ? 'Chi tiết nguyên vật liệu'
        : pathname === '/counts'
          ? 'Chi tiết phiếu kiểm kê'
          : pathname.startsWith('/approvals')
            ? `Đề xuất ${params.get('id')}`
            : `Chi tiết phiếu ${pathname === '/inbound' ? 'nhập' : 'xuất'} kho`,
    edit: `Sửa phiếu ${pathname === '/inbound' ? 'nhập' : 'xuất'} kho`,
    record: pathname === '/inbound' ? 'Ghi nhận nhập kho' : 'Xác nhận xuất kho',
  };
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);
  const [mobile, setMobile] = useState(false);
  const [warehouse, setWarehouse] = useState(true);
  const [approval, setApproval] = useState(true);
  const link = (path: string, name: string, sub = false) => (
    <NavLink
      end
      to={path}
      className={({ isActive }) => `${sub ? 'sub ' : ''}${isActive ? 'active' : ''}`}
      onClick={() => setMobile(false)}
    >
      {name}
    </NavLink>
  );
  return (
    <div className="app-shell">
      <a className="skip" href="#main">
        Đến nội dung chính
      </a>
      {mobile && (
        <button
          aria-label="Đóng menu"
          className="sidebar-overlay"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={mobile ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <img src="/assets/logo-white.png" alt="Trình Cà Phê" />
        </div>
        <nav aria-label="Điều hướng chính">
          {link('/', 'Tổng Quan')}
          <button
            className="nav-group"
            onClick={() => setWarehouse(!warehouse)}
            aria-expanded={warehouse}
          >
            QUẢN LÝ KHO HÀNG
            <img src="/assets/chevron.svg" alt="" />
          </button>
          {warehouse && (
            <>
              {link('/materials', 'Nguyên vật liệu', true)}
              {link('/inbound', 'Nhập kho', true)}
              {link('/outbound', 'Xuất kho', true)}
              {link('/counts', 'Kiểm kê định kỳ', true)}
            </>
          )}
          {user!.role === 'owner' && (
            <>
              <button
                className="nav-group"
                onClick={() => setApproval(!approval)}
                aria-expanded={approval}
              >
                PHÊ DUYỆT
                <img src="/assets/chevron.svg" alt="" />
              </button>
              {approval && (
                <>
                  {link('/approvals/movement', 'Kế hoạch Xuất/Nhập Hàng', true)}
                  {link('/approvals/adjustment', 'Điều chỉnh tồn kho', true)}
                  {link('/approvals/recipe', 'Thay đổi công thức', true)}
                  {link('/approvals/material', 'Thay đổi nguyên vật liệu', true)}
                </>
              )}
            </>
          )}
          {user!.role !== 'staff' && (
            <>
              {link('/recipes', 'Công thức món')}
              {link('/sales', 'Dữ liệu bán hàng')}
              {link('/loss-report', 'Báo cáo hao hụt')}
              {link('/stock-report', 'Báo cáo tồn kho')}
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <button
            onClick={() => {
              void logout();
            }}
          >
            Đăng xuất
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Mở menu" onClick={() => setMobile(true)}>
            ☰
          </button>
          <nav className="breadcrumb" aria-label="Đường dẫn trang">
            {/* <Link to="/">{roles[user!.role]}</Link> */}
            <span aria-hidden="true"> </span>
            {pathname === '/' ? (
              <Link to="/">Tổng quan</Link>
            ) : (
              <>
                <Link to={pathname}>
                  {(titles[pathname] || titles['/']).replace(/^Chủ cửa hàng › /, '')}
                </Link>
                {screen && screenNames[screen] && (
                  <>
                    {/* <span aria-hidden="true"> › </span> */}
                    <span aria-current="page">{screenNames[screen]}</span>
                  </>
                )}
              </>
            )}
          </nav>
          <div className="account">
            <span className="scope">
              {user!.role === 'owner'
                ? db?.branches.find(
                    (b) => b.id === (viewBranch.path === pathname ? viewBranch.id : 'all'),
                  )?.name || 'Tất cả chi nhánh'
                : db?.branches.find((b) => b.id === user!.branchId)?.name}
            </span>
            <span>
              <strong>{user!.name}</strong>
              <small>{roles[user!.role]}</small>
            </span>
            <span className="avatar">
              {user!.role === 'staff'
                ? user!.name
                    .split(' ')
                    .slice(-2)
                    .map((w) => w[0])
                    .join('')
                : user!.name.split(' ')[0][0] + user!.name.split(' ').at(-1)![0]}
            </span>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {loading ? (
            <div className="loading" role="status">
              <span className="spinner" />
              Đang tải dữ liệu…
            </div>
          ) : error ? (
            <div className="error" role="alert">
              <h2>Không tải được dữ liệu</h2>
              <p>{error}</p>
              <button onClick={() => void reload()}>Thử lại</button>
            </div>
          ) : (
            db && <Outlet />
          )}
        </main>
      </div>
      {notice && (
        <div role="status" className={`toast ${notice.startsWith('Lỗi:') ? 'error-toast' : ''}`}>
          {notice}
          <button aria-label="Đóng thông báo" onClick={() => notify('')}>
            ✓
          </button>
        </div>
      )}
    </div>
  );
}
