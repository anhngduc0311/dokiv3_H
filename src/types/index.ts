export interface Chapter {
  id: string;
  mangaId: string;
  title: string;
  number: number;
  language: string;
  publishedAt: string;
  group: string;
}

export interface Manga {
  source?: 'mimihentai' | 'mangadex' | 'truyengg';
  id: string;
  title: string;
  alternativeTitle: string;
  author: string;
  cover: string;
  description: string;
  genres: string[];
  status: string;
  country: string;
  demographic: string;
  contentRating: string;
  year: number | null;
  rating: number;
  follows: number;
  views?: number;
  updatedAt: string;
  chapters: Chapter[];
  totalChapters?: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Reader {
  chapter: Chapter;
  manga: Manga;
  pages: string[];
  dataSaverPages: string[];
  externalUrl: string | null;
  navigation: Chapter[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  coins?: number;
  isBanned?: boolean;
  canChangePassword?: boolean;
}

export interface LibraryItem {
  mangaId: string;
  title: string;
  cover: string;
  chapterId?: string;
  chapterTitle?: string;
  readAt?: string;
}

export interface Comment {
  id: string;
  mangaId: string;
  mangaTitle: string;
  userId: string;
  name: string;
  parentId?: string | null;
  replyToName?: string | null;
  body: string;
  createdAt: string;
  replies?: Comment[];
}

export interface NotificationItem {
  id: string;
  actorId?: string;
  actorName: string;
  mangaId: string;
  mangaTitle: string;
  commentId?: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface Settings {
  language: string;
  dataSaver: boolean;
  width: number;
  theme: string;
}

export interface ZoomLevel {
  label: string;
  width: number;
}

export interface SpeedLevel {
  label: string;
  speed: number;
}

export interface BannerImage {
  url: string;
  width: number;
  height: number;
}

// Admin Interfaces
export interface AdminKpis {
  viewsToday: number;
  viewsWeek: number;
  viewsMonth: number;
  totalViews: number;
  totalMangas: number;
  mangasUpdatedToday: number;
  totalChapters: number;
  chaptersUpdatedToday: number;
  totalUsers: number;
  newUsersToday: number;
  newUsersWeek: number;
  totalCoins: number;
  revenueToday: number;
  revenueMonth: number;
}

export interface AdminOverview {
  kpis: AdminKpis;
  chartViews: { date: string; views: number }[];
  chartCoins: { date: string; coins: number }[];
  recentReports: any[];
  topMangas: any[];
  recentLogs: any[];
}

export interface AdminManga {
  id: string;
  title: string;
  alternativeTitle: string;
  author: string;
  artist: string;
  cover: string;
  status: string;
  sourceType: string;
  isHidden: boolean;
  isDraft: boolean;
  featured: boolean;
  views: number;
  country: string;
  genres: string[];
  chaptersCount: number | null;
  updatedAt: string;
}

export interface AdminChapter {
  readOnly?: boolean;
  id: string;
  mangaId: string;
  number: number;
  title: string;
  language: string;
  contentType: string;
  isLocked: boolean;
  coinPrice: number;
  unlockAt?: string;
  scheduledPublishAt?: string;
  publishedAt: string;
  pagesCount: number;
  hasContent: boolean;
  pages?: string[];
  content?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  coins: number;
  isBanned: boolean;
  createdAt: string;
}

export interface AdminComment {
  id: string;
  mangaId: string;
  mangaTitle: string;
  userId: string;
  userName: string;
  userEmail: string;
  body: string;
  isFlagged: boolean;
  createdAt: string;
}

export interface AdminReport {
  id: string;
  type: string;
  reason: string;
  status: string;
  notes?: string;
  createdAt: string;
  resolvedAt?: string;
  userId?: string;
  userName: string;
  mangaId?: string;
  mangaTitle?: string;
  chapterId?: string;
  chapterTitle?: string;
}

export interface AdminTaxonomy {
  readOnly?: boolean;
  id: string;
  type: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
}

export interface AdminLog {
  id: string;
  level: string;
  source: string;
  message: string;
  createdAt: string;
}
