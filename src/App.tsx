import { useEffect, useMemo, useRef, useState, type ElementType } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookCheck,
  BookOpen,
  Bookmark,
  Box,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  Code2,
  Compass,
  Database,
  ExternalLink,
  FileText,
  Flame,
  FolderGit2,
  GitBranch,
  Github,
  Globe2,
  Layers3,
  LayoutGrid,
  List,
  LoaderCircle,
  Menu,
  MessageSquare,
  Network,
  NotebookPen,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Star,
  Terminal,
  Upload,
  X,
} from "lucide-react";
import { Markdown, guideSections } from "./Markdown";
import type { Catalog, Note, Personal, Repo, Wiki } from "./types";
import {
  download,
  mergePersonal,
  parsePersonal,
  readPersonal,
  savePersonal,
} from "./storage";

type Page = "explore" | "trending" | "bookmarks" | "notes" | "pipeline";
const icons: Record<string, ElementType> = {
  harness: Box,
  memory: BrainCircuit,
  interaction: MessageSquare,
};
const categoryNames: Record<string, string> = {
  harness: "Agent Harness",
  memory: "Agent Memory",
  interaction: "人机交互",
};
const collectionNames = { classic: "经典", emerging: "新锐" };
const formatNumber = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n);
const dateText = (date: string | null | undefined) =>
  date
    ? new Date(date).toLocaleDateString("zh-CN", {
        month: "short",
        day: "numeric",
      })
    : "尚未同步";
const fullDate = (date: string) => new Date(date).toLocaleString("zh-CN");
const noteKey = (repo: Repo, wiki: Wiki) => `${repo.id}@${wiki.ref}`;
const repoHash = (repo: string, ref?: string) =>
  `#repo/${encodeURIComponent(repo)}${ref ? `/${encodeURIComponent(ref)}` : ""}`;
