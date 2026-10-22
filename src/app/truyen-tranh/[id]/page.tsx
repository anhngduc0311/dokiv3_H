'use client';

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Manga, Chapter, Comment, Page, Reader as ReaderData } from '../../../types';
import { api } from '../../../lib/api';
import { useStore } from '../../../contexts/store-context';
import {
  cleanDescription,
  message,
  statuses,
  compact,
  ago,
  proxyImage
} from '../../../lib/utils';
import { Icon } from '../../../components/ui/icon';
import { Pagination } from '../../../components/ui/pagination';
import { Sidebar } from '../../../components/layout/sidebar';

const ALL_EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '☺️', '😊', '😇',
  '😈', '👿', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛',
  '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑',
  '😶', '😏', '😒', '🙄', '😬', '🤥', '😔', '😪', '🤤', '😴', '😷', '🤒',
  '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸',
  '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺',
  '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓',
  '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '💀', '☠️', '💩', '🤡', '👻',
  '👽', '👾', '🤖', '🎃', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
  '💔', '💕', '💖', '👍', '👎', '👏', '🙌', '💪', '👑', '💎', '🔥', '✨',
  '⭐', '💯', '🎉'
];

const COUNTRIES: Record<string, string> = {
  ja: 'Nhật Bản',
  ko: 'Hàn Quốc',
  zh: 'Trung Quốc',
  en: 'Tiếng Anh',
  vi: 'Việt Nam'
};

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function MangaDetailContent() {
  const params = useParams();
  const router = useRouter();
  const store = useStore();

  const id = String(params?.id || '');

  const [manga, setManga] = useState<Manga | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterPage, setChapterPage] = useState(1);
  const [chapterTotal, setChapterTotal] = useState(0);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterError, setChapterError] = useState('');
  const [firstChapter, setFirstChapter] = useState<Chapter | null>(null);

  const [language, setLanguage] = useState(store.settings.language || 'vi');
  const [ascending, setAscending] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Ratings & Community
  const [community, setCommunity] = useState({ rating: 0, votes: 0, myRating: 0 });

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentPage, setCommentPage] = useState(1);
  const [body, setBody] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Inline Reply state
  const [activeReplyRootId, setActiveReplyRootId] = useState<string | null>(null);
  const [replyTargetComment, setReplyTargetComment] = useState<Comment | null>(null);
  const [inlineReplyBody, setInlineReplyBody] = useState('');
  const [inlinePosting, setInlinePosting] = useState(false);

  const [following, setFollowing] = useState(false);
  const [reading, setReading] = useState(false);

  const preloadedRef = useRef(false);
  const epochRef = useRef(0);
  const chapterEpochRef = useRef(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Build nested threaded comments
  const threadComments = useMemo(() => {
    const map = new Map<string, Comment>();
    const roots: Comment[] = [];

    comments.forEach(c => {
      map.set(c.id, { ...c, replies: [] });
    });

    comments.forEach(c => {
      const item = map.get(c.id)!;
      if (c.parentId && map.has(c.parentId)) {
        let parent = map.get(c.parentId)!;
        let guard = 0;
        while (parent.parentId && map.has(parent.parentId) && guard++ < 10) {
          parent = map.get(parent.parentId)!;
        }
        parent.replies = parent.replies || [];
        parent.replies.push(item);
      } else {
        roots.push(item);
      }
    });

    roots.forEach(r => {
      if (r.replies && r.replies.length) {
        r.replies.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }
    });

    return roots;
  }, [comments]);

  const loadManga = async (n: number) => {
    try {
      const m = await api.request<Manga>('/catalog/' + id, 'GET', undefined, true);
      if (n === epochRef.current && m) {
        setManga(m);
        if (m.chapters && m.chapters.length > 0) {
          setChapters(prev => prev.length === 0 ? m.chapters : prev);
          setChapterTotal(prev => prev === 0 ? (m.totalChapters || m.chapters.length) : prev);
          if (!firstChapter) {
            const sorted = [...m.chapters].sort((a, b) => a.number - b.number);
            setFirstChapter(sorted[0]);
          }
        }
      }
    } catch (e) {
      if (n === epochRef.current && !manga) {
        setError(message(e));
      }
    } finally {
      if (n === epochRef.current) setLoading(false);
    }
  };

  const loadChapters = async (targetPage = chapterPage, targetLang = language, targetAsc = ascending) => {
    const n = ++chapterEpochRef.current;
    const chapPath =
      `/catalog/${id}/chapters?` +
      api.query({
        page: targetPage,
        language: targetLang,
        ascending: targetAsc
      });

    const cached = api.getCached<Page<Chapter>>(chapPath);
    if (cached && cached.items && cached.items.length > 0) {
      setChapters(cached.items);
      setChapterTotal(cached.total || cached.items.length);
      setChapterLoading(false);
      return;
    }

    setChapterLoading(true);
    setChapterError('');
    try {
      const r = await api.request<Page<Chapter>>(chapPath, 'GET', undefined, true);
      if (n === chapterEpochRef.current && r && Array.isArray(r.items)) {
        setChapters(r.items);
        setChapterTotal(r.total || r.items.length);
        if (r.items.length > 0 && !firstChapter) {
          const sorted = [...r.items].sort((a, b) => a.number - b.number);
          setFirstChapter(sorted[0]);
        }
      }
    } catch (e) {
      if (n === chapterEpochRef.current && !chapters.length) {
        setChapters([]);
        setChapterError(message(e));
      }
    } finally {
      if (n === chapterEpochRef.current) setChapterLoading(false);
    }
  };

  const loadCommunity = async () => {
    try {
      const comm = await api.request<{ rating: number; votes: number; myRating?: number }>(
        `/catalog/${id}/community`
      );
      setCommunity({ rating: comm.rating, votes: comm.votes, myRating: comm.myRating ?? 0 });
    } catch {}
  };

  const loadComments = async (targetPage = commentPage) => {
    try {
      const r = await api.request<Page<Comment>>(
        `/comments?mangaId=${id}&page=${targetPage}`
      );
      setComments(r.items || []);
      setCommentsTotal(r.total || 0);
    } catch (e) {
      store.notify(message(e));
    }
  };

  const preloadFirstChapter = async () => {
    if (preloadedRef.current) return;
    try {
      const r = await api.request<Page<Chapter>>(
        `/catalog/${id}/chapters?language=${language}&ascending=true&page=1`,
        'GET',
        undefined,
        true
      );
      const first = r.items[0];
      if (!first) return;
      setFirstChapter(first);
      preloadedRef.current = true;
      const chapterData = await api.request<ReaderData>(`/chapters/${first.id}`);
      if (!chapterData) return;
      const pages =
        (store.settings.dataSaver && chapterData.dataSaverPages?.length
          ? chapterData.dataSaverPages
          : chapterData.pages) || [];
      pages.slice(0, 4).forEach(url => {
        const img = new Image();
        img.src = proxyImage(url);
      });
    } catch {}
  };

  useEffect(() => {
    if (!id) return;
    setChapterPage(1);
    setCommentPage(1);
    setFirstChapter(null);
    preloadedRef.current = false;

    // Check cache for instant rendering
    const cachedManga = api.getCached<Manga>('/catalog/' + id);
    if (cachedManga) {
      setManga(cachedManga);
      setLoading(false);
    } else {
      setManga(null);
      setLoading(true);
    }

    const n = ++epochRef.current;
    setError('');

    void Promise.allSettled([
      loadManga(n),
      loadChapters(1, language, ascending),
      loadCommunity(),
      loadComments(1)
    ]);

    const timer = setTimeout(() => void preloadFirstChapter(), 1000);
    return () => clearTimeout(timer);
  }, [id]);

  const resume = () => {
    return store.history.find(x => x.mangaId === id);
  };

  const isChapterRead = (chapterId: string): boolean => {
    return store.history.some(h => h.mangaId === id && h.chapterId === chapterId);
  };

  const follow = async () => {
    if (!store.user) {
      router.push(`/dang-nhap?returnUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (!manga) return;
    setFollowing(true);
    try {
      await store.follow(manga);
    } catch (e) {
      store.notify(message(e));
    } finally {
      setFollowing(false);
    }
  };

  const readFirst = async () => {
    if (firstChapter) {
      router.push(`/chuong/${firstChapter.id}`);
      return;
    }
    if (chapters.length > 0) {
      const sorted = [...chapters].sort((a, b) => a.number - b.number);
      router.push(`/chuong/${sorted[0].id}`);
      return;
    }
    setReading(true);
    try {
      const r = await api.request<Page<Chapter>>(
        `/catalog/${id}/chapters?language=${language}&ascending=true&page=1`,
        'GET',
        undefined,
        true
      );
      if (r && r.items && r.items[0]) {
        setFirstChapter(r.items[0]);
        router.push(`/chuong/${r.items[0].id}`);
      } else {
        router.push(`/chuong/${id}`);
      }
    } catch {
      router.push(`/chuong/${id}`);
    } finally {
      setReading(false);
    }
  };

  const getAuthors = (authorStr?: string): string[] => {
    if (!authorStr || authorStr === 'Đang cập nhật' || authorStr === 'Chưa rõ' || authorStr === 'Unknown') return [];
    return authorStr
      .split(/[\/,]/)
      .map(a => a.trim())
      .filter(a => a.length > 0 && a !== 'Đang cập nhật' && a !== 'Chưa rõ' && a !== 'Unknown');
  };

  const findGenre = async (name: string) => {
    try {
      const tags = await api.request<{ id: string; name: string }[]>('/catalog/tags');
      const t = tags.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (t) {
        router.push(`/tim-truyen-nang-cao?genre=${t.id}`);
      } else {
        router.push(`/tim-truyen-nang-cao?genre=${encodeURIComponent(name)}`);
      }
    } catch {
      router.push(`/tim-truyen-nang-cao?genre=${encodeURIComponent(name)}`);
    }
  };

  const rate = async (score: number) => {
    if (!store.user) {
      store.notify('Vui lòng đăng nhập để đánh giá.');
      return;
    }
    try {
      await api.request(`/catalog/${id}/rating`, 'PUT', { score });
      await loadCommunity();
      store.notify('Đã lưu đánh giá ' + score + ' điểm của bạn!');
    } catch (e) {
      store.notify(message(e));
    }
  };

  const startCooldown = (seconds = 15) => {
    setCooldown(seconds);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const openInlineReply = (root: Comment, target?: Comment) => {
    setActiveReplyRootId(root.id);
    setReplyTargetComment(target || root);
    setInlineReplyBody('');
    setTimeout(() => {
      const input = document.getElementById('reply-input-' + root.id) as HTMLInputElement | null;
      if (input) {
        input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        input.focus();
      }
    }, 100);
  };

  const cancelInlineReply = () => {
    setActiveReplyRootId(null);
    setReplyTargetComment(null);
    setInlineReplyBody('');
  };

  const sendInlineReply = async (root: Comment) => {
    if (cooldown > 0) {
      store.notify(`Vui lòng đợi ${cooldown} giây trước khi bình luận tiếp.`);
      return;
    }
    const text = inlineReplyBody.trim();
    if (!text) return;
    setInlinePosting(true);
    try {
      const target = replyTargetComment || root;
      await api.request(`/catalog/${id}/comments`, 'POST', {
        body: text,
        parentId: target.id
      });
      setInlineReplyBody('');
      setActiveReplyRootId(null);
      setReplyTargetComment(null);
      startCooldown(15);
      await loadComments(commentPage);
      store.notify('Đã gửi câu trả lời.');
    } catch (e) {
      store.notify(message(e));
    } finally {
      setInlinePosting(false);
    }
  };

  const postComment = async () => {
    if (cooldown > 0) {
      store.notify(`Vui lòng đợi ${cooldown} giây trước khi bình luận tiếp.`);
      return;
    }
    setPosting(true);
    try {
      await api.request(`/catalog/${id}/comments`, 'POST', { body });
      setBody('');
      setCommentPage(1);
      startCooldown(15);
      await loadComments(1);
      store.notify('Đã gửi bình luận thành công.');
    } catch (e) {
      store.notify(message(e));
    } finally {
      setPosting(false);
    }
  };

  const insertEmoji = (em: string) => {
    setBody(prev => prev + em);
  };

  const goBack = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        router.push('/');
      }
    }
  };

  const changeChapterPage = (p: number) => {
    setChapterPage(p);
    void loadChapters(p, language, ascending);
  };

  const changeCommentPage = (p: number) => {
    setCommentPage(p);
    void loadComments(p);
  };

  const onLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    setChapterPage(1);
    preloadedRef.current = false;
    void loadChapters(1, newLang, ascending);
    void preloadFirstChapter();
  };

  const onSortChange = () => {
    const nextAsc = !ascending;
    setAscending(nextAsc);
    setChapterPage(1);
    void loadChapters(1, language, nextAsc);
  };

  const resumeItem = resume();

  return (
    <>
      <div className="breadcrumb">
        <button
          type="button"
          className="btn-breadcrumb-back"
          onClick={goBack}
          aria-label="Quay lại"
          title="Quay lại trang trước"
        >
          <Icon name="arrowLeft" />
          <span>Quay lại</span>
        </button>
        <span className="breadcrumb-sep">›</span>
        <Link href="/">Trang chủ</Link>
        <span className="breadcrumb-sep">›</span>
        <span className="current-crumb">{manga?.title || 'Chi tiết truyện'}</span>
      </div>

      {error && (
        <div className="error-state glass-panel">
          <Icon name="info" />
          <h3>Chưa thể tải thông tin truyện</h3>
          <p>{error}</p>
          <button className="primary" onClick={() => loadManga(++epochRef.current)}>
            Thử lại
          </button>
        </div>
      )}

      {manga && (
        <div className="columns">
          <div className="detail-main-column">
            {/* 1. DETAIL HERO SECTION */}
            <section className="detail-hero glass-panel">
              <div
                className="hero-backdrop"
                style={{ backgroundImage: `url(${manga.cover})` }}
              ></div>
              <div className="hero-overlay-content">
                <div className="detail-cover">
                  <img
                    src={manga.cover || '/cover-placeholder.svg'}
                    alt={manga.title}
                    fetchPriority="high"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onLoad={e => (e.currentTarget as HTMLElement).classList.add('loaded')}
                    onError={e => (e.currentTarget as HTMLElement).classList.add('loaded')}
                  />
                  {(manga.contentRating === 'erotica' || manga.contentRating === 'pornographic') && (
                    <span className="age-badge-detail">18+</span>
                  )}
                </div>

                <div className="detail-info">
                  <h1 className="detail-title">{manga.title}</h1>
                  {manga.alternativeTitle &&
                    manga.alternativeTitle.trim().toLowerCase() !== manga.title.trim().toLowerCase() && (
                      <p className="alternative">{manga.alternativeTitle}</p>
                    )}

                  <div className="detail-stats">
                    <span className="stat-pill star">
                      <Icon name="star" /> {manga.rating ? manga.rating.toFixed(1) : '0.0'}
                    </span>
                    <span className="stat-pill heart">
                      <Icon name="heart" /> {compact(manga.follows || 0)}
                    </span>
                    <span className="stat-pill comment">
                      <Icon name="comment" /> {commentsTotal}
                    </span>
                  </div>

                  {/* Primary CTAs on Mobile / Desktop */}
                  <div className="detail-hero-actions">
                    {resumeItem ? (
                      <Link
                        className="primary btn-read-main"
                        onMouseEnter={preloadFirstChapter}
                        href={`/chuong/${resumeItem.chapterId}`}
                      >
                        <Icon name="play" /> Đọc tiếp {resumeItem.chapterTitle}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="primary btn-read-main"
                        onMouseEnter={preloadFirstChapter}
                        onClick={readFirst}
                        disabled={reading}
                      >
                        <Icon name="book" /> {reading ? 'Đang mở…' : 'Đọc từ đầu'}
                      </button>
                    )}

                    <button
                      type="button"
                      className={`secondary btn-follow ${store.isFollowed(manga.id) ? 'followed' : ''}`}
                      onClick={follow}
                      disabled={following}
                    >
                      <Icon name={store.isFollowed(manga.id) ? 'check' : 'heart'} />
                      <span>{store.isFollowed(manga.id) ? 'Đang theo dõi' : 'Theo dõi'}</span>
                    </button>
                  </div>

                  <dl className="meta-grid">
                    <dt>Tác giả</dt>
                    <dd>
                      {manga.author && manga.author !== 'Đang cập nhật' ? (
                        getAuthors(manga.author).map((a, idx, arr) => (
                          <React.Fragment key={a}>
                            <Link
                              className="author-link"
                              href={`/tac-gia/${encodeURIComponent(a)}`}
                              title={`Xem trang tác giả ${a}`}
                            >
                              {a}
                            </Link>
                            {idx < arr.length - 1 && <span className="author-sep"> / </span>}
                          </React.Fragment>
                        ))
                      ) : (
                        <span className="muted">Đang cập nhật</span>
                      )}
                    </dd>
                    <dt>Tình trạng</dt>
                    <dd>
                      <span
                        className={`status-indicator ${
                          manga.status === 'ongoing'
                            ? 'ongoing'
                            : manga.status === 'completed'
                            ? 'completed'
                            : ''
                        }`}
                      >
                        {statuses[manga.status] || manga.status}
                      </span>
                      {manga.year && <small className="year"> {manga.year}</small>}
                    </dd>
                    <dt>Quốc gia</dt>
                    <dd>{COUNTRIES[manga.country] || manga.country}</dd>
                    <dt>Độ tuổi</dt>
                    <dd>
                      {manga.contentRating === 'safe'
                        ? 'Mọi lứa tuổi'
                        : manga.contentRating === 'suggestive'
                        ? '16+'
                        : '18+'}
                    </dd>
                  </dl>

                  <div className="tags">
                    {manga.genres &&
                      manga.genres.map(g => (
                        <button
                          key={g}
                          type="button"
                          className={`tag-pill ${g.toLowerCase() === 'romance' ? 'tag-romance' : ''}`}
                          onClick={() => findGenre(g)}
                        >
                          {g}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            </section>

            {/* 2. SUMMARY / DESCRIPTION PANEL */}
            <section className="panel summary glass-panel">
              <div className="panel-heading">
                <h2>
                  <Icon name="book" /> Tóm tắt nội dung
                </h2>
              </div>
              <p className={`description ${expanded ? 'expanded' : ''}`}>
                {cleanDescription(manga.description)}
              </p>
              {cleanDescription(manga.description).length > 250 && (
                <button
                  type="button"
                  className="text-button btn-expand-desc"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? 'Thu gọn bớt' : 'Xem toàn bộ mô tả'} ⌄
                </button>
              )}

              {/* 3. CHAPTERS LIST SECTION */}
              <div className="section-title chapters-header">
                <h2>
                  <Icon name="menu" /> Danh sách chương ({chapterTotal})
                </h2>
                <div className="chapter-options">
                  <select
                    aria-label="Ngôn ngữ chương"
                    value={language}
                    onChange={e => onLanguageChange(e.target.value)}
                  >
                    <option value="vi">🇻🇳 Tiếng Việt</option>
                    <option value="en">🇬🇧 Tiếng Anh</option>
                  </select>
                  <button
                    type="button"
                    className="secondary btn-sort-chap"
                    onClick={onSortChange}
                    title={ascending ? 'Đang hiển thị cũ đến mới' : 'Đang hiển thị mới đến cũ'}
                  >
                    {ascending ? '↑ Cũ → Mới' : '↓ Mới → Cũ'}
                  </button>
                </div>
              </div>

              {chapterLoading ? (
                <div className="chapter-loading-box">
                  <div className="search-spinner"></div>
                  <span>Đang tải danh sách chương…</span>
                </div>
              ) : (
                <>
                  <div className="chapter-list">
                    {chapters.map(c => (
                      <Link
                        key={c.id}
                        href={`/chuong/${c.id}`}
                        className={`chapter-row ${isChapterRead(c.id) ? 'is-read' : ''}`}
                      >
                        <div className="chapter-main-info">
                          <span className="chapter-title-text">{c.title}</span>
                        </div>
                        <div className="chapter-meta-right">
                          <time>{ago(c.publishedAt)}</time>
                          <Icon name="chevron" />
                        </div>
                      </Link>
                    ))}
                  </div>

                  {!chapters.length && (
                    <div className="empty-small">
                      {chapterError ||
                        'Không có chương ở ngôn ngữ này. Hãy thử đổi ngôn ngữ sang Tiếng Anh hoặc quay lại sau.'}
                      {chapterError && (
                        <button
                          type="button"
                          className="primary"
                          style={{ marginTop: 10 }}
                          onClick={() => loadChapters(chapterPage, language, ascending)}
                        >
                          Thử lại
                        </button>
                      )}
                    </div>
                  )}

                  {chapterTotal > 100 && (
                    <Pagination
                      page={chapterPage}
                      total={chapterTotal}
                      size={100}
                      change={changeChapterPage}
                    />
                  )}
                </>
              )}
            </section>

            {/* 4. RATING PANEL */}
            <section className="panel glass-panel">
              <div className="section-title">
                <h2>
                  <Icon name="star" /> Đánh giá của bạn
                </h2>
                <small className="muted">
                  Cộng đồng: {community.rating.toFixed(1)} ★ ({community.votes} lượt)
                </small>
              </div>
              <div className="rating-buttons">
                {SCORES.map(n => (
                  <button
                    key={n}
                    type="button"
                    className={community.myRating === n ? 'active' : ''}
                    aria-label={`Đánh giá ${n} điểm`}
                    onClick={() => rate(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </section>

            {/* 5. COMMENTS PANEL */}
            <section className="panel glass-panel">
              <div className="section-title">
                <h2>
                  <Icon name="comment" /> Bình luận <small className="muted">({commentsTotal})</small>
                </h2>
              </div>

              {store.user ? (
                <form
                  className="comment-form"
                  onSubmit={e => {
                    e.preventDefault();
                    postComment();
                  }}
                >
                  <textarea
                    name="comment"
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Viết bình luận cho bộ truyện này…"
                    required
                  ></textarea>

                  {/* EMOJI / SMILEY TOOLBAR */}
                  <div className="emoji-bar">
                    <button
                      type="button"
                      className={`btn-emoji-toggle ${emojiOpen ? 'active' : ''}`}
                      onClick={() => setEmojiOpen(!emojiOpen)}
                      title="Mở danh sách biểu tượng cảm xúc"
                    >
                      <span>😀</span> <span>Icon</span>
                      <span className="emoji-arrow">{emojiOpen ? '▲' : '▼'}</span>
                    </button>
                  </div>

                  {emojiOpen && (
                    <div className="emoji-picker-container glass-panel">
                      <div className="emoji-picker-header">
                        <span>BIỂU TƯỢNG CẢM XÚC (SMILEYS)</span>
                        <button
                          type="button"
                          className="btn-close-picker"
                          onClick={() => setEmojiOpen(false)}
                          aria-label="Đóng bảng icon"
                        >
                          ×
                        </button>
                      </div>
                      <div className="emoji-picker-grid">
                        {ALL_EMOJIS.map(em => (
                          <button
                            key={em}
                            type="button"
                            className="picker-emoji-btn"
                            onClick={() => insertEmoji(em)}
                            title={em}
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="comment-submit">
                    <small className="muted">{body.length} / 2.000 ký tự</small>
                    <button
                      type="submit"
                      className="primary"
                      disabled={posting || cooldown > 0 || !body.trim()}
                    >
                      {posting ? 'Đang gửi…' : cooldown > 0 ? `Đợi ${cooldown}s…` : 'Gửi bình luận'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="login-prompt glass-panel">
                  <Icon name="user" />
                  <p>
                    <Link href={`/dang-nhap?returnUrl=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '')}`}>
                      Đăng nhập
                    </Link>{' '}
                    để tham gia thảo luận cùng cộng đồng.
                  </p>
                </div>
              )}

              {/* FACEBOOK STYLE NESTED COMMENTS */}
              <div className="fb-comments-list">
                {threadComments.map(root => (
                  <div key={root.id} className="fb-thread" id={`comment-${root.id}`}>
                    {/* Root Comment */}
                    <div className="fb-comment-row root-row">
                      <span className="fb-avatar">{root.name.slice(0, 1).toUpperCase()}</span>
                      <div className="fb-comment-main">
                        <div className="fb-bubble">
                          <strong className="fb-author">{root.name}</strong>
                          <p className="fb-text">{root.body}</p>
                        </div>
                        <div className="fb-meta-bar">
                          <span className="fb-time">{ago(root.createdAt)} trước</span>
                          {store.user && (
                            <button
                              type="button"
                              className="fb-reply-btn"
                              onClick={() => openInlineReply(root, root)}
                            >
                              Trả lời
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Replies Branch */}
                    {root.replies && root.replies.length > 0 && (
                      <div className="fb-replies-branch">
                        {root.replies.map(rep => (
                          <div key={rep.id} className="fb-comment-row reply-row" id={`comment-${rep.id}`}>
                            <span className="fb-avatar sub-avatar">
                              {rep.name.slice(0, 1).toUpperCase()}
                            </span>
                            <div className="fb-comment-main">
                              <div className="fb-bubble sub-bubble">
                                <strong className="fb-author">{rep.name}</strong>
                                {rep.replyToName && rep.replyToName !== root.name && (
                                  <span className="fb-reply-to-tag">› @{rep.replyToName}</span>
                                )}
                                <p className="fb-text">{rep.body}</p>
                              </div>
                              <div className="fb-meta-bar">
                                <span className="fb-time">{ago(rep.createdAt)} trước</span>
                                {store.user && (
                                  <button
                                    type="button"
                                    className="fb-reply-btn"
                                    onClick={() => openInlineReply(root, rep)}
                                  >
                                    Trả lời
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Inline Reply Box */}
                    {activeReplyRootId === root.id && store.user && (
                      <div className="fb-inline-reply-box">
                        <span className="fb-avatar sub-avatar">
                          {store.user?.name?.slice(0, 1)?.toUpperCase() || 'U'}
                        </span>
                        <div className="fb-reply-input-wrap">
                          {replyTargetComment && replyTargetComment.id !== root.id && (
                            <div className="fb-target-badge">
                              <span>
                                Đang trả lời <strong>@{replyTargetComment.name}</strong>
                              </span>
                              <button
                                type="button"
                                className="btn-clear-target"
                                onClick={() => setReplyTargetComment(root)}
                                title="Chuyển về trả lời bình luận gốc"
                              >
                                ×
                              </button>
                            </div>
                          )}
                          <div className="fb-input-action-row">
                            <input
                              id={`reply-input-${root.id}`}
                              type="text"
                              className="fb-input-field"
                              value={inlineReplyBody}
                              onChange={e => setInlineReplyBody(e.target.value)}
                              placeholder={`Trả lời ${replyTargetComment?.name || root.name}… (nhấn Enter để gửi)`}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  sendInlineReply(root);
                                }
                              }}
                              maxLength={2000}
                            />
                            <button
                              type="button"
                              className="fb-btn-send"
                              disabled={inlinePosting || cooldown > 0 || !inlineReplyBody.trim()}
                              onClick={() => sendInlineReply(root)}
                            >
                              {inlinePosting ? '…' : cooldown > 0 ? `${cooldown}s` : 'Gửi'}
                            </button>
                            <button
                              type="button"
                              className="fb-btn-cancel"
                              onClick={cancelInlineReply}
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {comments.length === 0 && (
                  <p className="empty-small muted">
                    Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ cảm nghĩ!
                  </p>
                )}
              </div>

              {commentsTotal > 20 && (
                <Pagination
                  page={commentPage}
                  total={commentsTotal}
                  size={20}
                  change={changeCommentPage}
                />
              )}
            </section>
          </div>

          {/* Sidebar for Desktop */}
          <Sidebar />
        </div>
      )}
    </>
  );
}

export default function MangaDetailPage() {
  return (
    <Suspense fallback={<div className="loading-panel"><div className="search-spinner"></div></div>}>
      <MangaDetailContent />
    </Suspense>
  );
}
