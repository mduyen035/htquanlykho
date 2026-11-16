import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { z } from 'zod';
import type { Database, Role, User } from '../domain/model';
import type { Command } from '../application/ports';
import { repository, isMock, http } from './container';
import { TOKEN_KEY } from '../infrastructure/repositories';
const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['owner', 'manager', 'staff']),
  branchId: z.string(),
});
const accounts: Record<string, User> = {
  buiducmanh: { id: '1', name: 'Bùi Đức Mạnh', role: 'owner', branchId: 'hc' },
  nguyenthihuong: { id: '2', name: 'Nguyễn Thị Hương', role: 'manager', branchId: 'hc' },
  nguyenminhanh: { id: '3', name: 'Nguyễn Minh Anh', role: 'staff', branchId: 'hc' },
};
interface Context {
  viewBranch: { path: string; id: string };
  setViewBranch: (scope: { path: string; id: string }) => void;
  user: User | null;
  db: Database | null;
  loading: boolean;
  busy: boolean;
  error: string;
  notice: string;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  run: (command: Command, message?: string) => Promise<boolean>;
  notify: (text: string) => void;
}
const AppContext = createContext<Context | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [viewBranch, setViewBranch] = useState({ path: '', id: 'all' });
  const [user, setUser] = useState<User | null>(() => {
    try {
      const parsed = userSchema.safeParse(
        JSON.parse(sessionStorage.getItem('trinh-user') || 'null'),
      );
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  });
  const [db, setDb] = useState<Database | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, notify] = useState('');
  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setDb(await repository.load());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (user) {
      if (!isMock) {
        void http
          .request('/auth/me')
          .then(() => reload())
          .catch(() => {
            sessionStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem('trinh-user');
            setUser(null);
          });
      } else void reload();
    }
  }, [user, reload]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => notify(''), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  async function login(username: string, password: string) {
    setBusy(true);
    try {
      let loggedIn: User;
      if (isMock) {
        if (!accounts[username] || password !== 'Trinh@123')
          throw new Error('x Tên đăng nhập hoặc mật khẩu không đúng.');
        loggedIn = accounts[username];
        sessionStorage.setItem('trinh-user', JSON.stringify(loggedIn));
      } else {
        const result = (await http.request('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        })) as {
          token: string;
          user: { id: string; name: string; role: string; branchIds: string[] };
        };
        sessionStorage.setItem(TOKEN_KEY, result.token);
        loggedIn = userSchema.parse({
          id: result.user.id,
          name: result.user.name,
          role: (
            { chucuahang: 'owner', quanly: 'manager', nhanvien: 'staff' } as Record<string, string>
          )[result.user.role],
          branchId: result.user.branchIds[0] || '',
        });
        sessionStorage.setItem('trinh-user', JSON.stringify(loggedIn));
      }
      setUser(loggedIn);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      if (!isMock) await http.request('/auth/logout', { method: 'POST' });
    } finally {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem('trinh-user');
      setUser(null);
      setDb(null);
    }
  }
  async function run(command: Command, message = 'Lưu thông tin thành công!') {
    if (!user || busy) return false;
    setBusy(true);
    notify('');
    try {
      setDb(await repository.execute(command, user));
      notify(message);
      return true;
    } catch (e) {
      notify(`Lỗi: ${e instanceof Error ? e.message : 'Không thể thực hiện thao tác.'}`);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppContext.Provider
      value={{
        user,
        db,
        loading,
        busy,
        error,
        notice,
        login,
        logout,
        reload,
        run,
        notify,
        viewBranch,
        setViewBranch,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('Missing AppProvider');
  return ctx;
}
export function useScope() {
  const { user, db } = useApp();
  return {
    branches: db!.branches.filter((b) => user!.role === 'owner' || b.id === user!.branchId),
    allowed: (branchId: string) => user!.role === 'owner' || user!.branchId === branchId,
    role: user!.role as Role,
  };
}
