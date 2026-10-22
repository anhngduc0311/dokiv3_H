'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useStore } from '../../contexts/store-context';
import { message } from '../../lib/utils';
import { Icon } from '../../components/ui/icon';

export default function ChangePasswordPage() {
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setSuccess(false);

    if (!currentPassword || currentPassword.length > 128) {
      setError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (newPassword.length < 10 || newPassword.length > 128) {
      setError('Mật khẩu mới phải có từ 10–128 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận chưa trùng khớp.');
      return;
    }
    if (currentPassword === newPassword) {
      setError('Mật khẩu mới phải khác mật khẩu hiện tại.');
      return;
    }

    setBusy(true);
    try {
      await store.changePassword(currentPassword, newPassword, confirmPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <section className="auth-panel glass-panel" aria-labelledby="password-title">
        <Icon
          name="lock"
          style={{ width: 32, height: 32, color: 'var(--accent)', marginBottom: 16 }}
        />
        <h1 id="password-title">Đổi mật khẩu</h1>

        {store.user?.canChangePassword === false ? (
          <>
            <p className="muted">
              Tài khoản này đăng nhập bằng Google. Hãy đổi mật khẩu trong tài khoản Google của bạn.
            </p>
            <a
              className="primary"
              href="https://myaccount.google.com/security"
              target="_blank"
              rel="noopener noreferrer"
            >
              Mở tài khoản Google <Icon name="arrowRight" />
            </a>
          </>
        ) : (
          <>
            <p className="muted">
              Mật khẩu mới cần có từ 10–128 ký tự. Các phiên đăng nhập khác sẽ hết hiệu lực sau khi
              đổi.
            </p>
            <form className="auth-form" onSubmit={submit}>
              <fieldset
                disabled={busy}
                style={{
                  border: 0,
                  padding: 0,
                  margin: 0,
                  minWidth: 0,
                  display: 'grid',
                  gap: 8
                }}
              >
                <label htmlFor="current-password">
                  <span>Mật khẩu hiện tại</span>
                </label>
                <input
                  id="current-password"
                  type="password"
                  name="currentPassword"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />

                <label htmlFor="new-password" style={{ marginTop: 8 }}>
                  <span>Mật khẩu mới</span>
                </label>
                <input
                  id="new-password"
                  type="password"
                  name="newPassword"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={10}
                  maxLength={128}
                  aria-describedby="password-title"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />

                <label htmlFor="confirm-password" style={{ marginTop: 8 }}>
                  <span>Xác nhận mật khẩu mới</span>
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={10}
                  maxLength={128}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </fieldset>

              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}

              {success && (
                <p
                  className="password-success"
                  role="status"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: 'var(--accent)',
                    margin: 0
                  }}
                >
                  <Icon name="check" /> Đổi mật khẩu thành công.
                </p>
              )}

              <button className="primary btn-auth-submit" type="submit" disabled={busy}>
                {busy ? 'Đang lưu…' : 'Lưu mật khẩu mới'} <Icon name="arrowRight" />
              </button>
            </form>
          </>
        )}

        <Link href="/" className="text-button">
          Về trang chủ
        </Link>
      </section>
    </div>
  );
}
