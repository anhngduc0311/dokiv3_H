'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import JSZip from 'jszip';
import { Icon } from '@/components/ui/icon';
import { useStore } from '@/contexts/store-context';
import { api } from '@/lib/api';
import { compact, ago } from '@/lib/utils';
import {
  AdminOverview,
  AdminManga,
  AdminChapter,
  AdminUser,
  AdminComment,
  AdminReport,
  AdminTaxonomy,
  AdminLog
} from '@/types';

export default function AdminPage() {
  const store = useStore();
  const router = useRouter();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<
    'overview' | 'mangas' | 'chapters' | 'taxonomy' | 'users' | 'moderation' | 'logs'
  >('overview');

  // Loading states
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  // Overview data
  const [overview, setOverview] = useState<AdminOverview | null>(null);

  // Manga state
  const [mangas, setMangas] = useState<AdminManga[]>([]);
  const [mangaTotal, setMangaTotal] = useState(0);
  const [mangaPage, setMangaPage] = useState(1);
  const [mangaQuery, setMangaQuery] = useState('');
  const [mangaStatusFilter, setMangaStatusFilter] = useState('all');
  const [mangaSourceFilter, setMangaSourceFilter] = useState('all');
  const [mangaVisibilityFilter, setMangaVisibilityFilter] = useState('all');

  // Manga Edit/Create Modal
  const [mangaModalOpen, setMangaModalOpen] = useState(false);
  const [mangaEditMode, setMangaEditMode] = useState(false);
  const [currentManga, setCurrentManga] = useState<{
    id: string;
    title: string;
    alternativeTitle: string;
    author: string;
    artist: string;
    cover: string;
    description: string;
    genres: string[];
    genresInput: string;
    status: string;
    sourceType: string;
    country: string;
    demographic: string;
    year: number;
    featured: boolean;
    isDraft: boolean;
    isHidden: boolean;
    scanlationGroup: string;
    tagsInput: string;
  }>({
    id: '',
    title: '',
    alternativeTitle: '',
    author: '',
    artist: '',
    cover: '',
    description: '',
    genres: [],
    genresInput: '',
    status: 'ongoing',
    sourceType: 'original',
    country: 'vn',
    demographic: 'shounen',
    year: 2026,
    featured: false,
    isDraft: false,
    isHidden: false,
    scanlationGroup: '',
    tagsInput: ''
  });

  // Chapter Management state
  const [selectedMangaId, setSelectedMangaId] = useState<string>('');
  const [selectedManga, setSelectedManga] = useState<AdminManga | null>(null);
  const [chapters, setChapters] = useState<AdminChapter[]>([]);
  const [chapterModalOpen, setChapterModalOpen] = useState(false);
  const [chapterEditMode, setChapterEditMode] = useState(false);
  const [currentChapter, setCurrentChapter] = useState<{
    id: string;
    mangaId: string;
    number: number;
    title: string;
    language: string;
    contentType: 'comic' | 'novel';
    isLocked: boolean;
    coinPrice: number;
    unlockAt: string;
    scheduledPublishAt: string;
    pagesText: string;
    pagesList: string[];
    content: string;
  }>({
    id: '',
    mangaId: '',
    number: 1,
    title: '',
    language: 'vi',
    contentType: 'comic',
    isLocked: false,
    coinPrice: 0,
    unlockAt: '',
    scheduledPublishAt: '',
    pagesText: '',
    pagesList: [],
    content: ''
  });
  const [uploadingImages, setUploadingImages] = useState(false);

  // Chapter Pagination & Search State
  const [chapterPage, setChapterPage] = useState(1);
  const [chapterPageSize, setChapterPageSize] = useState(20);
  const [chapterSearchQuery, setChapterSearchQuery] = useState('');

  // Chapter Download State
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [downloadRangeMode, setDownloadRangeMode] = useState<'range' | 'custom'>('range');
  const [downloadFromChap, setDownloadFromChap] = useState<number>(1);
  const [downloadToChap, setDownloadToChap] = useState<number>(1);
  const [downloadSelectedChapIds, setDownloadSelectedChapIds] = useState<string[]>([]);
  const [downloadFormat, setDownloadFormat] = useState<'single_zip'>('single_zip');
  const [downloadQuality, setDownloadQuality] = useState<'original' | 'saver'>('original');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadStatus, setDownloadStatus] = useState<string>('');
  const [downloadLogs, setDownloadLogs] = useState<string[]>([]);
  const [downloadChapSearch, setDownloadChapSearch] = useState<string>('');
  const downloadAbortControllerRef = useRef<AbortController | null>(null);

  // Taxonomy state
  const [taxonomyType, setTaxonomyType] = useState<'genre' | 'tag' | 'author' | 'group'>('genre');
  const [taxonomyItems, setTaxonomyItems] = useState<AdminTaxonomy[]>([]);
  const [taxonomyModalOpen, setTaxonomyModalOpen] = useState(false);
  const [taxonomyEditMode, setTaxonomyEditMode] = useState(false);
  const [currentTaxonomy, setCurrentTaxonomy] = useState<{
    id: string;
    type: string;
    name: string;
    slug: string;
    description: string;
  }>({ id: '', type: 'genre', name: '', slug: '', description: '' });

  // Users & RBAC state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userQuery, setUserQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [userCoinModalOpen, setUserCoinModalOpen] = useState(false);
  const [selectedUserForCoins, setSelectedUserForCoins] = useState<AdminUser | null>(null);
  const [coinAdjustAmount, setCoinAdjustAmount] = useState<number>(1000);
  const [coinAdjustNote, setCoinAdjustNote] = useState<string>('Nạp xu khuyến mãi');

  // Moderation state
  const [moderationTab, setModerationTab] = useState<'reports' | 'comments' | 'keywords'>('reports');
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [commentTotal, setCommentTotal] = useState(0);
  const [commentPage, setCommentPage] = useState(1);
  const [commentQuery, setCommentQuery] = useState('');
  const [commentFlaggedOnly, setCommentFlaggedOnly] = useState(false);

  const [reports, setReports] = useState<AdminReport[]>([]);
  const [reportTotal, setReportTotal] = useState(0);
  const [reportPage, setReportPage] = useState(1);
  const [reportStatusFilter, setReportStatusFilter] = useState('pending');
  const [reportTypeFilter, setReportTypeFilter] = useState('all');
  const [reportResolveModalOpen, setReportResolveModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<AdminReport | null>(null);
  const [reportResolveNotes, setReportResolveNotes] = useState('');

  const [keywords, setKeywords] = useState<{ id: string; keyword: string; action: string }[]>([]);
  const [newKeyword, setNewKeyword] = useState('');

  // Logs state
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logLevelFilter, setLogLevelFilter] = useState('all');
  const [logSourceFilter, setLogSourceFilter] = useState('all');

  // Helper check RBAC
  const isFullAdmin = useCallback(() => {
    const role = store.user?.role;
    return role === 'admin' || role === 'superadmin';
  }, [store.user]);

  // Check initial permission
  useEffect(() => {
    let isMounted = true;
    async function initCheck() {
      await store.ensureRestored();
      const u = store.user;
      if (!u) {
        router.replace('/dang-nhap?returnUrl=/admin');
        return;
      }
      const staffRoles = ['admin', 'superadmin', 'editor', 'translator'];
      if (!staffRoles.includes(u.role)) {
        store.notify('Bạn không có quyền truy cập trang quản trị.');
        router.replace('/');
        return;
      }
      if (isMounted) {
        setAuthorized(true);
        void loadOverview();
      }
    }
    initCheck();
    return () => {
      isMounted = false;
    };
  }, []);

  // Switch tabs
  const handleSwitchTab = (tab: 'overview' | 'mangas' | 'chapters' | 'taxonomy' | 'users' | 'moderation' | 'logs') => {
    setActiveTab(tab);
    if (tab === 'overview') void loadOverview();
    else if (tab === 'mangas') void loadMangas(1, mangaQuery, mangaStatusFilter, mangaSourceFilter, mangaVisibilityFilter);
    else if (tab === 'chapters') {
      if (selectedMangaId) void loadChapters(selectedMangaId);
      else void loadMangas(1, mangaQuery, mangaStatusFilter, mangaSourceFilter, mangaVisibilityFilter);
    }
    else if (tab === 'taxonomy') void loadTaxonomy(taxonomyType);
    else if (tab === 'users') void loadUsers(1, userQuery, userRoleFilter, userStatusFilter);
    else if (tab === 'moderation') void loadModeration(moderationTab);
    else if (tab === 'logs') void loadLogs(1, logLevelFilter, logSourceFilter);
  };

  // =========================================================================
  // 1. OVERVIEW
  // =========================================================================
  const loadOverview = async () => {
    setLoading(true);
    try {
      const data = await api.request<AdminOverview>('/admin/overview');
      setOverview(data);
    } catch (e: any) {
      store.notify(e.message || 'Không tải được số liệu tổng quan.');
    } finally {
      setLoading(false);
    }
  };

  const getViewsChartPath = (): string => {
    const points = overview?.chartViews;
    if (!points || points.length < 2) return '';
    const max = Math.max(...points.map(p => p.views), 10);
    const width = 600;
    const height = 180;
    const step = width / (points.length - 1);

    return points
      .map((p, i) => {
        const x = i * step;
        const y = height - (p.views / max) * (height - 30) - 15;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const getViewsChartArea = (): string => {
    const path = getViewsChartPath();
    if (!path) return '';
    return `${path} L 600 180 L 0 180 Z`;
  };

  // =========================================================================
  // 2. MANGA MANAGEMENT
  // =========================================================================
  const loadMangas = async (
    page = mangaPage,
    query = mangaQuery,
    status = mangaStatusFilter,
    source = mangaSourceFilter,
    visibility = mangaVisibilityFilter
  ) => {
    setLoading(true);
    try {
      const res = await api.request<{ items: AdminManga[]; total: number }>(
        '/admin/mangas?' +
          api.query({
            page,
            pageSize: 15,
            q: query.trim(),
            status,
            sourceType: source,
            visibility
          })
      );
      setMangas(res.items || []);
      setMangaTotal(res.total || 0);
    } catch (e: any) {
      store.notify(e.message || 'Không tải được danh sách truyện.');
    } finally {
      setLoading(false);
    }
  };

  // Unified Pagination Helpers
  const getTotalPages = (totalItems: number, pageSize: number = 15): number => {
    return Math.max(1, Math.ceil((totalItems || 0) / (pageSize || 15)));
  };

  const getPageNumbers = (currentPage: number, totalItems: number, pageSize: number = 15): (number | string)[] => {
    const total = getTotalPages(totalItems, pageSize);
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', total];
    }
    if (currentPage >= total - 3) {
      return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', total];
  };

  const openCreateMangaModal = () => {
    setMangaEditMode(false);
    setCurrentManga({
      id: '',
      title: '',
      alternativeTitle: '',
      author: '',
      artist: '',
      cover: '',
      description: '',
      genres: [],
      genresInput: 'Action, Manhwa, Fantasy',
      status: 'ongoing',
      sourceType: 'original',
      country: 'vn',
      demographic: 'shounen',
      year: new Date().getFullYear(),
      featured: false,
      isDraft: false,
      isHidden: false,
      scanlationGroup: '',
      tagsInput: ''
    });
    setMangaModalOpen(true);
  };

  const openEditMangaModal = async (m: AdminManga) => {
    setMangaEditMode(true);
    try {
      const full = await api.request<any>('/admin/mangas/' + m.id);
      setCurrentManga({
        ...full,
        genresInput: (full.genres || []).join(', '),
        tagsInput: (full.tags || []).join(', ')
      });
      setMangaModalOpen(true);
    } catch (e: any) {
      store.notify(e.message || 'Không lấy được chi tiết truyện.');
    }
  };

  const saveManga = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentManga.title.trim()) {
      store.notify('Vui lòng nhập tên truyện.');
      return;
    }
    setActionLoading(true);
    try {
      const genres = currentManga.genresInput
        .split(',')
        .map((g: string) => g.trim())
        .filter(Boolean);

      const tags = currentManga.tagsInput
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean);

      const payload = {
        title: currentManga.title.trim(),
        alternativeTitle: currentManga.alternativeTitle?.trim() || '',
        author: currentManga.author?.trim() || '',
        artist: currentManga.artist?.trim() || '',
        cover: currentManga.cover?.trim() || '/cover-placeholder.svg',
        description: currentManga.description?.trim() || '',
        genres,
        status: currentManga.status,
        country: currentManga.country,
        demographic: currentManga.demographic,
        year: Number(currentManga.year) || 2026,
        featured: !!currentManga.featured,
        sourceType: currentManga.sourceType,
        isDraft: !!currentManga.isDraft,
        isHidden: !!currentManga.isHidden,
        scanlationGroup: currentManga.scanlationGroup?.trim() || '',
        tags
      };

      if (mangaEditMode) {
        await api.request('/admin/mangas/' + currentManga.id, 'PUT', payload);
        store.notify('Đã cập nhật truyện thành công.');
      } else {
        await api.request('/admin/mangas', 'POST', payload);
        store.notify('Đã thêm truyện mới thành công.');
      }
      setMangaModalOpen(false);
      void loadMangas(mangaPage);
    } catch (e: any) {
      store.notify(e.message || 'Lỗi khi lưu truyện.');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleMangaVisibility = async (m: AdminManga) => {
    try {
      const res = await api.request<{ isHidden: boolean }>(`/admin/mangas/${m.id}/toggle-visibility`, 'PATCH');
      m.isHidden = res.isHidden;
      setMangas([...mangas]);
      store.notify(m.isHidden ? 'Đã ẩn truyện.' : 'Đã hiển thị truyện.');
    } catch (e: any) {
      store.notify(e.message || 'Không thể đổi trạng thái hiển thị.');
    }
  };

  const deleteManga = async (m: AdminManga) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn truyện "${m.title}" và toàn bộ chương liên quan?`)) return;
    try {
      await api.request('/admin/mangas/' + m.id, 'DELETE');
      store.notify('Đã xóa truyện thành công.');
      void loadMangas(mangaPage);
    } catch (e: any) {
      store.notify(e.message || 'Không thể xóa truyện.');
    }
  };

  const manageMangaChapters = (m: AdminManga) => {
    setSelectedMangaId(m.id);
    setSelectedManga(m);
    handleSwitchTab('chapters');
  };

  // =========================================================================
  // 3. CHAPTER MANAGEMENT
  // =========================================================================
  const loadChapters = async (mangaId: string) => {
    if (!mangaId) return;
    setLoading(true);
    setChapterPage(1);
    setChapterSearchQuery('');
    try {
      const res = await api.request<AdminChapter[]>(`/admin/mangas/${mangaId}/chapters`);
      setChapters(res || []);
      if (!selectedManga || selectedManga.id !== mangaId) {
        const m = await api.request<any>('/admin/mangas/' + mangaId);
        setSelectedManga(m);
      }
    } catch (e: any) {
      store.notify(e.message || 'Không tải được danh sách chương.');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredChaptersList = (): AdminChapter[] => {
    const q = chapterSearchQuery.trim().toLowerCase();
    if (!q) return chapters;
    return chapters.filter(c => c.title.toLowerCase().includes(q) || String(c.number).includes(q));
  };

  const getPagedChapters = (): AdminChapter[] => {
    const filtered = getFilteredChaptersList();
    if (chapterPageSize >= 9999) return filtered;
    return filtered.slice((chapterPage - 1) * chapterPageSize, chapterPage * chapterPageSize);
  };

  const openCreateChapterModal = () => {
    if (!selectedMangaId) {
      store.notify('Vui lòng chọn truyện trước khi thêm chương.');
      return;
    }
    const nextNumber = chapters.length > 0 ? Math.floor(chapters[0].number) + 1 : 1;
    setChapterEditMode(false);
    setCurrentChapter({
      id: '',
      mangaId: selectedMangaId,
      number: nextNumber,
      title: `Chương ${nextNumber}`,
      language: 'vi',
      contentType: 'comic',
      isLocked: false,
      coinPrice: 0,
      unlockAt: '',
      scheduledPublishAt: '',
      pagesText: '',
      pagesList: [],
      content: ''
    });
    setChapterModalOpen(true);
  };

  const openEditChapterModal = async (c: AdminChapter) => {
    setChapterEditMode(true);
    try {
      const full = await api.request<any>('/admin/chapters/' + c.id);
      setCurrentChapter({
        ...full,
        pagesText: (full.pages || []).join('\n'),
        pagesList: full.pages || [],
        unlockAt: full.unlockAt ? full.unlockAt.slice(0, 16) : '',
        scheduledPublishAt: full.scheduledPublishAt ? full.scheduledPublishAt.slice(0, 16) : ''
      });
      setChapterModalOpen(true);
    } catch (e: any) {
      store.notify(e.message || 'Không lấy được chi tiết chương.');
    }
  };

  const onPagesTextInput = (text: string) => {
    const urls = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('http') || l.startsWith('/uploads'));
    setCurrentChapter(prev => ({
      ...prev,
      pagesText: text,
      pagesList: urls
    }));
  };

  const onFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    if (!input.files || input.files.length === 0) return;

    setUploadingImages(true);
    try {
      const token = store.getToken();
      const formData = new FormData();
      for (let i = 0; i < input.files.length; i++) {
        formData.append('files', input.files[i]);
      }

      const res = await fetch('/api/admin/chapters/upload-images', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: formData
      });

      if (!res.ok) throw new Error('Upload ảnh thất bại.');
      const data = await res.json();
      const newUrls: string[] = data.urls || [];
      setCurrentChapter(prev => {
        const updatedList = [...prev.pagesList, ...newUrls];
        return {
          ...prev,
          pagesList: updatedList,
          pagesText: updatedList.join('\n')
        };
      });
      store.notify(`Đã tải lên ${newUrls.length} ảnh thành công!`);
    } catch (e: any) {
      store.notify(e.message || 'Lỗi khi upload ảnh.');
    } finally {
      setUploadingImages(false);
      input.value = '';
    }
  };

  const removeChapterPage = (index: number) => {
    setCurrentChapter(prev => {
      const updated = [...prev.pagesList];
      updated.splice(index, 1);
      return {
        ...prev,
        pagesList: updated,
        pagesText: updated.join('\n')
      };
    });
  };

  const saveChapter = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setActionLoading(true);
    try {
      const pages = currentChapter.contentType === 'comic' ? currentChapter.pagesList : [];

      const payload = {
        number: Number(currentChapter.number) || 1,
        title: currentChapter.title?.trim() || `Chương ${currentChapter.number}`,
        language: currentChapter.language || 'vi',
        pages,
        content: currentChapter.contentType === 'novel' ? currentChapter.content : null,
        contentType: currentChapter.contentType,
        isLocked: !!currentChapter.isLocked,
        coinPrice: Number(currentChapter.coinPrice) || 0,
        unlockAt: currentChapter.unlockAt ? new Date(currentChapter.unlockAt).toISOString() : null,
        scheduledPublishAt: currentChapter.scheduledPublishAt
          ? new Date(currentChapter.scheduledPublishAt).toISOString()
          : null
      };

      if (chapterEditMode) {
        await api.request('/admin/chapters/' + currentChapter.id, 'PUT', payload);
        store.notify('Đã cập nhật chương thành công.');
      } else {
        await api.request(`/admin/mangas/${selectedMangaId}/chapters`, 'POST', payload);
        store.notify('Đã thêm chương mới thành công.');
      }
      setChapterModalOpen(false);
      void loadChapters(selectedMangaId);
    } catch (e: any) {
      store.notify(e.message || 'Lỗi khi lưu chương.');
    } finally {
      setActionLoading(false);
    }
  };

  const deleteChapter = async (c: AdminChapter) => {
    if (!confirm(`Xóa chương "${c.title}"?`)) return;
    try {
      await api.request('/admin/chapters/' + c.id, 'DELETE');
      store.notify('Đã xóa chương thành công.');
      void loadChapters(selectedMangaId);
    } catch (e: any) {
      store.notify(e.message || 'Không thể xóa chương.');
    }
  };

  // =========================================================================
  // CHAPTER DOWNLOADER (TẢI TRUYỆN THEO CHƯƠNG)
  // =========================================================================
  const openDownloadChaptersModal = (singleChap?: AdminChapter) => {
    if (!selectedMangaId || chapters.length === 0) {
      store.notify('Không có danh sách chương để tải.');
      return;
    }

    const chapNums = chapters
      .map(c => Number(c.number))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);

    const minNum = chapNums.length ? chapNums[0] : 1;
    const maxNum = chapNums.length ? chapNums[chapNums.length - 1] : 1;

    if (singleChap) {
      setDownloadRangeMode('range');
      setDownloadFromChap(singleChap.number);
      setDownloadToChap(singleChap.number);
      setDownloadSelectedChapIds([singleChap.id]);
    } else {
      setDownloadRangeMode('range');
      setDownloadFromChap(minNum);
      setDownloadToChap(maxNum);
      setDownloadSelectedChapIds(chapters.map(c => c.id));
    }

    setDownloadFormat('single_zip');
    setDownloadQuality('original');
    setIsDownloading(false);
    setDownloadProgress(0);
    setDownloadStatus('');
    setDownloadLogs([]);
    setDownloadChapSearch('');
    setDownloadModalOpen(true);
  };

  const setDownloadPreset = (preset: 'all' | 'first10' | 'last10') => {
    const sorted = [...chapters].sort((a, b) => Number(a.number) - Number(b.number));
    if (!sorted.length) return;

    if (preset === 'all') {
      setDownloadFromChap(Number(sorted[0].number));
      setDownloadToChap(Number(sorted[sorted.length - 1].number));
      setDownloadSelectedChapIds(sorted.map(c => c.id));
    } else if (preset === 'first10') {
      const slice = sorted.slice(0, 10);
      setDownloadFromChap(Number(slice[0].number));
      setDownloadToChap(Number(slice[slice.length - 1].number));
      setDownloadSelectedChapIds(slice.map(c => c.id));
    } else if (preset === 'last10') {
      const slice = sorted.slice(-10);
      setDownloadFromChap(Number(slice[0].number));
      setDownloadToChap(Number(slice[slice.length - 1].number));
      setDownloadSelectedChapIds(slice.map(c => c.id));
    }
  };

  const toggleSelectAllChapters = (select: boolean) => {
    if (select) {
      setDownloadSelectedChapIds(chapters.map(c => c.id));
    } else {
      setDownloadSelectedChapIds([]);
    }
  };

  const toggleSelectChapter = (id: string) => {
    if (downloadSelectedChapIds.includes(id)) {
      setDownloadSelectedChapIds(downloadSelectedChapIds.filter(x => x !== id));
    } else {
      setDownloadSelectedChapIds([...downloadSelectedChapIds, id]);
    }
  };

  const isChapterSelected = (id: string): boolean => {
    return downloadSelectedChapIds.includes(id);
  };

  const getFilteredDownloadChapters = (): AdminChapter[] => {
    const q = downloadChapSearch.trim().toLowerCase();
    const sorted = [...chapters].sort((a, b) => Number(a.number) - Number(b.number));
    if (!q) return sorted;
    return sorted.filter(c => c.title.toLowerCase().includes(q) || String(c.number).includes(q));
  };

  const getSelectedDownloadCount = (): number => {
    if (downloadRangeMode === 'range') {
      const from = Math.min(downloadFromChap, downloadToChap);
      const to = Math.max(downloadFromChap, downloadToChap);
      return chapters.filter(c => Number(c.number) >= from && Number(c.number) <= to).length;
    }
    return downloadSelectedChapIds.length;
  };

  const cancelDownload = () => {
    if (downloadAbortControllerRef.current) {
      downloadAbortControllerRef.current.abort();
      downloadAbortControllerRef.current = null;
    }
    setIsDownloading(false);
    setDownloadStatus('Đã dừng tiến trình tải xuống.');
    store.notify('Đã hủy tải xuống.');
  };

  const addDownloadLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('vi-VN');
    setDownloadLogs(prev => [`[${time}] ${msg}`, ...prev.slice(0, 49)]);
  };

  const fetchImageBlobWithProxy = async (url: string, signal?: AbortSignal): Promise<Blob> => {
    let targetUrl = url;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      targetUrl = `/api/catalog/image-proxy?url=${encodeURIComponent(url)}`;
    }
    const res = await fetch(targetUrl, { signal });
    if (!res.ok) {
      if (targetUrl !== url) {
        try {
          const direct = await fetch(url, { signal });
          if (direct.ok) return await direct.blob();
        } catch {}
      }
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.blob();
  };

  const getChapterDetailForDownload = async (
    chapterId: string
  ): Promise<{ pages: string[]; content: string | null; title: string; number: number }> => {
    // 1. Check local admin endpoint
    try {
      const full = await api.request<any>('/admin/chapters/' + chapterId);
      if (full && ((full.pages && full.pages.length > 0) || full.content)) {
        return {
          pages: full.pages || [],
          content: full.content || null,
          title: full.title || `Chương ${full.number}`,
          number: Number(full.number) || 1
        };
      }
    } catch {}

    // 2. Check public catalog reader endpoint
    try {
      const reader = await api.request<any>('/chapters/' + chapterId);
      if (reader) {
        const isSaver = downloadQuality === 'saver';
        const pages =
          isSaver && reader.dataSaverPages && reader.dataSaverPages.length > 0
            ? reader.dataSaverPages
            : reader.pages || [];
        return {
          pages,
          content: null,
          title: reader.chapter?.title || `Chương ${reader.chapter?.number || 1}`,
          number: Number(reader.chapter?.number) || 1
        };
      }
    } catch {}

    return { pages: [], content: null, title: 'Chương', number: 1 };
  };

  const startDownloadChapters = async () => {
    let targetChapters: AdminChapter[] = [];
    if (downloadRangeMode === 'range') {
      const from = Math.min(downloadFromChap, downloadToChap);
      const to = Math.max(downloadFromChap, downloadToChap);
      targetChapters = chapters
        .filter(c => Number(c.number) >= from && Number(c.number) <= to)
        .sort((a, b) => Number(a.number) - Number(b.number));
    } else {
      const selectedSet = new Set(downloadSelectedChapIds);
      targetChapters = chapters
        .filter(c => selectedSet.has(c.id))
        .sort((a, b) => Number(a.number) - Number(b.number));
    }

    if (!targetChapters.length) {
      store.notify('Vui lòng chọn ít nhất một chương hợp lệ để tải.');
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadLogs([]);
    setDownloadStatus(`Bắt đầu tải ${targetChapters.length} chương...`);
    const abortCtrl = new AbortController();
    downloadAbortControllerRef.current = abortCtrl;
    const signal = abortCtrl.signal;

    const mangaTitle = selectedManga?.title || 'Truyen';
    const safeMangaTitle = mangaTitle.replace(/[/\\?%*:|"<>]/g, '_').trim();
    const firstNum = targetChapters[0].number;
    const lastNum = targetChapters[targetChapters.length - 1].number;

    try {
      addDownloadLog(`Khởi tạo gói tải cho "${mangaTitle}" (${targetChapters.length} chương)`);
      const rootZip = new JSZip();

      let totalPagesDownloaded = 0;
      const totalChaps = targetChapters.length;

      for (let cIdx = 0; cIdx < totalChaps; cIdx++) {
        if (signal.aborted) break;
        const chap = targetChapters[cIdx];
        const chapNumPad = String(chap.number).padStart(3, '0');
        const chapFolderName = `Chuong_${chapNumPad}`;

        setDownloadStatus(`[${cIdx + 1}/${totalChaps}] Đang tải ${chap.title}...`);
        addDownloadLog(`[${cIdx + 1}/${totalChaps}] Lấy dữ liệu: ${chap.title}`);

        const detail = await getChapterDetailForDownload(chap.id);

        if (detail.content) {
          rootZip.folder(chapFolderName)?.file(`${chapFolderName}.txt`, detail.content);
          addDownloadLog(`✓ Đã lưu nội dung văn bản cho ${chap.title}`);
        } else if (detail.pages && detail.pages.length > 0) {
          const chapFolder = rootZip.folder(chapFolderName);
          const totalPages = detail.pages.length;

          for (let pIdx = 0; pIdx < totalPages; pIdx++) {
            if (signal.aborted) break;
            const imgUrl = detail.pages[pIdx];
            const pageNumPad = String(pIdx + 1).padStart(3, '0');
            const ext = imgUrl.includes('.png') ? 'png' : imgUrl.includes('.webp') ? 'webp' : 'jpg';
            const fileName = `${pageNumPad}.${ext}`;

            setDownloadStatus(`[${cIdx + 1}/${totalChaps}] ${chap.title} • Ảnh ${pIdx + 1}/${totalPages}`);

            try {
              const blob = await fetchImageBlobWithProxy(imgUrl, signal);
              chapFolder?.file(fileName, blob);
              totalPagesDownloaded++;
            } catch (err: any) {
              if (signal.aborted) break;
              addDownloadLog(`⚠ Lỗi tải ảnh ${pIdx + 1} của ${chap.title}: ${err.message || ''}`);
            }

            const currentChapProgress = (pIdx + 1) / totalPages;
            const overall = ((cIdx + currentChapProgress) / totalChaps) * 85;
            setDownloadProgress(Math.round(overall));
          }
          addDownloadLog(`✓ Đã tải xong ${detail.pages.length} trang của ${chap.title}`);
        } else {
          addDownloadLog(`⚠ Không tìm thấy nội dung hình ảnh cho ${chap.title}`);
        }
      }

      if (signal.aborted) {
        return;
      }

      setDownloadStatus('Đang nén file ZIP... Vui lòng đợi trong giây lát.');
      addDownloadLog('Bắt đầu nén toàn bộ tệp thành định dạng ZIP...');
      setDownloadProgress(88);

      const zipBlob = await rootZip.generateAsync(
        {
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 5 }
        },
        metadata => {
          setDownloadProgress(88 + Math.round(metadata.percent * 0.11));
          setDownloadStatus(`Đang nén ZIP: ${Math.round(metadata.percent)}%`);
        }
      );

      setDownloadProgress(100);
      setDownloadStatus('Nén xong! Đang lưu tệp về máy...');
      addDownloadLog('Hoàn tất đóng gói! Đang kích hoạt tải về máy.');

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `[DokiHentai]_${safeMangaTitle}_Chap_${firstNum}_den_${lastNum}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadStatus(`Tải về thành công ${totalChaps} chương (${totalPagesDownloaded} ảnh)!`);
      store.notify(`Đã xuất file ZIP thành công (${totalChaps} chương)!`);
    } catch (e: any) {
      if (!signal.aborted) {
        setDownloadStatus(`Lỗi: ${e.message || 'Không thể tải chương.'}`);
        addDownloadLog(`❌ Lỗi: ${e.message || 'Lỗi không xác định'}`);
        store.notify('Có lỗi xảy ra khi tải chương.');
      }
    } finally {
      setIsDownloading(false);
      downloadAbortControllerRef.current = null;
    }
  };

  // =========================================================================
  // 4. TAXONOMY MANAGEMENT
  // =========================================================================
  const loadTaxonomy = async (type = taxonomyType) => {
    setLoading(true);
    try {
      const items = await api.request<AdminTaxonomy[]>('/admin/taxonomy?type=' + type);
      setTaxonomyItems(items || []);
    } catch (e: any) {
      store.notify(e.message || 'Không tải được danh mục taxonomy.');
    } finally {
      setLoading(false);
    }
  };

  const openCreateTaxonomyModal = () => {
    setTaxonomyEditMode(false);
    setCurrentTaxonomy({ id: '', type: taxonomyType, name: '', slug: '', description: '' });
    setTaxonomyModalOpen(true);
  };

  const openEditTaxonomyModal = (t: AdminTaxonomy) => {
    setTaxonomyEditMode(true);
    setCurrentTaxonomy({ ...t });
    setTaxonomyModalOpen(true);
  };

  const saveTaxonomy = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentTaxonomy.name.trim()) {
      store.notify('Vui lòng nhập tên mục.');
      return;
    }
    setActionLoading(true);
    try {
      if (taxonomyEditMode) {
        await api.request('/admin/taxonomy/' + currentTaxonomy.id, 'PUT', currentTaxonomy);
        store.notify('Đã cập nhật taxonomy.');
      } else {
        await api.request('/admin/taxonomy', 'POST', currentTaxonomy);
        store.notify('Đã thêm taxonomy mới.');
      }
      setTaxonomyModalOpen(false);
      void loadTaxonomy(taxonomyType);
    } catch (e: any) {
      store.notify(e.message || 'Lỗi khi lưu taxonomy.');
    } finally {
      setActionLoading(false);
    }
  };

  const deleteTaxonomy = async (t: AdminTaxonomy) => {
    if (!confirm(`Xóa mục "${t.name}"?`)) return;
    try {
      await api.request('/admin/taxonomy/' + t.id, 'DELETE');
      store.notify('Đã xóa taxonomy.');
      void loadTaxonomy(taxonomyType);
    } catch (e: any) {
      store.notify(e.message || 'Không thể xóa taxonomy.');
    }
  };

  // =========================================================================
  // 5. USERS & RBAC MANAGEMENT
  // =========================================================================
  const loadUsers = async (page = userPage, query = userQuery, role = userRoleFilter, status = userStatusFilter) => {
    setLoading(true);
    try {
      const res = await api.request<{ items: AdminUser[]; total: number }>(
        '/admin/users?' +
          api.query({
            page,
            pageSize: 20,
            q: query.trim(),
            role,
            status
          })
      );
      setUsers(res.items || []);
      setUserTotal(res.total || 0);
    } catch (e: any) {
      store.notify(e.message || 'Không tải được danh sách thành viên.');
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (u: AdminUser, newRole: string) => {
    try {
      await api.request(`/admin/users/${u.id}/role`, 'PATCH', { role: newRole });
      u.role = newRole;
      setUsers([...users]);
      store.notify(`Đã cập nhật vai trò của ${u.name} thành "${newRole}".`);
    } catch (e: any) {
      store.notify(e.message || 'Không thể đổi vai trò.');
    }
  };

  const toggleUserStatus = async (u: AdminUser) => {
    try {
      const res = await api.request<{ isBanned: boolean }>(`/admin/users/${u.id}/status`, 'PATCH');
      u.isBanned = res.isBanned;
      setUsers([...users]);
      store.notify(u.isBanned ? `Đã khóa tài khoản ${u.name}.` : `Đã mở khóa tài khoản ${u.name}.`);
    } catch (e: any) {
      store.notify(e.message || 'Không thể đổi trạng thái tài khoản.');
    }
  };

  const openUserCoinModal = (u: AdminUser) => {
    setSelectedUserForCoins(u);
    setCoinAdjustAmount(5000);
    setCoinAdjustNote('Cộng xu thưởng nạp / quà tặng admin');
    setUserCoinModalOpen(true);
  };

  const submitCoinAdjust = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedUserForCoins) return;
    setActionLoading(true);
    try {
      const res = await api.request<{ coins: number }>(`/admin/users/${selectedUserForCoins.id}/coins`, 'POST', {
        amount: coinAdjustAmount,
        description: coinAdjustNote
      });
      selectedUserForCoins.coins = res.coins;
      setUsers([...users]);
      store.notify(`Đã điều chỉnh số dư xu của ${selectedUserForCoins.name}: ${res.coins} xu.`);
      setUserCoinModalOpen(false);
    } catch (e: any) {
      store.notify(e.message || 'Không thể điều chỉnh xu.');
    } finally {
      setActionLoading(false);
    }
  };

  // =========================================================================
  // 6. MODERATION & REPORTS
  // =========================================================================
  const loadModeration = async (tab = moderationTab) => {
    if (tab === 'reports') void loadReports(reportPage, reportStatusFilter, reportTypeFilter);
    else if (tab === 'comments') void loadComments(commentPage, commentQuery, commentFlaggedOnly);
    else if (tab === 'keywords') void loadKeywords();
  };

  const loadReports = async (page = reportPage, status = reportStatusFilter, type = reportTypeFilter) => {
    setLoading(true);
    try {
      const res = await api.request<{ items: AdminReport[]; total: number }>(
        '/admin/reports?' +
          api.query({
            page,
            pageSize: 20,
            status,
            type
          })
      );
      setReports(res.items || []);
      setReportTotal(res.total || 0);
    } catch (e: any) {
      store.notify(e.message || 'Không tải được báo cáo.');
    } finally {
      setLoading(false);
    }
  };

  const openResolveReportModal = (r: AdminReport) => {
    setSelectedReport(r);
    setReportResolveNotes('');
    setReportResolveModalOpen(true);
  };

  const resolveReport = async (status: 'resolved' | 'dismissed') => {
    if (!selectedReport) return;
    setActionLoading(true);
    try {
      await api.request(`/admin/reports/${selectedReport.id}`, 'PATCH', {
        status,
        notes: reportResolveNotes
      });
      selectedReport.status = status;
      store.notify(status === 'resolved' ? 'Đã đánh dấu đã xử lý báo cáo.' : 'Đã bỏ qua báo cáo.');
      setReportResolveModalOpen(false);
      void loadReports(reportPage);
    } catch (e: any) {
      store.notify(e.message || 'Không thể cập nhật báo cáo.');
    } finally {
      setActionLoading(false);
    }
  };

  const loadComments = async (page = commentPage, q = commentQuery, flagged = commentFlaggedOnly) => {
    setLoading(true);
    try {
      const res = await api.request<{ items: AdminComment[]; total: number }>(
        '/admin/comments?' +
          api.query({
            page,
            pageSize: 20,
            q: q.trim(),
            flaggedOnly: flagged
          })
      );
      setComments(res.items || []);
      setCommentTotal(res.total || 0);
    } catch (e: any) {
      store.notify(e.message || 'Không tải được bình luận.');
    } finally {
      setLoading(false);
    }
  };

  const deleteComment = async (c: AdminComment) => {
    if (!confirm('Xóa bình luận này?')) return;
    try {
      await api.request('/admin/comments/' + c.id, 'DELETE');
      setComments(comments.filter(item => item.id !== c.id));
      store.notify('Đã xóa bình luận.');
    } catch (e: any) {
      store.notify(e.message || 'Không thể xóa bình luận.');
    }
  };

  const toggleFlagComment = async (c: AdminComment) => {
    try {
      const res = await api.request<{ isFlagged: boolean }>(`/admin/comments/${c.id}/flag`, 'PATCH');
      c.isFlagged = res.isFlagged;
      setComments([...comments]);
      store.notify(c.isFlagged ? 'Đã gắn cờ cảnh báo bình luận.' : 'Đã bỏ gắn cờ bình luận.');
    } catch (e: any) {
      store.notify(e.message || 'Không thể gắn cờ bình luận.');
    }
  };

  const loadKeywords = async () => {
    setLoading(true);
    try {
      const items = await api.request<{ id: string; keyword: string; action: string }[]>('/admin/keywords');
      setKeywords(items || []);
    } catch (e: any) {
      store.notify(e.message || 'Không tải được danh sách từ khóa cấm.');
    } finally {
      setLoading(false);
    }
  };

  const addKeyword = async () => {
    const kw = newKeyword.trim();
    if (!kw) return;
    try {
      await api.request('/admin/keywords', 'POST', { keyword: kw, action: 'block' });
      setNewKeyword('');
      store.notify('Đã thêm từ khóa cấm.');
      void loadKeywords();
    } catch (e: any) {
      store.notify(e.message || 'Lỗi thêm từ khóa.');
    }
  };

  const deleteKeyword = async (id: string) => {
    try {
      await api.request('/admin/keywords/' + id, 'DELETE');
      store.notify('Đã xóa từ khóa cấm.');
      void loadKeywords();
    } catch (e: any) {
      store.notify(e.message || 'Không thể xóa từ khóa.');
    }
  };

  // =========================================================================
  // 7. SYSTEM LOGS
  // =========================================================================
  const loadLogs = async (page = logPage, level = logLevelFilter, source = logSourceFilter) => {
    setLoading(true);
    try {
      const res = await api.request<{ items: AdminLog[]; total: number }>(
        '/admin/logs?' +
          api.query({
            page,
            pageSize: 25,
            level,
            source
          })
      );
      setLogs(res.items || []);
      setLogTotal(res.total || 0);
    } catch (e: any) {
      store.notify(e.message || 'Không tải được nhật ký log.');
    } finally {
      setLoading(false);
    }
  };

  if (!authorized) {
    return (
      <div className="admin-page-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem', width: '32px', height: '32px' }}></div>
          <p>Đang kiểm tra quyền quản trị viên...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page-root">
      <div className="admin-shell">
        {/* TOPBAR */}
        <header className="admin-topbar">
          <div className="topbar-left">
            <Link href="/" className="admin-brand">
              <img src="/brand-mark.png" width="32" height="32" alt="DokiHentai" className="brand-logo" />
              <span className="brand-text">
                doki<span>hentai</span>
                <span className="period">.</span>
              </span>
            </Link>
            <span className="admin-tag">ADMIN STUDIO</span>
          </div>

          <div className="topbar-right">
            <Link href="/" target="_blank" className="topbar-link-btn" title="Mở trang chủ người dùng">
              <Icon name="compass" /> <span>Xem Website</span>
            </Link>
            <button
              className={`topbar-refresh-btn ${loading ? 'spinning' : ''}`}
              onClick={() => handleSwitchTab(activeTab)}
              title="Làm mới dữ liệu"
            >
              <Icon name="refresh" />
            </button>
            <div className="admin-profile-pill">
              <span className="admin-avatar">{store.user?.name?.slice(0, 1)?.toUpperCase() || 'A'}</span>
              <div className="admin-meta">
                <span className="name">{store.user?.name}</span>
                <span className="role-badge">{store.user?.role}</span>
              </div>
              <button
                className="btn-logout"
                onClick={() => {
                  store.logout();
                  router.push('/');
                }}
                title="Đăng xuất"
              >
                <Icon name="logout" />
              </button>
            </div>
          </div>
        </header>

        {/* BODY: SIDEBAR + CONTENT */}
        <div className="admin-body">
          {/* SIDEBAR */}
          <aside className="admin-sidebar">
            <nav className="sidebar-nav">
              <div className="nav-group-title">QUẢN TRỊ VIÊN</div>

              <button
                className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => handleSwitchTab('overview')}
              >
                <Icon name="dashboard" />
                <span>Tổng quan</span>
              </button>

              <button
                className={`nav-item ${activeTab === 'mangas' ? 'active' : ''}`}
                onClick={() => handleSwitchTab('mangas')}
              >
                <Icon name="book" />
                <span>Quản lý truyện</span>
                {!!overview?.kpis?.totalMangas && (
                  <span className="nav-count">{overview.kpis.totalMangas}</span>
                )}
              </button>

              <button
                className={`nav-item ${activeTab === 'chapters' ? 'active' : ''}`}
                onClick={() => handleSwitchTab('chapters')}
              >
                <Icon name="layers" />
                <span>Quản lý chương</span>
                {!!overview?.kpis?.totalChapters && (
                  <span className="nav-count">{overview.kpis.totalChapters}</span>
                )}
              </button>

              <button
                className={`nav-item ${activeTab === 'taxonomy' ? 'active' : ''}`}
                onClick={() => handleSwitchTab('taxonomy')}
              >
                <Icon name="tag" />
                <span>Phân loại & Taxonomy</span>
              </button>

              <div className="nav-group-title">NGƯỜI DÙNG & KIỂM DUYỆT</div>

              <button
                className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => handleSwitchTab('users')}
              >
                <Icon name="users" />
                <span>Thành viên & RBAC</span>
                {!!overview?.kpis?.totalUsers && (
                  <span className="nav-count">{overview.kpis.totalUsers}</span>
                )}
              </button>

              <button
                className={`nav-item ${activeTab === 'moderation' ? 'active' : ''}`}
                onClick={() => handleSwitchTab('moderation')}
              >
                <Icon name="flag" />
                <span>Kiểm duyệt & Báo cáo</span>
                {!!overview?.recentReports?.length && (
                  <span className="nav-badge alert">{overview.recentReports.length}</span>
                )}
              </button>

              <button
                className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`}
                onClick={() => handleSwitchTab('logs')}
              >
                <Icon name="alertCircle" />
                <span>Nhật ký hệ thống</span>
              </button>
            </nav>

            <div className="sidebar-footer">
              <div className="system-status">
                <span className="status-dot online"></span>
                <span>DokiHentai Online</span>
              </div>
              <small className="version">v2.4.0 Studio Edition</small>
            </div>
          </aside>

          {/* MAIN CONTENT */}
          <main className="admin-main">
            {/* ============================================================= */}
            {/* TAB 1: OVERVIEW */}
            {/* ============================================================= */}
            {activeTab === 'overview' && (
              <div className="tab-pane fade-in">
                <div className="pane-header">
                  <div>
                    <h1 className="pane-title">Bảng điều khiển tổng quan</h1>
                    <p className="pane-subtitle">
                      Số liệu thời gian thực và chỉ số hoạt động toàn hệ thống DokiHentai
                    </p>
                  </div>
                  <div className="pane-actions">
                    <button className="btn-primary" onClick={openCreateMangaModal}>
                      <Icon name="plus" /> <span>Thêm truyện mới</span>
                    </button>
                  </div>
                </div>

                {/* KPI Cards Grid */}
                <div className="kpi-grid">
                  {/* KPI 1: Views */}
                  <div className="kpi-card glass-card">
                    <div className="kpi-header">
                      <span className="kpi-label">LƯỢT ĐỌC (VIEWS)</span>
                      <span className="kpi-icon-wrap views-icon">
                        <Icon name="fire" />
                      </span>
                    </div>
                    <div className="kpi-value">{compact(overview?.kpis?.viewsToday || 0)}</div>
                    <div className="kpi-meta">
                      <span className="kpi-sub">
                        <strong className="highlight">{compact(overview?.kpis?.viewsWeek || 0)}</strong> tuần này
                      </span>
                      <span className="dot-sep">•</span>
                      <span className="kpi-sub">
                        <strong>{compact(overview?.kpis?.viewsMonth || 0)}</strong> tháng này
                      </span>
                    </div>
                  </div>

                  {/* KPI 2: Mangas & Chapters */}
                  <div className="kpi-card glass-card">
                    <div className="kpi-header">
                      <span className="kpi-label">TỔNG SỐ TRUYỆN</span>
                      <span className="kpi-icon-wrap manga-icon">
                        <Icon name="book" />
                      </span>
                    </div>
                    <div className="kpi-value">{overview?.kpis?.totalMangas || 0}</div>
                    <div className="kpi-meta">
                      <span className="kpi-sub">
                        <strong className="highlight">+{overview?.kpis?.chaptersUpdatedToday || 0}</strong> chương mới
                        hôm nay
                      </span>
                    </div>
                  </div>

                  {/* KPI 3: Users */}
                  <div className="kpi-card glass-card">
                    <div className="kpi-header">
                      <span className="kpi-label">NGƯỜI DÙNG</span>
                      <span className="kpi-icon-wrap user-icon">
                        <Icon name="users" />
                      </span>
                    </div>
                    <div className="kpi-value">{overview?.kpis?.totalUsers || 0}</div>
                    <div className="kpi-meta">
                      <span className="kpi-sub">
                        <strong className="highlight">+{overview?.kpis?.newUsersToday || 0}</strong> đăng ký hôm nay
                      </span>
                      <span className="dot-sep">•</span>
                      <span className="kpi-sub">
                        <strong>+{overview?.kpis?.newUsersWeek || 0}</strong> tuần này
                      </span>
                    </div>
                  </div>

                  {/* KPI 4: Coins & Revenue */}
                  <div className="kpi-card glass-card">
                    <div className="kpi-header">
                      <span className="kpi-label">DOANH THU & XU NẠP</span>
                      <span className="kpi-icon-wrap coins-icon">
                        <Icon name="coins" />
                      </span>
                    </div>
                    <div className="kpi-value">
                      {compact(overview?.kpis?.totalCoins || 0)} <small className="unit">xu</small>
                    </div>
                    <div className="kpi-meta">
                      <span className="kpi-sub">
                        <strong className="highlight">+{compact(overview?.kpis?.revenueToday || 0)}</strong> nạp hôm nay
                      </span>
                      <span className="dot-sep">•</span>
                      <span className="kpi-sub">
                        <strong>{compact(overview?.kpis?.revenueMonth || 0)}</strong> tháng
                      </span>
                    </div>
                  </div>
                </div>

                {/* Charts Row */}
                <div className="charts-grid">
                  {/* Chart 1: Views 7 Days */}
                  <div className="chart-card glass-card">
                    <div className="chart-header">
                      <div>
                        <h2 className="chart-title">Biểu đồ lượt xem 7 ngày gần nhất</h2>
                        <span className="chart-desc">Thống kê xu hướng đọc truyện theo từng ngày</span>
                      </div>
                      <span className="badge-pill cyan">Live Trends</span>
                    </div>
                    <div className="svg-chart-container">
                      <svg viewBox="0 0 600 200" preserveAspectRatio="none" className="chart-svg">
                        <defs>
                          <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
                            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        {getViewsChartArea() && (
                          <>
                            <path d={getViewsChartArea()} fill="url(#viewsGradient)" />
                            <path
                              d={getViewsChartPath()}
                              fill="none"
                              stroke="#06b6d4"
                              strokeWidth="3"
                              strokeLinecap="round"
                            />
                          </>
                        )}
                      </svg>
                      {/* Day labels */}
                      <div className="chart-labels">
                        {overview?.chartViews?.map(item => (
                          <div key={item.date} className="chart-label-col">
                            <span className="point-val">{compact(item.views)}</span>
                            <span className="label-txt">{item.date}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Chart 2: Coins Deposits */}
                  <div className="chart-card glass-card">
                    <div className="chart-header">
                      <div>
                        <h2 className="chart-title">Biểu đồ nạp xu & giao dịch</h2>
                        <span className="chart-desc">Số lượng xu người dùng nạp mở khóa chương</span>
                      </div>
                      <span className="badge-pill gold">Coins Revenue</span>
                    </div>
                    <div className="bar-chart-container">
                      {overview?.chartCoins?.map(item => (
                        <div key={item.date} className="bar-col">
                          <span className="bar-val">{compact(item.coins)}</span>
                          <div className="bar-track">
                            <div
                              className="bar-fill"
                              style={{
                                height: `${item.coins > 0 ? Math.min(100, (item.coins / 30000) * 100) : 8}%`
                              }}
                            ></div>
                          </div>
                          <span className="bar-label">{item.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Columns: Reports Alert + Top Manga + System Logs */}
                <div className="dashboard-columns">
                  {/* Left: Top Mangas of the Day */}
                  <div className="dash-box glass-card">
                    <div className="dash-box-header">
                      <h3 className="dash-box-title">
                        <Icon name="trophy" /> Top truyện đọc nhiều nhất hôm nay
                      </h3>
                      <button className="btn-text" onClick={() => handleSwitchTab('mangas')}>
                        Xem tất cả
                      </button>
                    </div>
                    <div className="dash-list">
                      {overview?.topMangas?.map((m: any, i: number) => (
                        <div key={m.id} className="dash-manga-item">
                          <span className={`rank-num ${i < 3 ? 'top3' : ''}`}>{i + 1}</span>
                          <img
                            src={m.cover}
                            alt={m.title}
                            className="manga-thumb"
                            onError={e => {
                              (e.target as HTMLImageElement).src = '/cover-placeholder.svg';
                            }}
                          />
                          <div className="manga-meta">
                            <strong className="title" title={m.title}>
                              {m.title}
                            </strong>
                            <div className="sub-info">
                              <span>{m.author || 'Tác giả chưa rõ'}</span>
                              <span className="dot-sep">•</span>
                              <span>{m.chaptersCount} chương</span>
                            </div>
                          </div>
                          <div className="views-badge">
                            <Icon name="fire" />
                            <span>{compact(m.views)}</span>
                          </div>
                        </div>
                      ))}
                      {!overview?.topMangas?.length && (
                        <div className="empty-state-sm">Chưa có dữ liệu truyện hôm nay.</div>
                      )}
                    </div>
                  </div>

                  {/* Middle: Quick Reports & Alerts */}
                  <div className="dash-box glass-card">
                    <div className="dash-box-header">
                      <h3 className="dash-box-title">
                        <Icon name="flag" /> Cảnh báo & Báo cáo vi phạm gần đây
                      </h3>
                      <button className="btn-text" onClick={() => handleSwitchTab('moderation')}>
                        Kiểm duyệt
                      </button>
                    </div>
                    <div className="dash-list">
                      {overview?.recentReports?.map((r: any) => (
                        <div key={r.id} className={`report-alert-item ${r.status === 'pending' ? 'pending' : ''}`}>
                          <div
                            className={`report-badge-type ${
                              r.type === 'broken_image' ? 'broken' : r.type === 'wrong_order' ? 'order' : ''
                            }`}
                          >
                            {r.type === 'broken_image'
                              ? 'ẢNH DIE'
                              : r.type === 'wrong_order'
                              ? 'LỘN XỘN'
                              : r.type === 'translation_error'
                              ? 'DỊCH SAI'
                              : 'BÁO CÁO'}
                          </div>
                          <div className="report-info">
                            <strong className="report-reason">{r.reason}</strong>
                            <div className="report-sub">
                              <span>Bởi: {r.userName}</span>
                              {r.mangaTitle && (
                                <>
                                  <span className="dot-sep">•</span>
                                  <span className="manga-ref">{r.mangaTitle}</span>
                                </>
                              )}
                              <span className="dot-sep">•</span>
                              <span>{ago(r.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {!overview?.recentReports?.length && (
                        <div className="empty-state-sm success-note">
                          <Icon name="check" /> Không có báo cáo vi phạm nào chưa xử lý!
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: System Logs Stream */}
                  <div className="dash-box glass-card">
                    <div className="dash-box-header">
                      <h3 className="dash-box-title">
                        <Icon name="alertCircle" /> Nhật ký log hệ thống
                      </h3>
                      <button className="btn-text" onClick={() => handleSwitchTab('logs')}>
                        Xem chi tiết
                      </button>
                    </div>
                    <div className="dash-list logs-stream">
                      {overview?.recentLogs?.map((log: any) => (
                        <div key={log.id} className="log-stream-item">
                          <span
                            className={`log-level-pill ${
                              log.level === 'info'
                                ? 'info'
                                : log.level === 'warning'
                                ? 'warning'
                                : log.level === 'error'
                                ? 'error'
                                : ''
                            }`}
                          >
                            {log.level.toUpperCase()}
                          </span>
                          <div className="log-content">
                            <span className="log-msg">{log.message}</span>
                            <time className="log-time">{ago(log.createdAt)}</time>
                          </div>
                        </div>
                      ))}
                      {!overview?.recentLogs?.length && (
                        <div className="empty-state-sm">Hệ thống đang hoạt động ổn định.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 2: MANGA MANAGEMENT */}
            {/* ============================================================= */}
            {activeTab === 'mangas' && (
              <div className="tab-pane fade-in">
                <div className="pane-header">
                  <div>
                    <h1 className="pane-title">Quản lý truyện tranh</h1>
                    <p className="pane-subtitle">
                      Thêm mới, sửa đổi thông tin, điều chỉnh trạng thái và phân quyền nguồn truyện
                    </p>
                  </div>
                  <div className="pane-actions">
                    <button className="btn-primary" onClick={openCreateMangaModal}>
                      <Icon name="plus" /> <span>Thêm truyện mới</span>
                    </button>
                  </div>
                </div>

                {/* Filters bar */}
                <div className="filter-toolbar glass-card">
                  <div className="search-input-wrap">
                    <Icon name="search" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên truyện, tác giả..."
                      value={mangaQuery}
                      onChange={e => {
                        const val = e.target.value;
                        setMangaQuery(val);
                        setMangaPage(1);
                        void loadMangas(1, val, mangaStatusFilter, mangaSourceFilter, mangaVisibilityFilter);
                      }}
                    />
                  </div>

                  <div className="filter-selects">
                    <select
                      value={mangaStatusFilter}
                      onChange={e => {
                        const val = e.target.value;
                        setMangaStatusFilter(val);
                        setMangaPage(1);
                        void loadMangas(1, mangaQuery, val, mangaSourceFilter, mangaVisibilityFilter);
                      }}
                    >
                      <option value="all">Tất cả trạng thái</option>
                      <option value="ongoing">Đang tiến hành</option>
                      <option value="completed">Đã hoàn thành</option>
                      <option value="hiatus">Tạm ngưng</option>
                      <option value="cancelled">Đã hủy</option>
                    </select>

                    <select
                      value={mangaSourceFilter}
                      onChange={e => {
                        const val = e.target.value;
                        setMangaSourceFilter(val);
                        setMangaPage(1);
                        void loadMangas(1, mangaQuery, mangaStatusFilter, val, mangaVisibilityFilter);
                      }}
                    >
                      <option value="all">Tất cả nguồn</option>
                      <option value="original">Tự sáng tác</option>
                      <option value="translation">Dịch thuật</option>
                      <option value="crawl">Re-up / Crawl</option>
                    </select>

                    <select
                      value={mangaVisibilityFilter}
                      onChange={e => {
                        const val = e.target.value;
                        setMangaVisibilityFilter(val);
                        setMangaPage(1);
                        void loadMangas(1, mangaQuery, mangaStatusFilter, mangaSourceFilter, val);
                      }}
                    >
                      <option value="all">Tất cả hiển thị</option>
                      <option value="visible">Đang hiển thị</option>
                      <option value="hidden">Đang ẩn</option>
                      <option value="draft">Bản nháp</option>
                    </select>
                  </div>
                </div>

                {/* Manga Table */}
                <div className="data-table-container glass-card">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Truyện</th>
                        <th>Nguồn</th>
                        <th>Trạng thái</th>
                        <th>Chương</th>
                        <th>Lượt đọc</th>
                        <th>Cập nhật</th>
                        <th className="text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mangas.map(m => (
                        <tr key={m.id}>
                          <td className="manga-main-cell">
                            <img
                              src={m.cover}
                              alt={m.title}
                              className="table-cover"
                              onError={e => {
                                (e.target as HTMLImageElement).src = '/cover-placeholder.svg';
                              }}
                            />
                            <div className="cell-info">
                              <strong className="cell-title">{m.title}</strong>
                              <div className="cell-sub">
                                <span>{m.author || 'Tác giả chưa rõ'}</span>
                                {m.artist && (
                                  <>
                                    <span className="dot-sep">•</span>
                                    <span>Họa sĩ: {m.artist}</span>
                                  </>
                                )}
                              </div>
                              {m.genres && m.genres.length > 0 && (
                                <div className="genre-tags-mini">
                                  {m.genres.slice(0, 3).map(g => (
                                    <span key={g} className="mini-tag">
                                      {g}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`badge-source ${
                                m.sourceType === 'original'
                                  ? 'original'
                                  : m.sourceType === 'translation'
                                  ? 'trans'
                                  : 'crawl'
                              }`}
                            >
                              {m.sourceType === 'original'
                                ? 'Sáng tác'
                                : m.sourceType === 'translation'
                                ? 'Dịch thuật'
                                : 'Crawl/Reup'}
                            </span>
                          </td>
                          <td>
                            <div className="status-cell">
                              <span
                                className={`badge-status ${
                                  m.status === 'ongoing'
                                    ? 'ongoing'
                                    : m.status === 'completed'
                                    ? 'completed'
                                    : 'hiatus'
                                }`}
                              >
                                {m.status === 'ongoing'
                                  ? 'Đang tiến hành'
                                  : m.status === 'completed'
                                  ? 'Hoàn thành'
                                  : 'Tạm ngưng'}
                              </span>
                              {m.isHidden && <span className="badge-pill red">Đã ẩn</span>}
                              {m.isDraft && <span className="badge-pill gray">Nháp</span>}
                            </div>
                          </td>
                          <td>
                            <button className="btn-table-chapters" onClick={() => manageMangaChapters(m)}>
                              <Icon name="layers" /> <span>{m.chaptersCount} chương</span>
                            </button>
                          </td>
                          <td>{compact(m.views)}</td>
                          <td>{ago(m.updatedAt)}</td>
                          <td className="text-right">
                            <div className="action-buttons">
                              <button
                                className="icon-btn-action"
                                onClick={() => manageMangaChapters(m)}
                                title="Quản lý các chương"
                              >
                                <Icon name="layers" />
                              </button>
                              <button
                                className="icon-btn-action"
                                onClick={() => openEditMangaModal(m)}
                                title="Chỉnh sửa truyện"
                              >
                                <Icon name="edit" />
                              </button>
                              <button
                                className="icon-btn-action"
                                onClick={() => toggleMangaVisibility(m)}
                                title={m.isHidden ? 'Hiển thị truyện' : 'Ẩn truyện'}
                              >
                                <Icon name={m.isHidden ? 'eye' : 'eyeOff'} />
                              </button>
                              <button
                                className="icon-btn-action danger"
                                onClick={() => deleteManga(m)}
                                title="Xóa truyện"
                              >
                                <Icon name="trash" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!mangas.length && !loading && (
                        <tr>
                          <td colSpan={7} className="text-center py-6">
                            <div className="empty-table">Không tìm thấy truyện nào phù hợp với bộ lọc.</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {mangaTotal > 15 && (
                  <div className="pagination-bar">
                    <div className="pagination-info">
                      Hiển thị <strong>{(mangaPage - 1) * 15 + 1} – {Math.min(mangaTotal, mangaPage * 15)}</strong> /{' '}
                      <strong>{mangaTotal.toLocaleString()}</strong> truyện (Trang {mangaPage} /{' '}
                      {getTotalPages(mangaTotal, 15)})
                    </div>

                    <div className="page-controls">
                      <button
                        className="pag-btn"
                        disabled={mangaPage <= 1}
                        onClick={() => {
                          setMangaPage(1);
                          void loadMangas(1);
                        }}
                        title="Trang đầu"
                      >
                        <Icon name="arrowLeft" />
                        <span className="btn-text-sm">Đầu</span>
                      </button>
                      <button
                        className="pag-btn icon-only"
                        disabled={mangaPage <= 1}
                        onClick={() => {
                          const p = mangaPage - 1;
                          setMangaPage(p);
                          void loadMangas(p);
                        }}
                        title="Trang trước"
                      >
                        <Icon name="arrowLeft" />
                      </button>

                      <div className="page-numbers-group">
                        {getPageNumbers(mangaPage, mangaTotal, 15).map((p, idx) =>
                          p === '...' ? (
                            <span key={`dots-${idx}`} className="pag-dots">
                              …
                            </span>
                          ) : (
                            <button
                              key={`p-${p}`}
                              className={`pag-num-btn ${mangaPage === p ? 'active' : ''}`}
                              onClick={() => {
                                setMangaPage(Number(p));
                                void loadMangas(Number(p));
                              }}
                            >
                              {p}
                            </button>
                          )
                        )}
                      </div>

                      <button
                        className="pag-btn icon-only"
                        disabled={mangaPage >= getTotalPages(mangaTotal, 15)}
                        onClick={() => {
                          const p = mangaPage + 1;
                          setMangaPage(p);
                          void loadMangas(p);
                        }}
                        title="Trang tiếp"
                      >
                        <Icon name="arrowRight" />
                      </button>
                      <button
                        className="pag-btn"
                        disabled={mangaPage >= getTotalPages(mangaTotal, 15)}
                        onClick={() => {
                          const p = getTotalPages(mangaTotal, 15);
                          setMangaPage(p);
                          void loadMangas(p);
                        }}
                        title="Trang cuối"
                      >
                        <span className="btn-text-sm">Cuối</span>
                        <Icon name="arrowRight" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 3: CHAPTER MANAGEMENT */}
            {/* ============================================================= */}
            {activeTab === 'chapters' && (
              <div className="tab-pane fade-in">
                <div className="pane-header">
                  <div>
                    <h1 className="pane-title">Quản lý chương (Chapters)</h1>
                    <p className="pane-subtitle">
                      Soạn thảo văn bản rich text (truyện chữ) hoặc upload ảnh hàng loạt (truyện tranh), thiết lập mở
                      khóa xu
                    </p>
                  </div>
                  <div className="pane-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => openDownloadChaptersModal()}
                      disabled={!selectedMangaId || !chapters.length}
                      title="Tải xuống tệp chương theo khoảng (ZIP/ảnh) để đọc offline hoặc sao lưu"
                    >
                      <Icon name="download" /> <span>Tải truyện theo chương</span>
                    </button>
                    <button className="btn-primary" onClick={openCreateChapterModal} disabled={!selectedMangaId}>
                      <Icon name="plus" /> <span>Thêm chương mới</span>
                    </button>
                  </div>
                </div>

                {/* Manga Selector Banner */}
                <div className="manga-selector-card glass-card">
                  {selectedManga ? (
                    <div className="selected-manga-header">
                      <img
                        src={selectedManga.cover}
                        className="selected-cover"
                        alt={selectedManga.title}
                        onError={e => {
                          (e.target as HTMLImageElement).src = '/cover-placeholder.svg';
                        }}
                      />
                      <div className="selected-info">
                        <div className="badge-pill cyan">Đang chọn quản lý chương</div>
                        <h2>{selectedManga.title}</h2>
                        <div className="sub-meta">
                          <span>Tác giả: {selectedManga.author || 'Chưa cập nhật'}</span>
                          <span className="dot-sep">•</span>
                          <span>{chapters.length} chương đã xuất bản</span>
                        </div>
                      </div>
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          setSelectedMangaId('');
                          setSelectedManga(null);
                          handleSwitchTab('mangas');
                        }}
                      >
                        Chọn truyện khác
                      </button>
                    </div>
                  ) : (
                    <div className="no-manga-selected">
                      <Icon name="book" />
                      <p>Vui lòng chọn một bộ truyện để quản lý danh sách chương.</p>
                      <button className="btn-primary" onClick={() => handleSwitchTab('mangas')}>
                        Danh sách truyện
                      </button>
                    </div>
                  )}
                </div>

                {/* Chapter Filter Toolbar & Table */}
                {selectedMangaId && (
                  <>
                    <div className="filter-toolbar glass-card mt-4 mb-3">
                      <div className="search-input-wrap">
                        <Icon name="search" />
                        <input
                          type="text"
                          placeholder="Tìm tên hoặc số chương..."
                          value={chapterSearchQuery}
                          onChange={e => {
                            setChapterSearchQuery(e.target.value);
                            setChapterPage(1);
                          }}
                        />
                      </div>

                      <div className="filter-selects">
                        <select
                          value={chapterPageSize}
                          onChange={e => {
                            setChapterPageSize(Number(e.target.value));
                            setChapterPage(1);
                          }}
                        >
                          <option value={20}>20 chương / trang</option>
                          <option value={50}>50 chương / trang</option>
                          <option value={100}>100 chương / trang</option>
                          <option value={99999}>Hiển thị tất cả</option>
                        </select>
                      </div>
                    </div>

                    <div className="data-table-container glass-card">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Số tập</th>
                            <th>Tên chương</th>
                            <th>Loại nội dung</th>
                            <th>Dung lượng</th>
                            <th>Cài đặt phí / Hẹn giờ</th>
                            <th>Ngày xuất bản</th>
                            <th className="text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getPagedChapters().map(c => (
                            <tr key={c.id}>
                              <td>
                                <span className="chap-num-badge">#{c.number}</span>
                              </td>
                              <td>
                                <strong className="chap-title">{c.title}</strong>
                              </td>
                              <td>
                                <span
                                  className={`badge-pill ${c.contentType === 'novel' ? 'purple' : 'cyan'}`}
                                >
                                  {c.contentType === 'novel' ? 'Truyện chữ' : 'Truyện tranh'}
                                </span>
                              </td>
                              <td>
                                {c.contentType === 'novel' ? <span>Rich Text</span> : <span>{c.pagesCount} ảnh</span>}
                              </td>
                              <td>
                                <div className="monetize-cell">
                                  {c.isLocked ? (
                                    <span className="badge-pill gold">
                                      <Icon name="lock" /> {c.coinPrice} xu
                                    </span>
                                  ) : (
                                    <span className="badge-pill green">Miễn phí</span>
                                  )}
                                  {c.scheduledPublishAt && (
                                    <span className="badge-pill gray" title="Hẹn giờ xuất bản">
                                      <Icon name="clock" /> Hẹn giờ
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>{ago(c.publishedAt)}</td>
                              <td className="text-right">
                                <div className="action-buttons">
                                  <button
                                    className="icon-btn-action"
                                    onClick={() => openDownloadChaptersModal(c)}
                                    title="Tải chương này về máy"
                                  >
                                    <Icon name="download" />
                                  </button>
                                  <Link
                                    href={`/chuong/${c.id}`}
                                    target="_blank"
                                    className="icon-btn-action"
                                    title="Xem trên web"
                                  >
                                    <Icon name="compass" />
                                  </Link>
                                  <button
                                    className="icon-btn-action"
                                    onClick={() => openEditChapterModal(c)}
                                    title="Sửa chương"
                                  >
                                    <Icon name="edit" />
                                  </button>
                                  <button
                                    className="icon-btn-action danger"
                                    onClick={() => deleteChapter(c)}
                                    title="Xóa chương"
                                  >
                                    <Icon name="trash" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {!getFilteredChaptersList().length && !loading && (
                            <tr>
                              <td colSpan={7} className="text-center py-6">
                                <div className="empty-table">
                                  {chapterSearchQuery
                                    ? 'Không tìm thấy chương nào phù hợp với từ khóa.'
                                    : 'Bộ truyện này chưa có chương nào. Nhấn "+ Thêm chương mới" để bắt đầu!'}
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Chapter Pagination Bar */}
                    {getFilteredChaptersList().length > chapterPageSize && (
                      <div className="pagination-bar">
                        <div className="pagination-info">
                          Hiển thị{' '}
                          <strong>
                            {(chapterPage - 1) * chapterPageSize + 1} –{' '}
                            {Math.min(getFilteredChaptersList().length, chapterPage * chapterPageSize)}
                          </strong>{' '}
                          / <strong>{getFilteredChaptersList().length}</strong> chương (Trang {chapterPage} /{' '}
                          {getTotalPages(getFilteredChaptersList().length, chapterPageSize)})
                        </div>

                        <div className="page-controls">
                          <button
                            className="pag-btn"
                            disabled={chapterPage <= 1}
                            onClick={() => setChapterPage(1)}
                            title="Trang đầu"
                          >
                            <Icon name="arrowLeft" />
                            <span className="btn-text-sm">Đầu</span>
                          </button>
                          <button
                            className="pag-btn icon-only"
                            disabled={chapterPage <= 1}
                            onClick={() => setChapterPage(chapterPage - 1)}
                            title="Trang trước"
                          >
                            <Icon name="arrowLeft" />
                          </button>

                          <div className="page-numbers-group">
                            {getPageNumbers(
                              chapterPage,
                              getFilteredChaptersList().length,
                              chapterPageSize
                            ).map((p, idx) =>
                              p === '...' ? (
                                <span key={`dots-${idx}`} className="pag-dots">
                                  …
                                </span>
                              ) : (
                                <button
                                  key={`p-${p}`}
                                  className={`pag-num-btn ${chapterPage === p ? 'active' : ''}`}
                                  onClick={() => setChapterPage(Number(p))}
                                >
                                  {p}
                                </button>
                              )
                            )}
                          </div>

                          <button
                            className="pag-btn icon-only"
                            disabled={
                              chapterPage >= getTotalPages(getFilteredChaptersList().length, chapterPageSize)
                            }
                            onClick={() => setChapterPage(chapterPage + 1)}
                            title="Trang tiếp"
                          >
                            <Icon name="arrowRight" />
                          </button>
                          <button
                            className="pag-btn"
                            disabled={
                              chapterPage >= getTotalPages(getFilteredChaptersList().length, chapterPageSize)
                            }
                            onClick={() =>
                              setChapterPage(getTotalPages(getFilteredChaptersList().length, chapterPageSize))
                            }
                            title="Trang cuối"
                          >
                            <span className="btn-text-sm">Cuối</span>
                            <Icon name="arrowRight" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 4: TAXONOMY MANAGEMENT */}
            {/* ============================================================= */}
            {activeTab === 'taxonomy' && (
              <div className="tab-pane fade-in">
                <div className="pane-header">
                  <div>
                    <h1 className="pane-title">Quản lý Phân loại & Taxonomy</h1>
                    <p className="pane-subtitle">
                      Hệ thống Thể loại, Tags, Tác giả và Nhóm dịch (Scanlation Teams)
                    </p>
                  </div>
                  <div className="pane-actions">
                    <button className="btn-primary" onClick={openCreateTaxonomyModal}>
                      <Icon name="plus" /> <span>Thêm mục mới</span>
                    </button>
                  </div>
                </div>

                {/* Type Switcher Tabs */}
                <div className="sub-tabs-bar">
                  <button
                    className={`sub-tab-btn ${taxonomyType === 'genre' ? 'active' : ''}`}
                    onClick={() => {
                      setTaxonomyType('genre');
                      void loadTaxonomy('genre');
                    }}
                  >
                    <Icon name="tag" /> <span>Thể loại (Genres)</span>
                  </button>
                  <button
                    className={`sub-tab-btn ${taxonomyType === 'tag' ? 'active' : ''}`}
                    onClick={() => {
                      setTaxonomyType('tag');
                      void loadTaxonomy('tag');
                    }}
                  >
                    <Icon name="bookmark" /> <span>Tags</span>
                  </button>
                  <button
                    className={`sub-tab-btn ${taxonomyType === 'author' ? 'active' : ''}`}
                    onClick={() => {
                      setTaxonomyType('author');
                      void loadTaxonomy('author');
                    }}
                  >
                    <Icon name="user" /> <span>Tác giả</span>
                  </button>
                  <button
                    className={`sub-tab-btn ${taxonomyType === 'group' ? 'active' : ''}`}
                    onClick={() => {
                      setTaxonomyType('group');
                      void loadTaxonomy('group');
                    }}
                  >
                    <Icon name="shield" /> <span>Nhóm dịch (Scanlation)</span>
                  </button>
                </div>

                {/* Taxonomy Grid */}
                <div className="taxonomy-grid mt-4">
                  {taxonomyItems.map(item => (
                    <div key={item.id} className="taxonomy-card glass-card">
                      <div className="tax-card-top">
                        <div>
                          <h3 className="tax-name">{item.name}</h3>
                          <code className="tax-slug">/{item.slug}</code>
                        </div>
                        <div className="action-buttons">
                          <button
                            className="icon-btn-action"
                            onClick={() => openEditTaxonomyModal(item)}
                            title="Sửa"
                          >
                            <Icon name="edit" />
                          </button>
                          <button
                            className="icon-btn-action danger"
                            onClick={() => deleteTaxonomy(item)}
                            title="Xóa"
                          >
                            <Icon name="trash" />
                          </button>
                        </div>
                      </div>
                      <p className="tax-desc">{item.description || 'Chưa có mô tả cho phân loại này.'}</p>
                    </div>
                  ))}
                  {!taxonomyItems.length && !loading && (
                    <div className="empty-state-card glass-card">Chưa có mục nào trong danh mục này.</div>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 5: USERS & RBAC MANAGEMENT */}
            {/* ============================================================= */}
            {activeTab === 'users' && (
              <div className="tab-pane fade-in">
                <div className="pane-header">
                  <div>
                    <h1 className="pane-title">Quản lý người dùng & Phân quyền (RBAC)</h1>
                    <p className="pane-subtitle">
                      Quản lý thành viên, nạp/trừ xu, khóa tài khoản và phân quyền chức năng
                    </p>
                  </div>
                </div>

                {/* Filter Toolbar */}
                <div className="filter-toolbar glass-card">
                  <div className="search-input-wrap">
                    <Icon name="search" />
                    <input
                      type="text"
                      placeholder="Tìm theo email, tên người dùng..."
                      value={userQuery}
                      onChange={e => {
                        const val = e.target.value;
                        setUserQuery(val);
                        setUserPage(1);
                        void loadUsers(1, val, userRoleFilter, userStatusFilter);
                      }}
                    />
                  </div>

                  <div className="filter-selects">
                    <select
                      value={userRoleFilter}
                      onChange={e => {
                        const val = e.target.value;
                        setUserRoleFilter(val);
                        setUserPage(1);
                        void loadUsers(1, userQuery, val, userStatusFilter);
                      }}
                    >
                      <option value="all">Tất cả vai trò</option>
                      <option value="superadmin">Super Admin</option>
                      <option value="admin">Quản trị viên (Admin)</option>
                      <option value="editor">Biên tập viên (Editor)</option>
                      <option value="translator">Dịch giả (Translator)</option>
                      <option value="reader">Độc giả (Reader)</option>
                    </select>

                    <select
                      value={userStatusFilter}
                      onChange={e => {
                        const val = e.target.value;
                        setUserStatusFilter(val);
                        setUserPage(1);
                        void loadUsers(1, userQuery, userRoleFilter, val);
                      }}
                    >
                      <option value="all">Tất cả trạng thái</option>
                      <option value="active">Đang hoạt động</option>
                      <option value="banned">Bị khóa tài khoản</option>
                    </select>
                  </div>
                </div>

                {/* User Table */}
                <div className="data-table-container glass-card">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Thành viên</th>
                        <th>Vai trò (RBAC)</th>
                        <th>Số dư xu</th>
                        <th>Trạng thái</th>
                        <th>Ngày tham gia</th>
                        <th className="text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}>
                          <td className="user-main-cell">
                            <span className="user-avatar-small">
                              {u.name?.slice(0, 1)?.toUpperCase() || 'U'}
                            </span>
                            <div className="user-info">
                              <strong>{u.name}</strong>
                              <small className="muted">{u.email}</small>
                            </div>
                          </td>
                          <td>
                            {isFullAdmin() ? (
                              <select
                                value={u.role}
                                onChange={e => updateUserRole(u, e.target.value)}
                                className="role-select"
                              >
                                <option value="superadmin">Super Admin</option>
                                <option value="admin">Admin</option>
                                <option value="editor">Editor</option>
                                <option value="translator">Translator</option>
                                <option value="reader">Reader</option>
                              </select>
                            ) : (
                              <span className="badge-pill cyan">{u.role}</span>
                            )}
                          </td>
                          <td>
                            <span className="coins-badge">
                              <Icon name="coins" /> {u.coins?.toLocaleString()} xu
                            </span>
                          </td>
                          <td>
                            <span className={`badge-status ${u.isBanned ? 'banned' : 'active'}`}>
                              {u.isBanned ? 'Đã khóa' : 'Hoạt động'}
                            </span>
                          </td>
                          <td>{ago(u.createdAt)}</td>
                          <td className="text-right">
                            <div className="action-buttons">
                              <button
                                className="icon-btn-action"
                                onClick={() => openUserCoinModal(u)}
                                title="Nạp / Trừ xu"
                              >
                                <Icon name="coins" />
                              </button>
                              {isFullAdmin() && (
                                <button
                                  className={`icon-btn-action ${!u.isBanned ? 'danger' : ''}`}
                                  onClick={() => toggleUserStatus(u)}
                                  title={u.isBanned ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                                >
                                  <Icon name={u.isBanned ? 'unlock' : 'lock'} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* User Pagination */}
                {userTotal > 20 && (
                  <div className="pagination-bar">
                    <div className="pagination-info">
                      Hiển thị <strong>{(userPage - 1) * 20 + 1} – {Math.min(userTotal, userPage * 20)}</strong> /{' '}
                      <strong>{userTotal.toLocaleString()}</strong> thành viên (Trang {userPage} /{' '}
                      {getTotalPages(userTotal, 20)})
                    </div>

                    <div className="page-controls">
                      <button
                        className="pag-btn"
                        disabled={userPage <= 1}
                        onClick={() => {
                          setUserPage(1);
                          void loadUsers(1);
                        }}
                        title="Trang đầu"
                      >
                        <Icon name="arrowLeft" />
                        <span className="btn-text-sm">Đầu</span>
                      </button>
                      <button
                        className="pag-btn icon-only"
                        disabled={userPage <= 1}
                        onClick={() => {
                          const p = userPage - 1;
                          setUserPage(p);
                          void loadUsers(p);
                        }}
                        title="Trang trước"
                      >
                        <Icon name="arrowLeft" />
                      </button>

                      <div className="page-numbers-group">
                        {getPageNumbers(userPage, userTotal, 20).map((p, idx) =>
                          p === '...' ? (
                            <span key={`dots-${idx}`} className="pag-dots">
                              …
                            </span>
                          ) : (
                            <button
                              key={`p-${p}`}
                              className={`pag-num-btn ${userPage === p ? 'active' : ''}`}
                              onClick={() => {
                                setUserPage(Number(p));
                                void loadUsers(Number(p));
                              }}
                            >
                              {p}
                            </button>
                          )
                        )}
                      </div>

                      <button
                        className="pag-btn icon-only"
                        disabled={userPage >= getTotalPages(userTotal, 20)}
                        onClick={() => {
                          const p = userPage + 1;
                          setUserPage(p);
                          void loadUsers(p);
                        }}
                        title="Trang tiếp"
                      >
                        <Icon name="arrowRight" />
                      </button>
                      <button
                        className="pag-btn"
                        disabled={userPage >= getTotalPages(userTotal, 20)}
                        onClick={() => {
                          const p = getTotalPages(userTotal, 20);
                          setUserPage(p);
                          void loadUsers(p);
                        }}
                        title="Trang cuối"
                      >
                        <span className="btn-text-sm">Cuối</span>
                        <Icon name="arrowRight" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 6: MODERATION & REPORTS */}
            {/* ============================================================= */}
            {activeTab === 'moderation' && (
              <div className="tab-pane fade-in">
                <div className="pane-header">
                  <div>
                    <h1 className="pane-title">Quản lý tương tác & Kiểm duyệt</h1>
                    <p className="pane-subtitle">
                      Xử lý báo cáo lỗi từ độc giả, kiểm duyệt bình luận, và cài đặt danh sách từ cấm tự động
                    </p>
                  </div>
                </div>

                {/* Moderation Sub Tabs */}
                <div className="sub-tabs-bar">
                  <button
                    className={`sub-tab-btn ${moderationTab === 'reports' ? 'active' : ''}`}
                    onClick={() => {
                      setModerationTab('reports');
                      void loadReports(1);
                    }}
                  >
                    <Icon name="flag" /> <span>Báo cáo sự cố (Reports)</span>
                  </button>
                  <button
                    className={`sub-tab-btn ${moderationTab === 'comments' ? 'active' : ''}`}
                    onClick={() => {
                      setModerationTab('comments');
                      void loadComments(1);
                    }}
                  >
                    <Icon name="comment" /> <span>Quản lý bình luận</span>
                  </button>
                  <button
                    className={`sub-tab-btn ${moderationTab === 'keywords' ? 'active' : ''}`}
                    onClick={() => {
                      setModerationTab('keywords');
                      void loadKeywords();
                    }}
                  >
                    <Icon name="shield" /> <span>Từ khóa cấm (Blacklist)</span>
                  </button>
                </div>

                {/* SUB-TAB A: REPORTS */}
                {moderationTab === 'reports' && (
                  <div className="mt-4">
                    <div className="filter-toolbar glass-card mb-4">
                      <div className="filter-selects">
                        <select
                          value={reportStatusFilter}
                          onChange={e => {
                            const val = e.target.value;
                            setReportStatusFilter(val);
                            setReportPage(1);
                            void loadReports(1, val, reportTypeFilter);
                          }}
                        >
                          <option value="all">Tất cả trạng thái</option>
                          <option value="pending">Đang chờ xử lý</option>
                          <option value="resolved">Đã khắc phục</option>
                          <option value="dismissed">Bỏ qua</option>
                        </select>

                        <select
                          value={reportTypeFilter}
                          onChange={e => {
                            const val = e.target.value;
                            setReportTypeFilter(val);
                            setReportPage(1);
                            void loadReports(1, reportStatusFilter, val);
                          }}
                        >
                          <option value="all">Tất cả loại lỗi</option>
                          <option value="broken_image">Ảnh die / Lỗi tải ảnh</option>
                          <option value="wrong_order">Chương lộn xộn</option>
                          <option value="translation_error">Dịch sai / Trùng lặp</option>
                          <option value="comment_spam">Bình luận spam</option>
                        </select>
                      </div>
                    </div>

                    <div className="data-table-container glass-card">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Loại sự cố</th>
                            <th>Lý do & Mô tả</th>
                            <th>Truyện / Chương</th>
                            <th>Người báo cáo</th>
                            <th>Trạng thái</th>
                            <th>Thời gian</th>
                            <th className="text-right">Xử lý</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reports.map(r => (
                            <tr key={r.id}>
                              <td>
                                <span
                                  className={`badge-pill ${
                                    r.type === 'broken_image' ? 'red' : r.type === 'wrong_order' ? 'amber' : ''
                                  }`}
                                >
                                  {r.type === 'broken_image'
                                    ? 'Ảnh hỏng'
                                    : r.type === 'wrong_order'
                                    ? 'Chương lộn'
                                    : r.type === 'translation_error'
                                    ? 'Dịch sai'
                                    : 'Khác'}
                                </span>
                              </td>
                              <td>
                                <div className="report-reason-text">
                                  <strong>{r.reason}</strong>
                                  {r.notes && <small className="admin-notes-preview">Ghi chú: {r.notes}</small>}
                                </div>
                              </td>
                              <td>
                                <div>
                                  <strong>{r.mangaTitle || 'Chung'}</strong>
                                  {r.chapterTitle && <div className="muted small">{r.chapterTitle}</div>}
                                </div>
                              </td>
                              <td>{r.userName}</td>
                              <td>
                                <span
                                  className={`badge-status ${
                                    r.status === 'pending'
                                      ? 'ongoing'
                                      : r.status === 'resolved'
                                      ? 'completed'
                                      : 'hiatus'
                                  }`}
                                >
                                  {r.status === 'pending'
                                    ? 'Chờ duyệt'
                                    : r.status === 'resolved'
                                    ? 'Đã xong'
                                    : 'Bỏ qua'}
                                </span>
                              </td>
                              <td>{ago(r.createdAt)}</td>
                              <td className="text-right">
                                <button className="btn-sm btn-primary" onClick={() => openResolveReportModal(r)}>
                                  Xử lý
                                </button>
                              </td>
                            </tr>
                          ))}
                          {!reports.length && !loading && (
                            <tr>
                              <td colSpan={7} className="text-center py-6">
                                Không có báo cáo nào trong danh mục này.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* SUB-TAB B: COMMENTS */}
                {moderationTab === 'comments' && (
                  <div className="mt-4">
                    <div className="filter-toolbar glass-card mb-4">
                      <div className="search-input-wrap">
                        <Icon name="search" />
                        <input
                          type="text"
                          placeholder="Tìm theo nội dung bình luận..."
                          value={commentQuery}
                          onChange={e => {
                            const val = e.target.value;
                            setCommentQuery(val);
                            setCommentPage(1);
                            void loadComments(1, val, commentFlaggedOnly);
                          }}
                        />
                      </div>
                      <label className="flag-filter-label">
                        <input
                          type="checkbox"
                          checked={commentFlaggedOnly}
                          onChange={e => {
                            const val = e.target.checked;
                            setCommentFlaggedOnly(val);
                            setCommentPage(1);
                            void loadComments(1, commentQuery, val);
                          }}
                        />
                        <span>Chỉ hiện bình luận bị gắn cờ / vi phạm từ ngữ</span>
                      </label>
                    </div>

                    <div className="data-table-container glass-card">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Người bình luận</th>
                            <th>Truyện</th>
                            <th>Nội dung</th>
                            <th>Cảnh báo</th>
                            <th>Thời gian</th>
                            <th className="text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comments.map(c => (
                            <tr key={c.id}>
                              <td>
                                <strong>{c.userName}</strong>
                                <div className="muted small">{c.userEmail}</div>
                              </td>
                              <td>
                                <strong>{c.mangaTitle}</strong>
                              </td>
                              <td className="comment-body-cell">
                                <p className="comment-txt">{c.body}</p>
                              </td>
                              <td>
                                {c.isFlagged ? (
                                  <span className="badge-pill red">
                                    <Icon name="flag" /> Bị gắn cờ
                                  </span>
                                ) : (
                                  <span className="badge-pill green">Hợp lệ</span>
                                )}
                              </td>
                              <td>{ago(c.createdAt)}</td>
                              <td className="text-right">
                                <div className="action-buttons">
                                  <button
                                    className={`icon-btn-action ${c.isFlagged ? 'alert' : ''}`}
                                    onClick={() => toggleFlagComment(c)}
                                    title={c.isFlagged ? 'Bỏ gắn cờ' : 'Gắn cờ vi phạm'}
                                  >
                                    <Icon name="flag" />
                                  </button>
                                  <button
                                    className="icon-btn-action danger"
                                    onClick={() => deleteComment(c)}
                                    title="Xóa spam"
                                  >
                                    <Icon name="trash" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Comment Pagination */}
                    {commentTotal > 20 && (
                      <div className="pagination-bar">
                        <div className="pagination-info">
                          Hiển thị <strong>{(commentPage - 1) * 20 + 1} – {Math.min(commentTotal, commentPage * 20)}</strong>{' '}
                          / <strong>{commentTotal.toLocaleString()}</strong> bình luận
                        </div>

                        <div className="page-controls">
                          <button
                            className="pag-btn icon-only"
                            disabled={commentPage <= 1}
                            onClick={() => {
                              const p = commentPage - 1;
                              setCommentPage(p);
                              void loadComments(p);
                            }}
                            title="Trang trước"
                          >
                            <Icon name="arrowLeft" />
                          </button>
                          <div className="page-numbers-group">
                            {getPageNumbers(commentPage, commentTotal, 20).map((p, idx) =>
                              p === '...' ? (
                                <span key={`dots-${idx}`} className="pag-dots">
                                  …
                                </span>
                              ) : (
                                <button
                                  key={`p-${p}`}
                                  className={`pag-num-btn ${commentPage === p ? 'active' : ''}`}
                                  onClick={() => {
                                    setCommentPage(Number(p));
                                    void loadComments(Number(p));
                                  }}
                                >
                                  {p}
                                </button>
                              )
                            )}
                          </div>
                          <button
                            className="pag-btn icon-only"
                            disabled={commentPage >= getTotalPages(commentTotal, 20)}
                            onClick={() => {
                              const p = commentPage + 1;
                              setCommentPage(p);
                              void loadComments(p);
                            }}
                            title="Trang tiếp"
                          >
                            <Icon name="arrowRight" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* SUB-TAB C: BANNED KEYWORDS */}
                {moderationTab === 'keywords' && (
                  <div className="mt-4">
                    <div className="keyword-add-bar glass-card mb-4">
                      <div className="search-input-wrap">
                        <input
                          type="text"
                          placeholder="Nhập từ hoặc cụm từ cần cấm..."
                          value={newKeyword}
                          onChange={e => setNewKeyword(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') addKeyword();
                          }}
                        />
                      </div>
                      <button className="btn-primary" onClick={addKeyword} disabled={!newKeyword.trim()}>
                        <Icon name="plus" /> <span>Thêm vào danh sách cấm</span>
                      </button>
                    </div>

                    <div className="keywords-list glass-card">
                      <div className="keywords-wrap">
                        {keywords.map(kw => (
                          <div key={kw.id} className="keyword-chip">
                            <span>{kw.keyword}</span>
                            <button onClick={() => deleteKeyword(kw.id)} title="Xóa">
                              <Icon name="close" />
                            </button>
                          </div>
                        ))}
                        {!keywords.length && (
                          <div className="empty-state-sm">Chưa có từ khóa nào trong danh sách cấm.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 7: LOGS */}
            {/* ============================================================= */}
            {activeTab === 'logs' && (
              <div className="tab-pane fade-in">
                <div className="pane-header">
                  <div>
                    <h1 className="pane-title">Nhật ký hệ thống (System Logs)</h1>
                    <p className="pane-subtitle">
                      Theo dõi lỗi crawl ảnh, lỗi storage, phân quyền và các hoạt động quản trị
                    </p>
                  </div>
                  <button className="btn-secondary" onClick={() => loadLogs(1)}>
                    <Icon name="refresh" /> <span>Làm mới</span>
                  </button>
                </div>

                <div className="data-table-container glass-card mt-4">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Cấp độ</th>
                        <th>Phân hệ</th>
                        <th>Thông điệp / Chi tiết log</th>
                        <th>Thời gian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(l => (
                        <tr key={l.id}>
                          <td>
                            <span
                              className={`log-level-pill ${
                                l.level === 'info'
                                  ? 'info'
                                  : l.level === 'warning'
                                  ? 'warning'
                                  : l.level === 'error'
                                  ? 'error'
                                  : ''
                              }`}
                            >
                              {l.level.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <code>{l.source}</code>
                          </td>
                          <td>
                            <strong>{l.message}</strong>
                          </td>
                          <td>{ago(l.createdAt)}</td>
                        </tr>
                      ))}
                      {!logs.length && !loading && (
                        <tr>
                          <td colSpan={4} className="text-center py-6">
                            Không có dữ liệu log.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Logs Pagination */}
                {logTotal > 20 && (
                  <div className="pagination-bar">
                    <div className="pagination-info">
                      Hiển thị <strong>{(logPage - 1) * 20 + 1} – {Math.min(logTotal, logPage * 20)}</strong> /{' '}
                      <strong>{logTotal.toLocaleString()}</strong> nhật ký
                    </div>
                    <div className="page-controls">
                      <button
                        className="pag-btn icon-only"
                        disabled={logPage <= 1}
                        onClick={() => {
                          const p = logPage - 1;
                          setLogPage(p);
                          void loadLogs(p);
                        }}
                        title="Trang trước"
                      >
                        <Icon name="arrowLeft" />
                      </button>
                      <div className="page-numbers-group">
                        {getPageNumbers(logPage, logTotal, 20).map((p, idx) =>
                          p === '...' ? (
                            <span key={`dots-${idx}`} className="pag-dots">
                              …
                            </span>
                          ) : (
                            <button
                              key={`p-${p}`}
                              className={`pag-num-btn ${logPage === p ? 'active' : ''}`}
                              onClick={() => {
                                setLogPage(Number(p));
                                void loadLogs(Number(p));
                              }}
                            >
                              {p}
                            </button>
                          )
                        )}
                      </div>
                      <button
                        className="pag-btn icon-only"
                        disabled={logPage >= getTotalPages(logTotal, 20)}
                        onClick={() => {
                          const p = logPage + 1;
                          setLogPage(p);
                          void loadLogs(p);
                        }}
                        title="Trang tiếp"
                      >
                        <Icon name="arrowRight" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>

        {/* ================================================================= */}
        {/* MODAL: ADD / EDIT MANGA */}
        {/* ================================================================= */}
        {mangaModalOpen && (
          <div className="modal-backdrop" onClick={() => setMangaModalOpen(false)}>
            <div className="admin-modal glass-card" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{mangaEditMode ? 'Chỉnh sửa thông tin truyện' : 'Thêm truyện tranh mới'}</h3>
                <button className="icon-btn-close" onClick={() => setMangaModalOpen(false)}>
                  <Icon name="close" />
                </button>
              </div>

              <form className="modal-body" onSubmit={saveManga}>
                <div className="form-row-2">
                  <div className="form-group">
                    <label>
                      Tên truyện <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      value={currentManga.title}
                      onChange={e => setCurrentManga({ ...currentManga, title: e.target.value })}
                      required
                      placeholder="Nhập tên chính..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Tên khác (Alternative Title)</label>
                    <input
                      type="text"
                      value={currentManga.alternativeTitle}
                      onChange={e => setCurrentManga({ ...currentManga, alternativeTitle: e.target.value })}
                      placeholder="Tên tiếng Anh/Hàn/Nhật..."
                    />
                  </div>
                </div>

                <div className="form-row-3">
                  <div className="form-group">
                    <label>Tác giả</label>
                    <input
                      type="text"
                      value={currentManga.author}
                      onChange={e => setCurrentManga({ ...currentManga, author: e.target.value })}
                      placeholder="Tên tác giả..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Họa sĩ</label>
                    <input
                      type="text"
                      value={currentManga.artist}
                      onChange={e => setCurrentManga({ ...currentManga, artist: e.target.value })}
                      placeholder="Tên họa sĩ..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Năm phát hành</label>
                    <input
                      type="number"
                      value={currentManga.year}
                      onChange={e => setCurrentManga({ ...currentManga, year: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="form-row-3">
                  <div className="form-group">
                    <label>Nguồn truyện</label>
                    <select
                      value={currentManga.sourceType}
                      onChange={e => setCurrentManga({ ...currentManga, sourceType: e.target.value })}
                    >
                      <option value="original">Truyện tự sáng tác</option>
                      <option value="translation">Truyện dịch thuật</option>
                      <option value="crawl">Re-up / Crawl</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Trạng thái</label>
                    <select
                      value={currentManga.status}
                      onChange={e => setCurrentManga({ ...currentManga, status: e.target.value })}
                    >
                      <option value="ongoing">Đang tiến hành</option>
                      <option value="completed">Đã hoàn thành</option>
                      <option value="hiatus">Tạm ngưng</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Quốc gia</label>
                    <select
                      value={currentManga.country}
                      onChange={e => setCurrentManga({ ...currentManga, country: e.target.value })}
                    >
                      <option value="vn">Việt Nam (VN)</option>
                      <option value="kr">Hàn Quốc (Manhwa)</option>
                      <option value="cn">Trung Quốc (Manhua)</option>
                      <option value="jp">Nhật Bản (Manga)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Ảnh bìa (Cover URL)</label>
                  <div className="cover-input-preview-row">
                    <input
                      type="text"
                      value={currentManga.cover}
                      onChange={e => setCurrentManga({ ...currentManga, cover: e.target.value })}
                      placeholder="https://... hoặc /uploads/..."
                    />
                    {currentManga.cover && (
                      <img
                        src={currentManga.cover}
                        className="modal-cover-preview"
                        alt="Bìa truyện"
                        onError={e => {
                          (e.target as HTMLImageElement).src = '/cover-placeholder.svg';
                        }}
                      />
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label>Thể loại (phân cách bằng dấu phẩy)</label>
                  <input
                    type="text"
                    value={currentManga.genresInput}
                    onChange={e => setCurrentManga({ ...currentManga, genresInput: e.target.value })}
                    placeholder="Action, Romance, Isekai, Manhwa..."
                  />
                </div>

                <div className="form-group">
                  <label>Mô tả / Tóm tắt nội dung</label>
                  <textarea
                    value={currentManga.description}
                    onChange={e => setCurrentManga({ ...currentManga, description: e.target.value })}
                    rows={4}
                    placeholder="Nội dung tóm tắt..."
                  ></textarea>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Nhóm dịch (Scanlation)</label>
                    <input
                      type="text"
                      value={currentManga.scanlationGroup}
                      onChange={e => setCurrentManga({ ...currentManga, scanlationGroup: e.target.value })}
                      placeholder="Tên nhóm dịch..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Tags bổ sung</label>
                    <input
                      type="text"
                      value={currentManga.tagsInput}
                      onChange={e => setCurrentManga({ ...currentManga, tagsInput: e.target.value })}
                      placeholder="harem, he, ngot..."
                    />
                  </div>
                </div>

                <div className="form-checkbox-group">
                  <label className="cb-item">
                    <input
                      type="checkbox"
                      checked={currentManga.featured}
                      onChange={e => setCurrentManga({ ...currentManga, featured: e.target.checked })}
                    />
                    <span>Đưa lên mục Nổi bật (Featured)</span>
                  </label>
                  <label className="cb-item">
                    <input
                      type="checkbox"
                      checked={currentManga.isDraft}
                      onChange={e => setCurrentManga({ ...currentManga, isDraft: e.target.checked })}
                    />
                    <span>Lưu dưới dạng Bản nháp (Draft)</span>
                  </label>
                  <label className="cb-item">
                    <input
                      type="checkbox"
                      checked={currentManga.isHidden}
                      onChange={e => setCurrentManga({ ...currentManga, isHidden: e.target.checked })}
                    />
                    <span>Ẩn truyện khỏi trang chủ</span>
                  </label>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setMangaModalOpen(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="btn-primary" disabled={actionLoading}>
                    <span>{mangaEditMode ? 'Cập nhật truyện' : 'Thêm truyện mới'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* MODAL: ADD / EDIT CHAPTER (DUAL MODE: COMIC VS NOVEL) */}
        {/* ================================================================= */}
        {chapterModalOpen && (
          <div className="modal-backdrop" onClick={() => setChapterModalOpen(false)}>
            <div className="admin-modal wide glass-card" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h3>{chapterEditMode ? 'Chỉnh sửa chương' : 'Thêm chương mới'}</h3>
                  <span className="sub-manga-title">
                    Bộ truyện: <strong>{selectedManga?.title}</strong>
                  </span>
                </div>
                <button className="icon-btn-close" onClick={() => setChapterModalOpen(false)}>
                  <Icon name="close" />
                </button>
              </div>

              <form className="modal-body" onSubmit={saveChapter}>
                <div className="form-row-3">
                  <div className="form-group">
                    <label>
                      Số tập / Chương <span className="req">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={currentChapter.number}
                      onChange={e => setCurrentChapter({ ...currentChapter, number: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Tên chương</label>
                    <input
                      type="text"
                      value={currentChapter.title}
                      onChange={e => setCurrentChapter({ ...currentChapter, title: e.target.value })}
                      placeholder="VD: Chương 1: Bắt đầu..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Định dạng nội dung</label>
                    <select
                      value={currentChapter.contentType}
                      onChange={e =>
                        setCurrentChapter({ ...currentChapter, contentType: e.target.value as 'comic' | 'novel' })
                      }
                    >
                      <option value="comic">Truyện tranh (Upload ảnh / Manga)</option>
                      <option value="novel">Truyện chữ (Soạn thảo văn bản)</option>
                    </select>
                  </div>
                </div>

                {/* COMIC MODE: Bulk Image URLs + Local Upload */}
                {currentChapter.contentType === 'comic' && (
                  <div className="content-editor-box">
                    <div className="editor-header">
                      <label>Nội dung ảnh chương ({currentChapter.pagesList?.length || 0} ảnh)</label>
                      <div className="upload-actions">
                        <label className="btn-file-upload">
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={onFileUpload}
                            style={{ display: 'none' }}
                          />
                          <Icon name="image" /> <span>Tải lên file ảnh từ máy</span>
                        </label>
                      </div>
                    </div>

                    <div className="bulk-urls-input-wrap">
                      <textarea
                        value={currentChapter.pagesText}
                        onChange={e => onPagesTextInput(e.target.value)}
                        rows={4}
                        placeholder="Dán hàng loạt link ảnh vào đây (mỗi dòng một URL ảnh)..."
                      ></textarea>
                    </div>

                    {/* Thumbnails preview & reorder */}
                    {currentChapter.pagesList && currentChapter.pagesList.length > 0 && (
                      <div className="chapter-pages-grid">
                        {currentChapter.pagesList.map((pageUrl, idx) => (
                          <div key={`${pageUrl}-${idx}`} className="page-thumb-card">
                            <span className="page-idx">#{idx + 1}</span>
                            <img
                              src={pageUrl}
                              className="thumb-img"
                              alt={`Trang ${idx + 1}`}
                              onError={e => {
                                (e.target as HTMLImageElement).src = '/cover-placeholder.svg';
                              }}
                            />
                            <button
                              type="button"
                              className="btn-del-page"
                              onClick={() => removeChapterPage(idx)}
                            >
                              <Icon name="trash" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* NOVEL MODE: Rich Text Editor */}
                {currentChapter.contentType === 'novel' && (
                  <div className="content-editor-box">
                    <div className="editor-header">
                      <label>Trình soạn thảo văn bản Truyện Chữ</label>
                    </div>
                    <textarea
                      className="novel-textarea"
                      value={currentChapter.content}
                      onChange={e => setCurrentChapter({ ...currentChapter, content: e.target.value })}
                      rows={12}
                      placeholder="Nhập hoặc dán nội dung truyện chữ tại đây..."
                    ></textarea>
                  </div>
                )}

                {/* Monetization & Schedule Publish Section */}
                <div className="settings-grid-2 mt-4">
                  <div className="settings-box">
                    <h4 className="settings-heading">
                      <Icon name="coins" /> Cài đặt tính phí & Khóa xu
                    </h4>
                    <label className="cb-item mb-2">
                      <input
                        type="checkbox"
                        checked={currentChapter.isLocked}
                        onChange={e => setCurrentChapter({ ...currentChapter, isLocked: e.target.checked })}
                      />
                      <span>Khóa chương bằng Xu</span>
                    </label>

                    {currentChapter.isLocked && (
                      <div className="form-row-2">
                        <div className="form-group">
                          <label>Giá mở khóa (Xu)</label>
                          <input
                            type="number"
                            value={currentChapter.coinPrice}
                            onChange={e =>
                              setCurrentChapter({ ...currentChapter, coinPrice: Number(e.target.value) })
                            }
                            placeholder="50, 100..."
                          />
                        </div>
                        <div className="form-group">
                          <label>Khóa tạm thời (Tự động mở Free vào ngày)</label>
                          <input
                            type="datetime-local"
                            value={currentChapter.unlockAt}
                            onChange={e => setCurrentChapter({ ...currentChapter, unlockAt: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="settings-box">
                    <h4 className="settings-heading">
                      <Icon name="clock" /> Hẹn giờ xuất bản (Schedule Publish)
                    </h4>
                    <div className="form-group">
                      <label>Thời điểm công khai chương</label>
                      <input
                        type="datetime-local"
                        value={currentChapter.scheduledPublishAt}
                        onChange={e =>
                          setCurrentChapter({ ...currentChapter, scheduledPublishAt: e.target.value })
                        }
                      />
                      <small className="muted">Để trống nếu muốn công khai ngay lập tức.</small>
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setChapterModalOpen(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="btn-primary" disabled={actionLoading || uploadingImages}>
                    <span>{chapterEditMode ? 'Lưu thay đổi' : 'Xuất bản chương'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* MODAL: ADD / EDIT TAXONOMY */}
        {/* ================================================================= */}
        {taxonomyModalOpen && (
          <div className="modal-backdrop" onClick={() => setTaxonomyModalOpen(false)}>
            <div className="admin-modal glass-card" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{taxonomyEditMode ? 'Sửa mục Taxonomy' : 'Thêm mới Taxonomy'}</h3>
                <button className="icon-btn-close" onClick={() => setTaxonomyModalOpen(false)}>
                  <Icon name="close" />
                </button>
              </div>
              <form className="modal-body" onSubmit={saveTaxonomy}>
                <div className="form-group">
                  <label>
                    Tên mục <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    value={currentTaxonomy.name}
                    onChange={e => setCurrentTaxonomy({ ...currentTaxonomy, name: e.target.value })}
                    required
                    placeholder="VD: Action, Romance..."
                  />
                </div>
                <div className="form-group">
                  <label>Đường dẫn Slug (Tùy chọn)</label>
                  <input
                    type="text"
                    value={currentTaxonomy.slug}
                    onChange={e => setCurrentTaxonomy({ ...currentTaxonomy, slug: e.target.value })}
                    placeholder="action, romance..."
                  />
                </div>
                <div className="form-group">
                  <label>Mô tả</label>
                  <textarea
                    value={currentTaxonomy.description}
                    onChange={e => setCurrentTaxonomy({ ...currentTaxonomy, description: e.target.value })}
                    rows={3}
                  ></textarea>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setTaxonomyModalOpen(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="btn-primary" disabled={actionLoading}>
                    Lưu
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* MODAL: ADJUST USER COINS */}
        {/* ================================================================= */}
        {userCoinModalOpen && (
          <div className="modal-backdrop" onClick={() => setUserCoinModalOpen(false)}>
            <div className="admin-modal glass-card" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Điều chỉnh số dư Xu: {selectedUserForCoins?.name}</h3>
                <button className="icon-btn-close" onClick={() => setUserCoinModalOpen(false)}>
                  <Icon name="close" />
                </button>
              </div>
              <form className="modal-body" onSubmit={submitCoinAdjust}>
                <p className="muted">
                  Số dư hiện tại: <strong>{selectedUserForCoins?.coins?.toLocaleString()} xu</strong>
                </p>
                <div className="form-group">
                  <label>Số xu cộng (+) hoặc trừ (-)</label>
                  <input
                    type="number"
                    value={coinAdjustAmount}
                    onChange={e => setCoinAdjustAmount(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Lý do / Ghi chú giao dịch</label>
                  <input
                    type="text"
                    value={coinAdjustNote}
                    onChange={e => setCoinAdjustNote(e.target.value)}
                    required
                  />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setUserCoinModalOpen(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="btn-primary" disabled={actionLoading}>
                    Xác nhận điều chỉnh
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* MODAL: RESOLVE REPORT */}
        {/* ================================================================= */}
        {reportResolveModalOpen && selectedReport && (
          <div className="modal-backdrop" onClick={() => setReportResolveModalOpen(false)}>
            <div className="admin-modal glass-card" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Xử lý báo cáo sự cố</h3>
                <button className="icon-btn-close" onClick={() => setReportResolveModalOpen(false)}>
                  <Icon name="close" />
                </button>
              </div>
              <div className="modal-body">
                <div className="report-detail-preview mb-4">
                  <div className="mb-2">
                    <strong>Lý do:</strong> {selectedReport.reason}
                  </div>
                  <div className="mb-2">
                    <strong>Truyện:</strong> {selectedReport.mangaTitle || 'N/A'}{' '}
                    {selectedReport.chapterTitle ? `• ${selectedReport.chapterTitle}` : ''}
                  </div>
                  <div className="mb-2">
                    <strong>Người báo cáo:</strong> {selectedReport.userName} ({ago(selectedReport.createdAt)})
                  </div>
                </div>
                <div className="form-group">
                  <label>Ghi chú xử lý của Quản trị viên</label>
                  <textarea
                    value={reportResolveNotes}
                    onChange={e => setReportResolveNotes(e.target.value)}
                    rows={3}
                    placeholder="VD: Đã re-upload lại ảnh chương bị hỏng..."
                  ></textarea>
                </div>
                <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => resolveReport('dismissed')}
                    disabled={actionLoading}
                  >
                    Bỏ qua báo cáo
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => resolveReport('resolved')}
                    disabled={actionLoading}
                  >
                    Đã khắc phục xong
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* MODAL: DOWNLOAD CHAPTERS (TẢI TRUYỆN THEO CHƯƠNG) */}
        {/* ================================================================= */}
        {downloadModalOpen && (
          <div className="modal-backdrop" onClick={() => !isDownloading && setDownloadModalOpen(false)}>
            <div className="admin-modal download-modal glass-card" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="header-with-icon">
                  <Icon name="download" />
                  <div>
                    <h3>Tải truyện theo chương (Offline / Backup)</h3>
                    <p className="sub-text">Xuất ảnh và nội dung truyện thành tệp ZIP nén để lưu trữ hoặc đọc offline</p>
                  </div>
                </div>
                <button
                  className="icon-btn-close"
                  disabled={isDownloading}
                  onClick={() => setDownloadModalOpen(false)}
                >
                  <Icon name="close" />
                </button>
              </div>

              <div className="modal-body download-body">
                {/* Manga Info Strip */}
                <div className="download-manga-summary">
                  <img
                    src={selectedManga?.cover}
                    className="summary-cover"
                    alt={selectedManga?.title}
                    onError={e => {
                      (e.target as HTMLImageElement).src = '/cover-placeholder.svg';
                    }}
                  />
                  <div className="summary-meta">
                    <h4>{selectedManga?.title}</h4>
                    <span>
                      {chapters.length} chương khả dụng • Tác giả: {selectedManga?.author || 'Chưa rõ'}
                    </span>
                  </div>
                </div>

                {/* Mode Selector */}
                <div className="download-mode-tabs">
                  <button
                    type="button"
                    className={`mode-tab-btn ${downloadRangeMode === 'range' ? 'active' : ''}`}
                    onClick={() => setDownloadRangeMode('range')}
                    disabled={isDownloading}
                  >
                    <Icon name="layers" /> <span>Theo khoảng chương</span>
                  </button>
                  <button
                    type="button"
                    className={`mode-tab-btn ${downloadRangeMode === 'custom' ? 'active' : ''}`}
                    onClick={() => setDownloadRangeMode('custom')}
                    disabled={isDownloading}
                  >
                    <Icon name="filter" /> <span>Chọn từng chương</span>
                  </button>
                </div>

                {/* Range Mode Settings */}
                {downloadRangeMode === 'range' && (
                  <div className="range-config-card">
                    <div className="range-inputs-row">
                      <div className="range-field">
                        <label>Từ chương:</label>
                        <input
                          type="number"
                          value={downloadFromChap}
                          min={1}
                          disabled={isDownloading}
                          onChange={e => setDownloadFromChap(Number(e.target.value))}
                        />
                      </div>
                      <div className="range-sep">➔</div>
                      <div className="range-field">
                        <label>Đến chương:</label>
                        <input
                          type="number"
                          value={downloadToChap}
                          min={1}
                          disabled={isDownloading}
                          onChange={e => setDownloadToChap(Number(e.target.value))}
                        />
                      </div>
                    </div>

                    {/* Quick Presets */}
                    <div className="quick-presets">
                      <span className="preset-label">Chọn nhanh:</span>
                      <button
                        type="button"
                        className="preset-pill"
                        onClick={() => setDownloadPreset('all')}
                        disabled={isDownloading}
                      >
                        Toàn bộ chương ({chapters.length})
                      </button>
                      <button
                        type="button"
                        className="preset-pill"
                        onClick={() => setDownloadPreset('first10')}
                        disabled={isDownloading}
                      >
                        10 chương đầu
                      </button>
                      <button
                        type="button"
                        className="preset-pill"
                        onClick={() => setDownloadPreset('last10')}
                        disabled={isDownloading}
                      >
                        10 chương mới nhất
                      </button>
                    </div>

                    <div className="range-summary-note">
                      Sẽ tải{' '}
                      <strong className="text-accent">{getSelectedDownloadCount()} chương</strong> từ #
                      {Math.min(downloadFromChap, downloadToChap)} đến #{Math.max(downloadFromChap, downloadToChap)}.
                    </div>
                  </div>
                )}

                {/* Custom Selection Mode */}
                {downloadRangeMode === 'custom' && (
                  <div className="custom-chap-select-card">
                    <div className="custom-select-toolbar">
                      <div className="chap-search-box">
                        <Icon name="search" />
                        <input
                          type="text"
                          value={downloadChapSearch}
                          onChange={e => setDownloadChapSearch(e.target.value)}
                          placeholder="Tìm tên hoặc số chương..."
                          disabled={isDownloading}
                        />
                      </div>
                      <div className="select-actions">
                        <button
                          type="button"
                          className="btn-text-action"
                          onClick={() => toggleSelectAllChapters(true)}
                          disabled={isDownloading}
                        >
                          Chọn tất cả
                        </button>
                        <button
                          type="button"
                          className="btn-text-action"
                          onClick={() => toggleSelectAllChapters(false)}
                          disabled={isDownloading}
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>

                    <div className="custom-chap-list">
                      {getFilteredDownloadChapters().map(c => (
                        <label
                          key={c.id}
                          className={`chap-check-item ${isChapterSelected(c.id) ? 'selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChapterSelected(c.id)}
                            onChange={() => toggleSelectChapter(c.id)}
                            disabled={isDownloading}
                          />
                          <span className="chap-check-num">#{c.number}</span>
                          <span className="chap-check-title">{c.title}</span>
                          <span className="chap-check-pages">
                            {c.contentType === 'novel' ? 'Truyện chữ' : `${c.pagesCount} ảnh`}
                          </span>
                        </label>
                      ))}
                      {!getFilteredDownloadChapters().length && (
                        <div className="empty-chap-search">Không tìm thấy chương nào phù hợp.</div>
                      )}
                    </div>

                    <div className="custom-selection-count">
                      Đã chọn:{' '}
                      <strong className="text-accent">
                        {downloadSelectedChapIds.length} / {chapters.length} chương
                      </strong>
                    </div>
                  </div>
                )}

                {/* Options Row */}
                <div className="download-options-grid">
                  <div className="opt-col">
                    <label className="opt-label">Định dạng đóng gói:</label>
                    <select
                      value={downloadFormat}
                      onChange={e => setDownloadFormat(e.target.value as 'single_zip')}
                      disabled={isDownloading}
                    >
                      <option value="single_zip">1 Tệp ZIP gom toàn bộ chương</option>
                    </select>
                  </div>
                  <div className="opt-col">
                    <label className="opt-label">Chất lượng tải ảnh:</label>
                    <select
                      value={downloadQuality}
                      onChange={e => setDownloadQuality(e.target.value as 'original' | 'saver')}
                      disabled={isDownloading}
                    >
                      <option value="original">Chất lượng gốc (Original HD)</option>
                      <option value="saver">Tiết kiệm băng thông (Data Saver)</option>
                    </select>
                  </div>
                </div>

                {/* Progress Section */}
                {(isDownloading || downloadProgress > 0) && (
                  <div className="download-progress-card">
                    <div className="progress-top-meta">
                      <span className="progress-status-txt">{downloadStatus}</span>
                      <span className="progress-percent-val">{downloadProgress}%</span>
                    </div>
                    <div className="progress-bar-track">
                      <div className="progress-bar-fill" style={{ width: `${downloadProgress}%` }}></div>
                    </div>

                    {/* Console Logs */}
                    {downloadLogs.length > 0 && (
                      <div className="download-logs-box">
                        {downloadLogs.map((log, idx) => (
                          <div key={idx} className="log-line">
                            {log}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                {isDownloading ? (
                  <button type="button" className="btn-danger" onClick={cancelDownload}>
                    <Icon name="close" /> <span>Hủy tiến trình</span>
                  </button>
                ) : (
                  <>
                    <button type="button" className="btn-secondary" onClick={() => setDownloadModalOpen(false)}>
                      Đóng
                    </button>
                    <button
                      type="button"
                      className="btn-primary btn-start-download"
                      onClick={startDownloadChapters}
                      disabled={getSelectedDownloadCount() === 0}
                    >
                      <Icon name="download" /> <span>Bắt đầu tải ({getSelectedDownloadCount()} chương)</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
