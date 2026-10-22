'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, LibraryItem, NotificationItem, Settings, Manga, Reader } from '../types';
import { api } from '../lib/api';
import { readStored, getStoredToken, setStoredToken, clearStoredAuth } from '../lib/utils';

export interface StoreContextType {
  user: User | null;
  follows: LibraryItem[];
  history: LibraryItem[];
  notifications: NotificationItem[];
  unreadNotifications: number;
  settings: Settings;
  toast: string;
  notify: (text: string) => void;
  clearToast: () => void;
  hasToken: () => boolean;
  getToken: () => string | null;
  ensureRestored: () => Promise<User | null>;
  restore: () => Promise<User | null>;
  login: (email: string, password: string, name?: string) => Promise<void>;
  loginWithGoogle: (credential?: string, code?: string, redirectUri?: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<void>;
  getGoogleConfig: () => Promise<{ clientId: string }>;
  logout: () => void;
  loadNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  refreshLibrary: () => Promise<void>;
  isFollowed: (id: string) => boolean;
  follow: (m: Manga) => Promise<void>;
  record: (r: Reader) => Promise<void>;
  removeHistory: (id: string) => Promise<void>;
  saveSettings: (s: Settings) => void;
  applyTheme: (theme?: string) => void;
  toggleTheme: () => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

const DEFAULT_SETTINGS: Settings = {
  language: 'vi',
  dataSaver: true,
  width: 900,
  theme: 'dark'
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [follows, setFollows] = useState<LibraryItem[]>([]);
  const [history, setHistory] = useState<LibraryItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [toast, setToast] = useState<string>('');

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restorePromiseRef = useRef<Promise<User | null> | null>(null);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const applyTheme = useCallback((themeToApply?: string) => {
    if (typeof document === 'undefined') return;
    const currentTheme = themeToApply || settings.theme;
    document.documentElement.dataset['theme'] = currentTheme;
    if (currentTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [settings.theme]);

  const notify = useCallback((text: string) => {
    setToast(text);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast('');
    }, 4500);
  }, []);

  const clearToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast('');
  }, []);

  const hasToken = useCallback(() => {
    return !!getStoredToken();
  }, []);

