import type { Note, Personal } from "./types";

const KEY = "repo-atlas:personal:v1";
export const emptyPersonal = (): Personal => ({
  schemaVersion: 1,
  notes: [],
  bookmarks: [],
  progress: {},
});
export function parsePersonal(value: unknown): Personal {
  if (!value || typeof value !== "object") throw new Error("无法识别笔记文件");
  const data = value as Partial<Personal>;
  if (
    data.schemaVersion !== 1 ||
    !Array.isArray(data.notes) ||
    !Array.isArray(data.bookmarks) ||
    !data.progress ||
    typeof data.progress !== "object"
  )
    throw new Error("笔记文件格式或版本不正确");
  if (data.notes.length > 10000) throw new Error("笔记数量超出限制");
  for (const n of data.notes) {
    if (
      !n ||
      ["id", "repo", "ref", "title", "body", "updatedAt"].some(
        (k) => typeof n[k as keyof Note] !== "string",
      ) ||
      n.body.length > 200000 ||
      !Number.isFinite(Date.parse(n.updatedAt))
    )
      throw new Error("笔记数据不完整或过长");
  }
  if (
    data.bookmarks.some((b) => typeof b !== "string") ||
    Object.values(data.progress).some((s) => !["reading", "done"].includes(s))
  )
    throw new Error("收藏或阅读状态格式不正确");
  return {
    schemaVersion: 1,
    notes: data.notes,
    bookmarks: data.bookmarks,
    progress: data.progress,
  };
}
export function readPersonal(): { data: Personal; error?: string } {
  try {
    const raw = localStorage.getItem(KEY);
    return { data: raw ? parsePersonal(JSON.parse(raw)) : emptyPersonal() };
  } catch {
    return {
      data: emptyPersonal(),
      error: "无法读取本地笔记。请检查浏览器存储权限，并保留原有数据。",
    };
  }
}
export function savePersonal(data: Personal) {
  localStorage.setItem(KEY, JSON.stringify(data));
}
export function mergePersonal(current: Personal, incoming: Personal): Personal {
  const notes = new Map(current.notes.map((n) => [n.id, n]));
  for (const note of incoming.notes) {
    const old = notes.get(note.id);
    if (!old || Date.parse(note.updatedAt) > Date.parse(old.updatedAt))
      notes.set(note.id, note);
  }
  return {
    schemaVersion: 1,
    notes: [...notes.values()],
    bookmarks: [...new Set([...current.bookmarks, ...incoming.bookmarks])],
    progress: { ...current.progress, ...incoming.progress },
  };
}
export function download(
  name: string,
  content: string,
  type = "text/markdown;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
