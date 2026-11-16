import { useState } from 'react';
import { useApp } from '../../app/context';
import { isMock } from '../../app/container';
import { Dialog, Field } from '../components/ui';
export function Login() {
  const { login, busy } = useApp();
  const [username, setUsername] = useState(isMock ? 'buiducmanh' : '');
  const [password, setPassword] = useState(isMock ? '123456' : '');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [help, setHelp] = useState(false);
  return (
    <div className="login-page">
      <div className={`login-card ${error ? 'has-error' : ''}`}>
        <img className="login-logo" src="/assets/logo-blue.png" alt="Trình Cà Phê" />
        <h1>
          Hệ thống quản lý hao hụt
          <br />
          tồn kho và nguyên vật liệu
        </h1>
        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            if (!username.trim() || !password) {
              setError('X Hãy nhập đầy đủ thông tin!');
              return;
            }
            try {
              await login(username.trim(), password);
            } catch (e) {
              // setError(e instanceof Error ? e.message : 'Không đăng nhập được.');
                setError('X Tên đăng nhập hoặc mật khẩu không đúng.');
            }
          }}
        >
          {error && (
            <p className="login-error-summary" role="alert">
              {error}
            </p>
          )}
          <Field label="Tên đăng nhập">
            <input
              autoComplete="username"
              required
              value={username}
              aria-invalid={!!error}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Field>
          <Field label="Mật khẩu">
            <input
              autoComplete="current-password"
              required
              type={show ? 'text' : 'password'}
              value={password}
              aria-invalid={!!error}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && (
            <small className="field-error login-error-hint">
              {error === 'X Hãy nhập đầy đủ thông tin!'
                ? 'Kiểm tra lại thông tin đăng nhập.'
                : 'Vui lòng thử lại!'}
            </small>
          )}
          <div className="login-options">
            <label>
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />{' '}
              Hiện mật khẩu
            </label>
            <button type="button" className="text-button" onClick={() => setHelp(!help)}>
              Quên mật khẩu?
            </button>
          </div>
          <button className="primary login-submit" disabled={busy}>
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>
      </div>
      {isMock && (
        <details className="demo-accounts">
          <summary>Tài khoản dùng thử</summary>
          <p>
            Mật khẩu chung: <code>Trinh@123</code>
          </p>
          <div>
            {[
              ['buiducmanh', 'Chủ cửa hàng'],
              ['nguyenthihuong', 'Quản lý'],
              ['nguyenminhanh', 'Nhân viên'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => {
                  setUsername(id);
                  setPassword('123456');
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </details>
      )}
      {help && (
        <Dialog title="Quên mật khẩu" onClose={() => setHelp(false)}>
          <p>Vui lòng liên hệ Chủ cửa hàng để được cấp lại mật khẩu.</p>
          <div className="form-actions">
            <button className="primary" onClick={() => setHelp(false)}>
              Đã hiểu
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