  const getToken = useCallback(() => {
    return getStoredToken();
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!userRef.current) return;
    try {
      const res = await api.request<{ items: NotificationItem[]; unreadCount: number }>('/notifications');
      setNotifications(res.items || []);
      setUnreadNotifications(res.unreadCount || 0);
    } catch {}
  }, []);

  const refreshLibrary = useCallback(async () => {
    if (!getStoredToken()) return;
    try {
      const r = await api.request<{ follows: LibraryItem[]; history: LibraryItem[] }>('/library');
      setFollows(r.follows || []);
      setHistory(r.history || []);
      void loadNotifications();
    } catch {}
  }, [loadNotifications]);

  const restore = useCallback(async (): Promise<User | null> => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      return null;
    }
    if (restorePromiseRef.current) return restorePromiseRef.current;

    restorePromiseRef.current = (async () => {
      try {
        const u = await api.request<User>('/auth/me');
        setUser(u);
        setStoredToken(token, u);
        await refreshLibrary();
        return u;
      } catch {
        clearStoredAuth();
        setUser(null);
        return null;
      } finally {
        restorePromiseRef.current = null;
      }
    })();

    return restorePromiseRef.current;
  }, [refreshLibrary]);

  const ensureRestored = useCallback((): Promise<User | null> => {
    if (!getStoredToken()) {
      return Promise.resolve(null);
    }
    if (restorePromiseRef.current) {
      return restorePromiseRef.current;
    }
    if (userRef.current) {
      return Promise.resolve(userRef.current);
    }
    return restore();
  }, [restore]);

  const login = useCallback(
    async (email: string, password: string, name?: string) => {
      const s = await api.request<{ token: string; user: User }>(
        '/auth/' + (name !== undefined ? 'register' : 'login'),
        'POST',
        { email, password, name }
      );
      setStoredToken(s.token, s.user);
      setUser(s.user);
      await refreshLibrary();
    },
    [refreshLibrary]
  );

  const loginWithGoogle = useCallback(
    async (credential?: string, code?: string, redirectUri?: string) => {
      const s = await api.request<{ token: string; user: User }>('/auth/google', 'POST', {
        credential,
        code,
        redirectUri
      });
      setStoredToken(s.token, s.user);
      setUser(s.user);
      await refreshLibrary();
    },
    [refreshLibrary]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string, confirmPassword: string) => {
      const session = await api.request<{ token: string; user: User }>('/auth/change-password', 'POST', {
        currentPassword,
        newPassword,
        confirmPassword
      });
      setStoredToken(session.token, session.user);
      setUser(session.user);
    },
    []
  );

  const getGoogleConfig = useCallback(async () => {
    try {
      const res = await api.request<{ clientId: string }>('/auth/google/config');
      if (res?.clientId) return res;
    } catch {}
    return {
      clientId:
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
        '269100522556-hlqf9sooeon60u7jaqnfr3lp8b06s6vl.apps.googleusercontent.com'
    };
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setUser(null);
    setFollows([]);
    setNotifications([]);
    setUnreadNotifications(0);
    setHistory(readStored('td-history', []));
    notify('Đã đăng xuất.');
  }, [notify]);

  const markNotificationRead = useCallback(async (id: string) => {
    setNotifications(list => list.map(n => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadNotifications(c => Math.max(0, c - 1));
    try {
      await api.request('/notifications/' + id + '/read', 'PUT');
    } catch {}
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications(list => list.map(n => ({ ...n, isRead: true })));
    setUnreadNotifications(0);
    try {
      await api.request('/notifications/read-all', 'PUT');
    } catch {}
  }, []);

  const isFollowed = useCallback(
    (id: string) => {
      return follows.some(x => x.mangaId === id);
    },
    [follows]
  );

  const follow = useCallback(
    async (m: Manga) => {
      if (!userRef.current) throw new Error('Vui lòng đăng nhập để theo dõi truyện.');
      const followed = !isFollowed(m.id);
      await api.request(`/library/follows/${m.id}`, 'PUT', { followed });
      await refreshLibrary();
      notify(followed ? 'Đã thêm vào truyện theo dõi.' : 'Đã bỏ theo dõi truyện.');
    },
    [isFollowed, refreshLibrary, notify]
  );

  const record = useCallback(
    async (r: Reader) => {
      const item: LibraryItem = {
        mangaId: r.manga.id,
        title: r.manga.title,
        cover: r.manga.cover,
        chapterId: r.chapter.id,
        chapterTitle: r.chapter.title,
        readAt: new Date().toISOString()
      };
      if (userRef.current) {
        await api.request(`/library/history/${r.chapter.id}`, 'PUT', {});
        await refreshLibrary();
      } else {
        setHistory(prev => {
          const next = [item, ...prev.filter(x => x.mangaId !== item.mangaId)].slice(0, 200);
          localStorage.setItem('td-history', JSON.stringify(next));
          return next;
        });
      }
    },
    [refreshLibrary]
  );

  const removeHistory = useCallback(
    async (id: string) => {
      if (userRef.current) {
        await api.request('/library/history/' + id, 'DELETE');
      }
      setHistory(prev => {
        const next = prev.filter(x => x.mangaId !== id);
        if (!userRef.current) {
          localStorage.setItem('td-history', JSON.stringify(next));
        }
        return next;
      });
    },
    []
  );

  const saveSettings = useCallback(
    (s: Settings) => {
      setSettings(s);
      localStorage.setItem('td-settings', JSON.stringify(s));
      applyTheme(s.theme);
      notify('Đã lưu tùy chỉnh.');
    },
    [applyTheme, notify]
  );

  const toggleTheme = useCallback(() => {
    const nextTheme = settings.theme === 'light' ? 'dark' : 'light';
    const newSettings = { ...settings, theme: nextTheme };
    saveSettings(newSettings);
  }, [settings, saveSettings]);

  // Initial client mounting: load stored settings, token, user, history
  useEffect(() => {
    const storedUser = readStored<User | null>('td-user', null);
    if (storedUser) setUser(storedUser);

    const storedSettings = readStored<Settings>('td-settings', DEFAULT_SETTINGS);
    setSettings(storedSettings);
    applyTheme(storedSettings.theme);

    const storedHistory = readStored<LibraryItem[]>('td-history', []);
    setHistory(storedHistory);

    if (getStoredToken()) {
      void restore();
    }

    notifTimerRef.current = setInterval(() => {
      if (userRef.current) {
        void loadNotifications();
      }
    }, 30000);

    return () => {
      if (notifTimerRef.current) clearInterval(notifTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [restore, loadNotifications, applyTheme]);

  return (
    <StoreContext.Provider
      value={{
        user,
        follows,
        history,
        notifications,
        unreadNotifications,
        settings,
        toast,
        notify,
        clearToast,
        hasToken,
        getToken,
        ensureRestored,
        restore,
        login,
        loginWithGoogle,
        changePassword,
        getGoogleConfig,
        logout,
        loadNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        refreshLibrary,
        isFollowed,
        follow,
        record,
        removeHistory,
        saveSettings,
        applyTheme,
        toggleTheme
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextType {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
