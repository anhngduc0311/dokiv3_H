import { User } from '../types';

export function readStored<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined') return fallback;
    const val = localStorage.getItem(key) || sessionStorage.getItem(key);
    return val ? (JSON.parse(val) ?? fallback) : fallback;
  } catch {
    return fallback;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('td-token') || localStorage.getItem('td-token');
}

export function setStoredToken(token: string, user?: User | null): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem('td-token', token);
    localStorage.setItem('td-token', token);
    if (user) {
      sessionStorage.setItem('td-user', JSON.stringify(user));
      localStorage.setItem('td-user', JSON.stringify(user));
    }
  } catch {}
}

export function clearStoredAuth(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem('td-token');
    sessionStorage.removeItem('td-user');
    localStorage.removeItem('td-token');
    localStorage.removeItem('td-user');
  } catch {}
}

export const message = (e: unknown) => (e instanceof Error ? e.message : 'Không thể kết nối. Vui lòng thử lại.');

export function compact(n: number): string {
  return n >= 1000000 ? (n / 1000000).toFixed(1) + 'm' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}

export function ago(date: string): string {
  const m = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  return m < 1 ? 'Vừa xong' : m < 60 ? `${m} phút` : m < 1440 ? `${Math.floor(m / 60)} giờ` : `${Math.floor(m / 1440)} ngày`;
}

export const statuses: Record<string, string> = {
  ongoing: 'Đang tiến hành',
  completed: 'Đã hoàn thành',
  hiatus: 'Tạm ngưng',
  cancelled: 'Đã hủy'
};

export function cleanDescription(desc: string | null | undefined): string {
  if (!desc) return 'Chưa có mô tả cho bộ truyện này.';
  let text = desc;
  text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  text = text.replace(/<[^>]*>/g, ' ');
  text = text.replace(/Truyện tranh\s+.*?được cập nhật nhanh và đầy đủ nhất tại\s+\S+/gi, '');
  text = text.replace(/Bạn đọc đừng quên để lại bình luận và chia sẻ,\s*ủng hộ.*$/gmi, '');
  text = text.replace(/Đọc truyện\s+.*?tại\s+\S+/gi, '');
  text = text.replace(/Xem truyện\s+.*?tại\s+\S+/gi, '');
  text = text.split('\n').map(l => l.trim()).filter(Boolean).join('\n\n').trim();
  return text || 'Chưa có mô tả cho bộ truyện này.';
}

export function proxyImage(url: string): string {
  if (!url || url.startsWith('/api/')) return url;
  return url;
}