const externalProps = { target: "_blank", rel: "noreferrer" };

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState<Page>("explore");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recommended");
  const [language, setLanguage] = useState("all");
  const [collection, setCollection] = useState("all");
  const [layout, setLayout] = useState("grid");
  const [period, setPeriod] = useState("daily");
  const [personal, setPersonal] = useState<Personal>(() => readPersonal().data);
  const [toast, setToast] = useState(() => readPersonal().error ?? "");
  const [storageError, setStorageError] = useState(false);
  const [selected, setSelected] = useState<{
    repo: string;
    ref?: string;
  } | null>(null);
  const [noteOpen, setNoteOpen] = useState(true);
  const [notePreview, setNotePreview] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addRepo, setAddRepo] = useState("");
  const [addCategory, setAddCategory] = useState("harness");
  const [addCollection, setAddCollection] = useState("emerging");
  const searchRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const lastSaved = useRef(JSON.stringify(personal));

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/catalog.json`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Catalog) => {
        if (data.schemaVersion !== 1 || !Array.isArray(data.repos))
          throw new Error("知识库数据格式不正确");
        setCatalog(data);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setLoadError(e.message);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const readHash = () => {
      try {
        const parts = window.location.hash.slice(1).split("/");
        if (parts[0] === "repo" && parts[1])
          setSelected({
            repo: decodeURIComponent(parts[1]),
            ref: parts[2] ? decodeURIComponent(parts[2]) : undefined,
          });
        else {
          setSelected(null);
          if (
            ["trending", "bookmarks", "notes", "pipeline", "explore"].includes(
              parts[0],
            )
          )
            setPage(parts[0] as Page);
        }
      } catch {
        setToast("链接格式不正确");
      }
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    const keydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setAddOpen(false);
        setMobileNav(false);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("hashchange", readHash);
      window.removeEventListener("keydown", keydown);
    };
  }, []);
  useEffect(() => {
    const serialized = JSON.stringify(personal);
    if (lastSaved.current === serialized) return;
    try {
      savePersonal(personal);
      lastSaved.current = serialized;
      setStorageError(false);
    } catch {
      setStorageError(true);
      setToast("浏览器存储写入失败，请立即导出笔记备份。");
    }
  }, [personal]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const repos = catalog?.repos ?? [];
  const opened = selected
    ? repos.find((r) => r.id === selected.repo.toLowerCase())
    : undefined;
  const wiki =
    opened?.wikis.find((w) => w.ref === selected?.ref) ?? opened?.wikis[0];
  const activeNote =
    opened && wiki
      ? personal.notes.find((n) => n.repo === opened.id && n.ref === wiki.ref)
      : undefined;
  const counts = useMemo(
    () =>
      Object.fromEntries(
        (catalog?.categories ?? []).map((c) => [
          c.id,
          repos.filter((r) => r.category === c.id).length,
        ]),
      ),
    [catalog, repos],
  );
  const normalizedSearch = search.toLowerCase().trim();
  const visible = useMemo(
    () =>
      repos
        .filter(
          (r) =>
            (category === "all" || r.category === category) &&
            (language === "all" || r.language === language) &&
            (collection === "all" || r.collection === collection) &&
            (page !== "bookmarks" || personal.bookmarks.includes(r.id)) &&
            `${r.id} ${r.summary} ${r.description} ${r.tags.join(" ")} ${categoryNames[r.category]} ${r.collection ? collectionNames[r.collection] : ""}`
              .toLowerCase()
              .includes(normalizedSearch),
        )
        .sort((a, b) =>
          sort === "stars"
            ? b.stars - a.stars
            : sort === "updated"
              ? Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
              : Number(b.featured) - Number(a.featured) || b.stars - a.stars,
        ),
    [
      repos,
      category,
      language,
      collection,
      page,
      personal.bookmarks,
      normalizedSearch,
      sort,
    ],
  );
  const notes = personal.notes
    .filter((n) =>
      `${n.title} ${n.body} ${n.repo}`.toLowerCase().includes(normalizedSearch),
    )
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const navigate = (next: Page, cat = "all") => {
    setPage(next);
    setSelected(null);
    setCategory(cat);
    setSearch("");
    setLanguage("all");
    setCollection("all");
    setMobileNav(false);
    window.location.hash = next;
    window.scrollTo(0, 0);
  };
  const openRepo = (repo: Repo, ref?: string) => {
    window.location.hash = repoHash(repo.id, ref);
    setPersonal((p) => ({
      ...p,
      progress: {
        ...p.progress,
        [`${repo.id}@${ref ?? repo.wikis[0].ref}`]:
          p.progress[`${repo.id}@${ref ?? repo.wikis[0].ref}`] ?? "reading",
      },
    }));
    window.scrollTo(0, 0);
  };
  const toggleBookmark = (id: string) =>
    setPersonal((p) => ({
      ...p,
      bookmarks: p.bookmarks.includes(id)
        ? p.bookmarks.filter((b) => b !== id)
        : [...p.bookmarks, id],
    }));
  const updateNote = (field: "title" | "body", value: string) => {
    if (!opened || !wiki) return;
    setPersonal((p) => {
      const existing = p.notes.find(
        (n) => n.repo === opened.id && n.ref === wiki.ref,
      );
      const note: Note = {
        id: existing?.id ?? crypto.randomUUID(),
        repo: opened.id,
        ref: wiki.ref,
        title: existing?.title ?? `${opened.name} 学习笔记`,
        body: existing?.body ?? "",
        updatedAt: new Date().toISOString(),
        [field]: value,
      };
      return {
        ...p,
        notes: existing
          ? p.notes.map((n) => (n.id === existing.id ? note : n))
          : [...p.notes, note],
      };
    });
  };
  const importNotes = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("文件不能超过 10 MB");
      const incoming = parsePersonal(JSON.parse(await file.text()));
      setPersonal((p) => mergePersonal(p, incoming));
      setToast(`已合并 ${incoming.notes.length} 篇笔记，保留较新的版本`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "导入失败");
    }
    if (importRef.current) importRef.current.value = "";
  };
  const exportNotes = () => {
    download(
      `repo-atlas-notes-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(personal, null, 2),
      "application/json",
    );
    setToast("笔记与阅读状态已导出");
  };

  const navItem = (
    id: Page,
    label: string,
    Icon: ElementType,
    badge?: number | string,
  ) => (
    <button
      className={`nav-item ${page === id && !selected && category === "all" ? "active" : ""}`}
      onClick={() => navigate(id)}
    >
      <Icon size={18} />
      <span>{label}</span>
      {badge !== undefined && <small>{badge}</small>}
    </button>
  );

  return (
    <div className="app-shell">
      {mobileNav && (
        <button
          aria-label="关闭导航"
          className="sidebar-scrim"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
        <a
          className="brand"
          href="#explore"
          onClick={() => navigate("explore")}
        >
          <span className="brand-mark">
            <Box size={24} />
          </span>
          <span>
            Repo Atlas<span className="brand-subtitle">开源知识地图</span>
          </span>
        </a>
        <div className="workspace-label">
          <span className="workspace-icon">
            <Layers3 size={15} />
          </span>
          <span>
            我的研究空间<small>Personal workspace</small>
          </span>
          <span className="workspace-badge">LOCAL</span>
        </div>
        <div className="nav-label">发现 & 学习</div>
        <nav aria-label="主要导航">
          {navItem("explore", "探索仓库", Compass, repos.length)}
          {navItem("trending", "Trending", Flame, "HOT")}
          {navItem(
            "bookmarks",
            "我的收藏",
            Bookmark,
            personal.bookmarks.length || undefined,
          )}
          {navItem(
            "notes",
            "学习笔记",
            NotebookPen,
            personal.notes.length || undefined,
          )}
        </nav>
        <div className="nav-label category-nav-label">
          研究方向<span>03</span>
        </div>
        <nav aria-label="研究方向">
          {(catalog?.categories ?? []).map((c) => {
            return (
              <button
                key={c.id}
                className={`nav-item category-nav ${category === c.id && !selected ? "category-active" : ""}`}
                onClick={() => navigate("explore", c.id)}
              >
                <span className={`category-dot ${c.color}`} />
                <span>{c.id === "interaction" ? "人机交互" : c.name}</span>
                <small>{counts[c.id]}</small>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="research-card">
            <span className="research-icon">
              <Sparkles size={18} />
            </span>
            <strong>让阅读，留下痕迹。</strong>
            <p>
              从一个好项目开始，
              <br />
              构建自己的 Agent 知识体系。
            </p>
            <button onClick={() => navigate("notes")}>
              打开学习笔记 <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className={`nav-item ${page === "pipeline" ? "active" : ""}`}
            onClick={() => navigate("pipeline")}
          >
            <GitBranch size={17} />
            <span>自动化流水线</span>
            <span
              className={`status-dot ${catalog?.errors.length ? "warning" : ""}`}
            />
          </button>
          <div className="sidebar-footer">
            <span className="avatar">R</span>
            <span>
              我的知识库<small>Keep curious. Keep building.</small>
            </span>
            <button
              className="icon-button"
              aria-label="查看知识库设置"
              onClick={() => navigate("pipeline")}
            >
              <Settings2 size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="打开导航"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={20} />
            </button>
            <span>知识空间</span>
            <ChevronRight size={13} />
            <strong>
              {selected
                ? "源码知识库"
                : page === "trending"
                  ? "Trending"
                  : page === "notes"
                    ? "学习笔记"
                    : page === "bookmarks"
                      ? "我的收藏"
                      : page === "pipeline"
                        ? "自动化流水线"
                        : "探索仓库"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="sync-label">
              <span
                className={`status-dot ${catalog?.errors.length ? "warning" : ""}`}
              />
              {catalog ? `${dateText(catalog.generatedAt)}已同步` : "正在加载"}
            </span>
            <span className="top-divider" />
            <a
              className="icon-button"
              href="https://github.com"
              aria-label="打开 GitHub"
              {...externalProps}
            >
              <Github size={19} />
            </a>
            <span className="avatar small">R</span>
          </div>
        </header>

        {!catalog ? (
          <main className="loading-state">
            {loadError ? (
              <>
                <Database size={32} />
                <h2>暂时无法加载知识库</h2>
                <p>{loadError}</p>
                <p>请先运行采集脚本生成 public/data/catalog.json。</p>
                <button
                  className="primary-button"
                  onClick={() => window.location.reload()}
                >
                  重新加载
                </button>
              </>
            ) : (
              <>
                <LoaderCircle className="spin" size={30} />
                <p>正在展开你的知识地图…</p>
              </>
            )}
          </main>
        ) : selected ? (
          opened && wiki ? (
            <main className="reader-page">
              <div className="reader-top">
                <button className="text-button" onClick={() => navigate(page)}>
                  <ArrowLeft size={16} /> 返回
                  {page === "notes" ? "笔记" : "仓库"}
                </button>
                <div className="reader-tools">
                  <button
                    className={`secondary-button ${personal.bookmarks.includes(opened.id) ? "is-saved" : ""}`}
                    onClick={() => toggleBookmark(opened.id)}
                  >
                    <Bookmark
                      size={15}
                      fill={
                        personal.bookmarks.includes(opened.id)
                          ? "currentColor"
                          : "none"
                      }
                    />
                    收藏
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      download(
                        `${opened.name}-${wiki.ref.replaceAll("/", "-")}.md`,
                        wiki.markdown,
                      )
                    }
                  >
                    <ArrowDownToLine size={15} />
                    下载文档
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => setNoteOpen(!noteOpen)}
                  >
                    <NotebookPen size={15} />
                    {noteOpen ? "收起笔记" : "边读边记"}
                  </button>
                </div>
              </div>
              <div className="reader-heading">
                <div className="eyebrow">SOURCE → KNOWLEDGE</div>
                <h1>
                  {opened.owner}
                  <span> / </span>
                  {opened.name}
                </h1>
                <p>{opened.summary}</p>
                <div className="reader-meta">
                  <span className={`category-badge ${opened.category}`}>
                    {categoryNames[opened.category]}
                  </span>
                  {opened.collection && (
                    <span className={`collection-badge ${opened.collection}`}>
                      {collectionNames[opened.collection]}
                    </span>
                  )}
                  <span>
                    <Star size={14} />
                    {formatNumber(opened.stars)}
                  </span>
                  <a href={opened.url} {...externalProps}>
                    GitHub <ArrowUpRight size={13} />
                  </a>
                  <a
                    href={`https://deepwiki.com/${opened.id}`}
                    {...externalProps}
                  >
                    DeepWiki <ArrowUpRight size={13} />
                  </a>
                </div>
              </div>
              <div className="branch-bar">
                <span>
                  <GitBranch size={16} />
                  跟踪版本
                </span>
                <select
                  aria-label="切换分析分支"
                  value={wiki.ref}
                  onChange={(e) => openRepo(opened, e.target.value)}
                >
                  {opened.wikis.map((w) => (
                    <option key={w.ref} value={w.ref}>
                      {w.ref}
                    </option>
                  ))}
                </select>
                <a
                  className="commit-label"
                  href={`${opened.url}/commit/${wiki.sha}`}
                  {...externalProps}
                >
                  <Code2 size={13} />
                  {wiki.sha.slice(0, 8)}
                </a>
                <span className="branch-analysis-label">
                  {wiki.mode === "navigation"
                    ? "迁移导航"
                    : wiki.analysis?.version === 3
                      ? "架构导读"
                      : wiki.mode === "ai"
                        ? "AI 辅助分析"
                        : "源码证据索引"}{" "}
                  · {wiki.sources.length} 个来源
                </span>
                {opened.wikis.length > 1 && (
                  <a
                    className="compare-link"
                    href={`${opened.url}/compare/${opened.wikis.find((w) => w.sha !== wiki.sha)?.sha ?? opened.wikis[1].sha}...${wiki.sha}`}
                    {...externalProps}
                  >
                    比较版本 <ArrowUpRight size={13} />
                  </a>
                )}
              </div>
              {selected.ref && selected.ref !== wiki.ref && (
                <div className="notice">
                  该版本已不在当前知识库中，正在展示 {wiki.ref}。
                </div>
              )}
              <div className={`reader-layout ${noteOpen ? "with-notes" : ""}`}>
                <article className="wiki-article">
                  {wiki.analysis?.kind === "architecture" && (
                    <div className="guide-navigation">
                      <div>
                        <strong>从主线理解这个项目</strong>
                        <span>
                          {wiki.analysis.filesRead} 个源码文件 ·{" "}
                          {wiki.analysis.flowSteps} 步运行路径 ·{" "}
                          {wiki.analysis.mechanisms} 个核心机制
                        </span>
                      </div>
                      <nav aria-label="架构导读章节">
                        {guideSections.map(([id, label]) => (
                          <button
                            key={id}
                            onClick={() =>
                              document
                                .getElementById(`guide-${id}`)
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                })
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </nav>
                    </div>
                  )}
                  <Markdown anchorPrefix="guide">{wiki.markdown}</Markdown>
                  <div className="complete-reading">
                    <span>
                      <BookCheck size={20} />
                      完成一次阅读，让知识连起来。
                    </span>
                    <button
                      className="secondary-button"
                      onClick={() =>
                        setPersonal((p) => ({
                          ...p,
                          progress: {
                            ...p.progress,
                            [noteKey(opened, wiki)]:
                              p.progress[noteKey(opened, wiki)] === "done"
                                ? "reading"
                                : "done",
                          },
                        }))
                      }
                    >
                      {personal.progress[noteKey(opened, wiki)] === "done" ? (
                        <>
                          <Check size={15} /> 已读完
                        </>
                      ) : (
                        "标记为已读"
                      )}
                    </button>
                  </div>
                </article>
                {noteOpen && (
                  <aside className="note-editor">
                    <div className="note-editor-heading">
                      <span>
                        <NotebookPen size={17} />
                        我的阅读笔记
                      </span>
                      <button
                        className="icon-button"
                        aria-label="收起笔记"
                        onClick={() => setNoteOpen(false)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <p className="note-context">
                      {opened.name} <span>· {wiki.ref}</span>
                    </p>
                    <input
                      aria-label="笔记标题"
                      className="note-title"
                      maxLength={300}
                      value={activeNote?.title ?? ""}
                      onChange={(e) => updateNote("title", e.target.value)}
                      placeholder={`${opened.name} 学习笔记`}
                    />
                    <div className="note-tabs">
                      <button
                        className={!notePreview ? "active" : ""}
                        onClick={() => setNotePreview(false)}
                      >
                        编辑
                      </button>
                      <button
                        className={notePreview ? "active" : ""}
                        onClick={() => setNotePreview(true)}
                      >
                        预览
                      </button>
                      <span>Markdown</span>
                    </div>
                    {notePreview ? (
                      <div className="note-preview">
                        <Markdown>
                          {activeNote?.body || "*记下你的第一个发现…*"}
                        </Markdown>
                      </div>
                    ) : (
                      <textarea
                        aria-label="笔记内容"
                        maxLength={200000}
                        value={activeNote?.body ?? ""}
                        onChange={(e) => updateNote("body", e.target.value)}
                        placeholder={
                          "记录值得留下的思考…\n\n## 我学到了什么\n\n## 关键设计\n\n## 待验证的问题\n\n支持 Markdown，内容自动保存。"
                        }
                      />
                    )}
                    <div className="note-save-status">
                      <span
                        className={`status-dot ${storageError ? "warning" : ""}`}
                      />
                      {storageError
                        ? "保存失败，请导出备份"
                        : activeNote
                          ? "已自动保存在此浏览器"
                          : "笔记仅保存在此浏览器"}
                      <button
                        className="icon-button"
                        aria-label="导出全部笔记"
                        onClick={exportNotes}
                      >
                        <ArrowDownToLine size={14} />
                      </button>
                    </div>
                  </aside>
                )}
              </div>
            </main>
          ) : (
            <main className="loading-state">
              <FolderGit2 size={32} />
              <h2>未找到这个仓库</h2>
              <button
                className="primary-button"
                onClick={() => navigate("explore")}
              >
                返回探索
              </button>
            </main>
          )
        ) : page === "pipeline" ? (
          <main className="content-page">
            <PageHeading
              kicker="ALWAYS GROWING"
              title="让知识库，持续生长。"
              description="每天发现、按提交分析、自动构建，让每一次学习都有迹可循。"
            />
            <div className="pipeline-status">
              <span
                className={`status-dot ${catalog.errors.length ? "warning" : ""}`}
              />
              <strong>
                {catalog.errors.length
                  ? `最近同步有 ${catalog.errors.length} 条提示`
                  : "最近一次数据采集成功"}
              </strong>
              <span>{fullDate(catalog.generatedAt)}</span>
            </div>
            <div className="pipeline-steps">
              {[
                {
                  icon: Github,
                  title: "发现与采集",
                  text: `${repos.length} 个精选仓库 · 3 个研究方向`,
                  branch: "config/repos.json",
                },
                {
                  icon: Network,
                  title: "分支与源码分析",
                  text: `${repos.reduce((n, r) => n + r.wikis.length, 0)} 份独立版本文档 · 固定 commit`,
                  branch: "knowledge 分支",
                },
                {
                  icon: BookOpen,
                  title: "生成学习知识库",
                  text: "证据索引 / 可选 AI 深度分析",
                  branch: "public/knowledge/",
                },
                {
                  icon: Globe2,
                  title: "构建与自动发布",
                  text: "GitHub Actions → GitHub Pages",
                  branch: "Pages artifact",
                },
              ].map((step, i) => (
                <div className="pipeline-step" key={step.title}>
                  <span className="step-number">0{i + 1}</span>
                  <step.icon size={25} />
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                  <code>{step.branch}</code>
                </div>
              ))}
            </div>
            <div className="pipeline-panels">
              <section className="panel">
                <div className="section-title">
                  <h2>分支策略</h2>
                  <GitBranch size={18} />
                </div>
                <div className="branch-row">
                  <code>main</code>
                  <span>应用源码、采集配置与工作流</span>
                </div>
                <div className="branch-row">
                  <code>dev</code>
                  <span>日常开发与集成，检查通过后合并到 main</span>
                </div>
                <div className="branch-row">
                  <code>knowledge</code>
                  <span>自动采集数据、版本化 Markdown 知识库</span>
                </div>
                <div className="branch-row">
                  <code>feature/*</code>
                  <span>独立功能开发，经 PR 合并到 dev 或 main</span>
                </div>
                <p className="muted">
                  被研究仓库的分支和标签，分别绑定提交
                  SHA；切换版本不会混用笔记。
                </p>
              </section>
              <section className="panel">
                <div className="section-title">
                  <h2>本地数据与备份</h2>
                  <Database size={18} />
                </div>
                <p className="muted">
                  收藏、笔记和阅读状态保存在当前浏览器。通过 JSON
                  导出迁移到其他设备，导入时按笔记 ID 合并并保留较新内容。
                </p>
                <div className="button-row">
                  <button className="secondary-button" onClick={exportNotes}>
                    <ArrowDownToLine size={15} />
                    导出备份
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => importRef.current?.click()}
                  >
                    <Upload size={15} />
                    导入备份
                  </button>
                </div>
                <p className="muted">
                  新仓库：修改
                  config/repos.json，提交后由流水线采集。模型密钥仅配置在
                  Actions Secrets。
                </p>
              </section>
            </div>
            {catalog.errors.length > 0 && (
              <section className="panel error-panel">
                <h2>采集提示</h2>
                <p className="muted">
                  失败的仓库或版本会保留上次数据。Trending
                  抓取失败时保留原时间，不会显示为最新。
                </p>
                {catalog.errors.map((error, i) => (
                  <pre key={i}>{error}</pre>
                ))}
              </section>
            )}
          </main>
        ) : (
          <main className="content-page">
            {page === "explore" || page === "bookmarks" ? (
              <>
                <div className="page-heading-row">
                  <PageHeading
                    kicker={
                      page === "bookmarks"
                        ? "YOUR COLLECTION"
                        : "CURATED FOR THE CURIOUS"
                    }
                    title={
                      page === "bookmarks" ? (
                        "好项目，值得反复读。"
                      ) : category === "all" ? (
                        <>
                          发现好项目，<span>读懂好代码。</span>
                        </>
                      ) : (
                        categoryNames[category]
                      )
                    }
                    description={
                      page === "bookmarks"
                        ? "把有价值的开源项目留下，让每一次回访都有新的收获。"
                        : category === "all"
                          ? "收集值得研究的开源项目，用深度分析与学习笔记，连接你的 Agent 知识体系。"
                          : (catalog.categories.find((c) => c.id === category)
                              ?.description ?? "")
                    }
                  />
                  <button
                    className="primary-button add-repo-button"
                    onClick={() => setAddOpen(true)}
                  >
                    <Plus size={16} />
                    收录仓库
                  </button>
                </div>
                <div className="overview-stats">
                  <Stat
                    icon={FolderGit2}
                    value={String(repos.length).padStart(2, "0")}
                    label="精选仓库"
                    detail="持续收集有价值的开源"
                  />
                  <Stat
                    icon={Layers3}
                    value="03"
                    label="研究方向"
                    detail="聚焦 Agent 核心能力"
                  />
                  <Stat
                    icon={BookOpen}
                    value={String(
                      repos.reduce((n, r) => n + r.wikis.length, 0),
                    ).padStart(2, "0")}
                    label="源码学习文档"
                    detail="按分支独立分析"
                  />
                  <Stat
                    icon={NotebookPen}
                    value={String(personal.notes.length).padStart(2, "0")}
                    label="我的学习笔记"
                    detail="把阅读变成自己的知识"
                  />
                </div>
                {page === "explore" && (
                  <>
                    <div className="section-title direction-title">
                      <h2>沿着方向，深入一点</h2>
                      <span>从执行到记忆，再到人与 Agent 的连接</span>
                    </div>
                    <div className="direction-grid">
                      {catalog.categories.map((c) => {
                        const Icon = icons[c.id];
                        return (
                          <button
                            key={c.id}
                            className={`direction-card ${c.color} ${category === c.id ? "selected" : ""}`}
                            onClick={() => {
                              setCategory(category === c.id ? "all" : c.id);
                              setLanguage("all");
                            }}
                          >
                            <div className="direction-card-top">
                              <span className="direction-icon">
                                <Icon size={22} strokeWidth={1.7} />
                              </span>
                              <ArrowUpRight size={17} />
                            </div>
                            <h3>{c.name}</h3>
                            <p>{c.description}</p>
                            <div className="direction-card-bottom">
                              <span>{c.label}</span>
                              <span>
                                {counts[c.id]} 个仓库 <ArrowRight size={12} />
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                <div className="repo-section-heading">
                  <div className="section-title">
                    <h2>
                      {page === "bookmarks" ? "我的收藏" : "仓库探索"}
                      <span className="count-badge">{visible.length}</span>
                    </h2>
                    <span className="desktop-only">
                      <span className="status-dot" /> 源码分析 · 持续更新
                    </span>
                  </div>
                  <div className="filter-top">
                    <div className="filter-tabs">
                      <button
                        className={category === "all" ? "active" : ""}
                        onClick={() => setCategory("all")}
                      >
                        全部仓库{" "}
                        <span>
                          {page === "bookmarks"
                            ? personal.bookmarks.length
                            : repos.length}
                        </span>
                      </button>
                      {catalog.categories.map((c) => (
                        <button
                          key={c.id}
                          className={category === c.id ? "active" : ""}
                          onClick={() => setCategory(c.id)}
                        >
                          {c.id === "interaction" ? "人机交互" : c.name}
                        </button>
                      ))}
                    </div>
                    <div className="layout-toggle">
                      <button
                        aria-label="网格视图"
                        className={layout === "grid" ? "active" : ""}
                        onClick={() => setLayout("grid")}
                      >
                        <LayoutGrid size={16} />
                      </button>
                      <button
                        aria-label="列表视图"
                        className={layout === "list" ? "active" : ""}
                        onClick={() => setLayout("list")}
                      >
                        <List size={17} />
                      </button>
                    </div>
                  </div>
                  <div className="search-row">
                    <label className="search-box">
                      <Search size={17} />
                      <input
                        ref={searchRef}
                        placeholder="搜索仓库、技术栈或关键词…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      {search ? (
                        <button
                          aria-label="清空搜索"
                          onClick={() => setSearch("")}
                        >
                          <X size={14} />
                        </button>
                      ) : (
                        <kbd>Ctrl K</kbd>
                      )}
                    </label>
                    <div className="select-box">
                      <Layers3 size={14} />
                      <select
                        aria-label="按经典与新锐筛选"
                        value={collection}
                        onChange={(e) => setCollection(e.target.value)}
                      >
                        <option value="all">经典与新锐</option>
                        <option value="classic">经典项目</option>
                        <option value="emerging">新锐项目</option>
                      </select>
                    </div>
                    <div className="select-box">
                      <Code2 size={14} />
                      <select
                        aria-label="按语言筛选"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                      >
                        <option value="all">全部语言</option>
                        {[...new Set(repos.map((r) => r.language))]
                          .sort()
                          .map((l) => (
                            <option key={l}>{l}</option>
                          ))}
                      </select>
                    </div>
                    <div className="select-box">
                      <Settings2 size={14} />
                      <select
                        aria-label="仓库排序"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="recommended">精选推荐</option>
                        <option value="stars">Star 最多</option>
                        <option value="updated">最近更新</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div
                  className={`repo-grid ${layout === "list" ? "list-layout" : ""}`}
                >
                  {visible.map((r) => (
                    <RepoCard
                      key={r.id}
                      repo={r}
                      saved={personal.bookmarks.includes(r.id)}
                      progress={personal.progress[`${r.id}@${r.wikis[0].ref}`]}
                      noteCount={
                        personal.notes.filter((n) => n.repo === r.id).length
                      }
                      onOpen={() => openRepo(r)}
                      onBookmark={() => toggleBookmark(r.id)}
                    />
                  ))}
                </div>
                {!visible.length && (
                  <Empty
                    icon={page === "bookmarks" ? Bookmark : Search}
                    title={
                      page === "bookmarks" && !search
                        ? "收藏你的第一个好项目"
                        : "没有找到匹配的仓库"
                    }
                    description={
                      page === "bookmarks" && !search
                        ? "点击仓库卡片右上角的书签，把想研究的项目留在这里。"
                        : "试试其他关键词，或放宽分类和语言筛选。"
                    }
                  />
                )}
                <div className="collection-end">
                  <span />
                  <span>
                    <CheckCircle2 size={14} />{" "}
                    {visible.length
                      ? "好代码值得慢慢读，知识地图持续生长中"
                      : "保持好奇，发现更多可能"}
                  </span>
                  <span />
                </div>
              </>
            ) : page === "trending" ? (
              <>
                <div className="page-heading-row">
                  <PageHeading
                    kicker="THE OPEN SOURCE PULSE"
                    title={
                      <>
                        此刻，社区在<span>关注什么。</span>
                      </>
                    }
                    description="来自 GitHub Trending 的真实榜单快照。发现新项目，再选择值得深入研究的方向。"
                  />
                  <a
                    className="secondary-button"
                    href={`https://github.com/trending?since=${period}`}
                    {...externalProps}
                  >
                    GitHub Trending <ExternalLink size={14} />
                  </a>
                </div>
                <div className="trending-banner">
                  <span className="trending-orbit">
                    <Flame size={32} />
                  </span>
                  <div>
                    <span className="eyebrow">
                      A LITTLE CURIOSITY, EVERY DAY
                    </span>
                    <h2>下一次灵感，可能就在这里。</h2>
                    <p>热度帮你发现，源码让你理解。</p>
                  </div>
                  <Sparkles
                    className="trending-sparkle"
                    size={64}
                    strokeWidth={0.8}
                  />
                </div>
                <div className="trending-toolbar">
                  <div className="pill-tabs">
                    {[
                      ["daily", "今日"],
                      ["weekly", "本周"],
                      ["monthly", "本月"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        className={period === id ? "active" : ""}
                        onClick={() => setPeriod(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <span className="muted">
                    榜单采集于{" "}
                    {catalog.trending[period]?.fetchedAt
                      ? fullDate(catalog.trending[period].fetchedAt!)
                      : "尚未获取"}
                  </span>
                </div>
                {catalog.trending[period]?.error && (
                  <div className="notice">
                    本次更新未成功，正在展示上次成功采集的快照。
                  </div>
                )}
                <div className="trending-list">
                  {(catalog.trending[period]?.items ?? []).map((t, i) => {
                    const collected = repos.find(
                      (r) => r.id === t.repo.toLowerCase(),
                    );
                    return (
                      <article key={t.repo} className="trend-row">
                        <span className={`trend-rank ${i < 3 ? "top" : ""}`}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="trend-body">
                          <div className="trend-name">
                            <a href={t.url} {...externalProps}>
                              {t.repo.split("/")[0]}{" "}
                              <span>/ {t.repo.split("/")[1]}</span>
                              <ArrowUpRight size={14} />
                            </a>
                            {collected && (
                              <span className="small-badge">已收录</span>
                            )}
                          </div>
                          <p>{t.description || "在 GitHub 上探索这个项目。"}</p>
                          <div className="trend-meta">
                            {t.language && (
                              <span>
                                <i
                                  className={`language-dot ${t.language.toLowerCase()}`}
                                />
                                {t.language}
                              </span>
                            )}
                            <span>
                              <Star size={13} />
                              {formatNumber(t.stars)}
                            </span>
                          </div>
                        </div>
                        <div className="trend-growth">
                          <span>
                            <Flame size={14} />+{formatNumber(t.periodStars)}
                          </span>
                          <small>
                            {period === "daily"
                              ? "stars today"
                              : period === "weekly"
                                ? "stars this week"
                                : "stars this month"}
                          </small>
                        </div>
                        {collected ? (
                          <button
                            className="secondary-button"
                            onClick={() => openRepo(collected)}
                          >
                            阅读分析 <ArrowRight size={14} />
                          </button>
                        ) : (
                          <a
                            className="icon-button"
                            href={t.url}
                            {...externalProps}
                            aria-label={`查看 ${t.repo}`}
                          >
                            <ArrowUpRight size={19} />
                          </a>
                        )}
                      </article>
                    );
                  })}
                </div>
                {!catalog.trending[period]?.items.length && (
                  <Empty
                    icon={Flame}
                    title="这份榜单还在路上"
                    description="采集暂不可用，可以打开 GitHub Trending 查看原始榜单。"
                  />
                )}
              </>
            ) : (
              <>
                <div className="page-heading-row">
                  <PageHeading
                    kicker="MAKE IT YOUR OWN"
                    title={
                      <>
                        读过的代码，<span>留下的思考。</span>
                      </>
                    }
                    description="每一条发现，都是知识地图上的一个新连接。笔记按仓库和版本独立保存。"
                  />
                  <div className="button-row">
                    <button
                      className="secondary-button"
                      onClick={() => importRef.current?.click()}
                    >
                      <Upload size={15} />
                      导入
                    </button>
                    <button className="primary-button" onClick={exportNotes}>
                      <ArrowDownToLine size={15} />
                      导出笔记
                    </button>
                  </div>
                </div>
                <div className="notes-info">
                  <NotebookPen size={19} />
                  <span>
                    <strong>{personal.notes.length}</strong> 篇学习笔记{" "}
                    <span>· 保存在此浏览器，建议定期导出备份</span>
                  </span>
                </div>
                <label className="search-box notes-search">
                  <Search size={17} />
                  <input
                    ref={searchRef}
                    placeholder="搜索笔记标题、内容或仓库…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <div className="notes-grid">
                  {notes.map((note) => {
                    const r = repos.find((r) => r.id === note.repo);
                    return (
                      <article className="note-card" key={note.id}>
                        <div className="note-card-meta">
                          <span>
                            <FolderGit2 size={14} />
                            {note.repo}
                          </span>
                          <span>{dateText(note.updatedAt)}</span>
                        </div>
                        <h3>{note.title || "未命名笔记"}</h3>
                        <p>
                          {note.body.replace(/[#*`>\[\]]/g, "").slice(0, 180) ||
                            "这篇笔记还没有正文，继续记录你的发现。"}
                        </p>
                        <div className="note-card-bottom">
                          <span>
                            <GitBranch size={13} />
                            {note.ref}
                          </span>
                          {r ? (
                            <button
                              className="text-button"
                              onClick={() => {
                                setNoteOpen(true);
                                openRepo(r, note.ref);
                              }}
                            >
                              继续记录 <ArrowRight size={14} />
                            </button>
                          ) : (
                            <button
                              className="text-button"
                              onClick={() =>
                                download(
                                  `${note.title || "note"}.md`,
                                  note.body,
                                )
                              }
                            >
                              下载笔记 <ArrowDownToLine size={14} />
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
                {!notes.length && (
                  <Empty
                    icon={NotebookPen}
                    title={
                      search
                        ? "没有找到匹配的笔记"
                        : "让第一个发现，成为第一篇笔记"
                    }
                    description={
                      search
                        ? "试试其他关键词。"
                        : "打开任意仓库的源码分析，边读边记。你的思考会在这里慢慢积累。"
                    }
                    action={
                      !search ? (
                        <button
                          className="primary-button"
                          onClick={() => navigate("explore")}
                        >
                          开始探索 <ArrowRight size={15} />
                        </button>
                      ) : undefined
                    }
                  />
                )}
              </>
            )}
            <footer className="content-footer">
              <span>
                <Box size={14} /> Repo Atlas <i>·</i> 连接开源与自己的知识
              </span>
              <button onClick={() => navigate("pipeline")}>
                <GitBranch size={12} /> Powered by GitHub Actions{" "}
                <ArrowUpRight size={12} />
              </button>
            </footer>
          </main>
        )}
      </div>
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => importNotes(e.target.files?.[0])}
      />
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="关闭提示"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {addOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddOpen(false);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-title"
          >
            <button
              className="modal-close icon-button"
              aria-label="关闭收录窗口"
              onClick={() => setAddOpen(false)}
            >
              <X size={20} />
            </button>
            <span className="modal-icon">
              <FolderGit2 size={26} />
            </span>
            <h2 id="add-title">收录一个值得研究的仓库</h2>
            <p>
              将仓库添加到配置后，GitHub Actions
              会采集数据、生成分析并更新站点。
            </p>
            <label className="field-label">
              GitHub 仓库地址
              <input
                autoFocus
                placeholder="https://github.com/owner/repo"
                value={addRepo}
                onChange={(e) => setAddRepo(e.target.value)}
              />
            </label>
            <label className="field-label">
              研究方向
              <select
                value={addCategory}
                onChange={(e) => setAddCategory(e.target.value)}
              >
                {catalog?.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              项目选题
              <select
                value={addCollection}
                onChange={(e) => setAddCollection(e.target.value)}
              >
                <option value="emerging">新锐项目</option>
                <option value="classic">经典项目</option>
              </select>
            </label>
            <button
              className="primary-button modal-submit"
              onClick={() => {
                const name = addRepo
                  .trim()
                  .replace(/^https:\/\/github\.com\//i, "")
                  .replace(/\.git$/, "")
                  .replace(/\/$/, "");
                if (!/^[\w.-]+\/[\w.-]+$/.test(name)) {
                  setToast("请输入 owner/repo 或有效的 GitHub 仓库地址");
                  return;
                }
                download(
                  `${name.replace("/", "--")}.json`,
                  JSON.stringify(
                    {
                      repo: name,
                      category: addCategory,
                      collection: addCollection,
                      refs: ["default"],
                      tags: [],
                      summary: "请填写项目中文简介",
                      reason: "请填写收录理由",
                    },
                    null,
                    2,
                  ),
                  "application/json",
                );
                setToast(
                  "配置片段已下载，请加入 config/repos.json 的 repos 数组并提交",
                );
              }}
            >
              <ArrowDownToLine size={16} />
              下载仓库配置
            </button>
            <div className="modal-hint">
              <Terminal size={15} />
              <span>
                加入 <code>config/repos.json</code> 后提交到
                main，流水线自动更新。
              </span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function PageHeading({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: React.ReactNode;
  description: string;
}) {
  return (
    <div className="page-heading">
      <div className="eyebrow">
        <span />
        {kicker}
      </div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
function Stat({
  icon: Icon,
  value,
  label,
  detail,
}: {
  icon: ElementType;
  value: string;
  label: string;
  detail: string;
}) {
  return (
    <div className="stat">
      <div className="stat-icon">
        <Icon size={19} strokeWidth={1.6} />
      </div>
      <div>
        <div className="stat-number">
          {value}
          <span>{label}</span>
        </div>
        <p>{detail}</p>
      </div>
    </div>
  );
}
function Empty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={28} strokeWidth={1.5} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
function RepoCard({
  repo: r,
  saved,
  progress,
  noteCount,
  onOpen,
  onBookmark,
}: {
  repo: Repo;
  saved: boolean;
  progress?: string;
  noteCount: number;
  onOpen: () => void;
  onBookmark: () => void;
}) {
  const Icon = icons[r.category];
  return (
    <article className="repo-card">
      <div className="repo-card-top">
        <span className={`repo-avatar ${r.category}`}>
          {r.name === "deepagents" ? (
            <Network size={23} />
          ) : r.name === "mem0" ? (
            <span className="mem0-logo">m₀</span>
          ) : r.name === "ag-ui" ? (
            <span className="agui-logo">
              ag<span>ui</span>
            </span>
          ) : (
            <Icon size={22} />
          )}
        </span>
        <div className="repo-title">
          <span>{r.owner}</span>
          <button onClick={onOpen}>
            {r.name}
            <ArrowUpRight size={13} />
          </button>
        </div>
        <button
          className={`bookmark-button ${saved ? "saved" : ""}`}
          aria-label={`${saved ? "取消收藏" : "收藏"} ${r.name}`}
          onClick={onBookmark}
        >
          <Bookmark
            size={17}
            strokeWidth={1.6}
            fill={saved ? "currentColor" : "none"}
          />
        </button>
      </div>
      <div className="repo-card-content">
        <p className="repo-description">{r.summary}</p>
        <div className="repo-tags">
          {r.collection && (
            <span className={`collection-badge ${r.collection}`}>
              {collectionNames[r.collection]}
            </span>
          )}
          {r.tags.slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <div className="repo-metadata">
          <span>
            <Star size={13} />
            {formatNumber(r.stars)}
          </span>
          <span>
            <i className={`language-dot ${r.language.toLowerCase()}`} />
            {r.language}
          </span>
          <span>
            <GitBranch size={12} />
            {r.wikis.length} {r.wikis.length > 1 ? "个版本" : "个分支"}
          </span>
          {r.archived && <span>已归档</span>}
        </div>
      </div>
      <div className="repo-card-footer">
        <span className={`wiki-status ${progress === "done" ? "done" : ""}`}>
          {progress === "done" ? (
            <BookCheck size={13} />
          ) : (
            <span className="tiny-square">
              <FileText size={10} />
            </span>
          )}
          {progress === "done"
            ? "已完成阅读"
            : progress === "reading"
              ? "正在阅读"
              : "学习文档已就绪"}
          {noteCount > 0 && (
            <span className="note-count">· {noteCount} 笔记</span>
          )}
        </span>
        <button onClick={onOpen}>
          阅读分析 <ArrowRight size={13} />
        </button>
      </div>
    </article>
  );
}
