'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { BrandLogo } from '../ui/brand-logo';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '../../contexts/store-context';
import { setStoredToken, message } from '../../lib/utils';
import { Icon } from '../ui/icon';
import { safeReturnUrl } from '../../lib/auth-urls';

export interface AuthViewProps {
  isRegister?: boolean;
}

export function AuthView({ isRegister = false }: AuthViewProps) {
  const store = useStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');

  const returnUrl = safeReturnUrl(searchParams.get('returnUrl'));

  // Load Google config and handle URL query tokens
  useEffect(() => {
    const errParam = searchParams.get('error');
    if (errParam) setError(errParam);

    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setStoredToken(tokenParam);
      setBusy(true);
      void store
        .restore()
        .then(user => {
          if (!user) throw new Error('Phiên đăng nhập Google không hợp lệ. Vui lòng đăng nhập lại.');
          store.notify('Đăng nhập Google thành công!');
          router.push(returnUrl);
        })
        .catch(e => {
          setError(message(e));
        })
        .finally(() => {
          setBusy(false);
        });
    } else {
      void store.ensureRestored().then(user => {
        if (user && !errParam) {
          router.push(returnUrl);
        }
      });
    }

    void store.getGoogleConfig().then(res => {
      if (res?.clientId) {
        setGoogleClientId(res.clientId);
      }
    }).catch(() => {});
  }, [searchParams]);

  // Google GSI button rendering
  useEffect(() => {
    if (!googleClientId) return;

    const renderBtn = () => {
      const el = document.getElementById('google-btn-container');
      if (!el) return false;
      const w = window as any;
      if (!w.google?.accounts?.id) return false;

      el.innerHTML = '';
      const parent = el.parentElement || el;
      const availableWidth = parent.clientWidth || 320;
      const targetWidth = Math.max(200, Math.min(380, Math.floor(availableWidth)));
      const isLight = store.settings.theme === 'light';

      try {
        w.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (res: any) => {
            if (res?.credential) {
              void handleGoogleCredential(res.credential);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true
        });

        w.google.accounts.id.renderButton(el, {
          type: 'standard',
          shape: 'rectangular',
          theme: isLight ? 'outline' : 'filled_black',
          text: isRegister ? 'signup_with' : 'signin_with',
          size: 'large',
          locale: 'vi',
          width: targetWidth
        });
        return true;
      } catch { return false; }
    };

    let attempts = 0;
    const timer = setInterval(() => {
      if (renderBtn() || ++attempts >= 50) clearInterval(timer);
    }, 200);
    return () => clearInterval(timer);
  }, [googleClientId, isRegister, store.settings.theme]);

  const handleGoogleCredential = async (credential: string) => {
    setBusy(true);
    setError('');
    try {
      await store.loginWithGoogle(credential);
      store.notify(isRegister ? 'Đăng ký Google thành công!' : 'Đăng nhập Google thành công!');
      router.push(returnUrl);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const redirectToGoogleOAuth = () => {
    window.location.href = `/api/auth/google/login?returnUrl=${encodeURIComponent(returnUrl)}`;
  };

  const loginWithGoogle = () => {
    setBusy(true);
    setError('');
    redirectToGoogleOAuth();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister && password !== confirm) {
      setError('Mật khẩu xác nhận chưa trùng khớp.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await store.login(email, password, isRegister ? name : undefined);
      store.notify(
        isRegister ? 'Đăng ký và đăng nhập thành công!' : 'Đăng nhập thành công!'
      );
      router.push(returnUrl);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <section className="auth-panel glass-panel">
        <Link href="/" className="brand auth-brand" aria-label="DokiHentai - Trang chủ">
          <BrandLogo />
        </Link>
        <h1>{isRegister ? 'Tạo tài khoản' : 'Chào mừng trở lại'}</h1>
        <p className="muted">
          {isRegister
            ? 'Lưu những bộ truyện yêu thích và tiếp tục hành trình đọc truyện của bạn.'
            : 'Đăng nhập để đồng bộ truyện theo dõi và lịch sử đọc trên mọi thiết bị.'}
        </p>

        {/* GOOGLE SIGN-IN BUTTON SECTION */}
        <div className="google-auth-section">
          <div id="google-btn-container" className="gsi-slot"></div>
          <button
            type="button"
            className="btn-google-login"
            onClick={loginWithGoogle}
            disabled={busy}
          >
            <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{isRegister ? 'Đăng ký nhanh bằng Google' : 'Đăng nhập bằng Google'}</span>
          </button>
        </div>

        <div className="auth-divider">
          <span>hoặc sử dụng email</span>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {isRegister && (
            <label>
              <span>Tên hiển thị</span>
              <input
                name="name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                minLength={2}
                maxLength={60}
                autoComplete="nickname"
                placeholder="Ví dụ: Hoàng Long"
              />
            </label>
          )}

          <label>
            <span>{isRegister ? 'Địa chỉ Email' : 'Email hoặc Tên tài khoản'}</span>
            <input
              type={isRegister ? 'email' : 'text'}
              name="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              maxLength={254}
              autoComplete={isRegister ? 'email' : 'username'}
              placeholder={isRegister ? 'name@example.com' : 'Nhập username'}
            />
          </label>

          <label>
            <span>Mật khẩu</span>
            <input
              type="password"
              name="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={isRegister ? 10 : 1}
              maxLength={128}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              placeholder="Nhập mật khẩu"
            />
          </label>

          {isRegister && (
            <label>
              <span>Xác nhận mật khẩu</span>
              <input
                type="password"
                name="confirm"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu"
              />
            </label>
          )}

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="primary btn-auth-submit" disabled={busy}>
            {busy
              ? 'Đang xử lý…'
              : isRegister
              ? 'Đăng ký tài khoản'
              : 'Đăng nhập'}{' '}
            <Icon name="arrowRight" />
          </button>
        </form>

        <div className="auth-switch-row">
          <span>{isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}</span>
          <Link
            href={`${isRegister ? '/dang-nhap' : '/dang-ky'}?returnUrl=${encodeURIComponent(returnUrl)}`}
          >
            {isRegister ? 'Đăng nhập ngay' : 'Đăng ký ngay'}
          </Link>
        </div>
        <small className="auth-note muted">DokiHentai · Nền tảng đọc truyện online miễn phí</small>
      </section>
    </div>
  );
}
