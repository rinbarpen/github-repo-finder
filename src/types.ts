export type Category = {
  id: string;
  name: string;
  label: string;
  description: string;
  color: string;
  questions: string[];
};
export type Source = { path: string; url: string; characters: number };
export type Wiki = {
  ref: string;
  sha: string;
  treeSha: string;
  generatedAt: string;
  mode: "evidence" | "ai";
  markdown: string;
  path: string;
  sources: Source[];
  truncated: boolean;
};
export type Repo = {
  id: string;
  name: string;
  owner: string;
  url: string;
  description: string;
  summary: string;
  category: string;
  tags: string[];
  stars: number;
  forks: number;
  language: string;
  license: string;
  defaultBranch: string;
  updatedAt: string;
  collectedAt: string;
  archived: boolean;
  wikis: Wiki[];
  featured?: boolean;
  reason: string;
};
export type Trend = {
  repo: string;
  description: string;
  language: string;
  stars: number;
  periodStars: number;
  url: string;
};
export type TrendPeriod = {
  fetchedAt: string | null;
  source: string;
  items: Trend[];
  error?: string;
};
export type Catalog = {
  schemaVersion: number;
  generatedAt: string;
  categories: Category[];
  repos: Repo[];
  trending: Record<string, TrendPeriod>;
  errors: string[];
};
export type Note = {
  id: string;
  repo: string;
  ref: string;
  title: string;
  body: string;
  updatedAt: string;
};
export type Personal = {
  schemaVersion: 1;
  notes: Note[];
  bookmarks: string[];
  progress: Record<string, "reading" | "done">;
};
