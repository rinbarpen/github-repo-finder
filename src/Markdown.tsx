import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Expand, LoaderCircle, Minimize2 } from "lucide-react";

let diagramTools:
  | Promise<{
      mermaid: typeof import("mermaid").default;
      purifier: typeof import("dompurify").default;
    }>
  | undefined;
function loadDiagramTools() {
  return (diagramTools ??= Promise.all([
    import("mermaid"),
    import("dompurify"),
  ]).then(([engine, purifier]) => {
    engine.default.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      fontFamily: "DM Sans, Noto Sans SC, sans-serif",
      flowchart: { htmlLabels: false, useMaxWidth: true, curve: "basis" },
      themeVariables: {
        primaryColor: "#edf7f2",
        primaryTextColor: "#33534a",
        primaryBorderColor: "#8ab9a4",
        lineColor: "#8ba799",
        secondaryColor: "#f3f1f8",
        tertiaryColor: "#f8fafb",
        fontSize: "14px",
      },
    });
    return { mermaid: engine.default, purifier: purifier.default };
  }));
}

function Diagram({ definition }: { definition: string }) {
  const id = `diagram-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [svg, setSvg] = useState("");
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let active = true;
    setSvg("");
    setError(false);
    const render = async () => {
      try {
        if (
          definition.length > 20000 ||
          /%%\s*\{|^\s*---\s*$|\bclick\b|<\/?(?:script|iframe|foreignObject)\b/i.test(
            definition,
          )
        )
          throw new Error("Unsupported diagram directives");
        const { mermaid, purifier } = await loadDiagramTools();
        const result = await mermaid.render(id, definition);
        const safe = purifier.sanitize(result.svg, {
          USE_PROFILES: { svg: true, svgFilters: true },
          FORBID_TAGS: ["foreignObject", "script", "iframe"],
        });
        if (active) setSvg(safe);
      } catch {
        if (active) setError(true);
      }
    };
    void render();
    return () => {
      active = false;
    };
  }, [definition, id]);
  useEffect(() => {
    if (!expanded) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [expanded]);
  if (error)
    return (
      <div className="diagram-fallback">
        <span>图表暂时无法绘制，以下是结构定义。</span>
        <pre>
          <code>{definition}</code>
        </pre>
      </div>
    );
  return (
    <div
      className={`architecture-diagram ${expanded ? "expanded" : ""}`}
      role={expanded ? "dialog" : "figure"}
      aria-modal={expanded || undefined}
      aria-label="架构或运行流程图"
    >
      <div className="diagram-toolbar">
        <span>{svg ? "架构 / 运行流程" : "正在绘制图表…"}</span>
        <button
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "收起图表" : "展开图表"}
        >
          {expanded ? <Minimize2 size={14} /> : <Expand size={14} />}{" "}
          {expanded ? "收起" : "展开"}
        </button>
      </div>
      <div className="diagram-scroll">
        {svg ? (
          <div
            className="diagram-svg"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <LoaderCircle size={22} className="spin" />
        )}
      </div>
    </div>
  );
}

const textContent = (node: ReactNode): string =>
  Children.toArray(node)
    .map((child) =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : isValidElement<{ children?: ReactNode }>(child)
          ? textContent(child.props.children)
          : "",
    )
    .join("");
export const guideSections = [
  ["2", "整体架构"],
  ["3", "一次运行"],
  ["4", "核心技术"],
  ["5", "设计取舍"],
  ["6", "代码精读"],
  ["7", "验证实验"],
];

export function Markdown({
  children,
  anchorPrefix,
}: {
  children: string;
  anchorPrefix?: string;
}) {
  const instance = useId().replace(/[^a-zA-Z0-9]/g, "");
  const prefix = anchorPrefix ?? `markdown-${instance}`;
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href, title }) => (
            <a
              href={href}
              title={title ?? undefined}
              className={
                title?.match(/:\d+-\d+$/) ? "source-reference" : undefined
              }
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          ),
          h2: ({ children }) => {
            const label = textContent(children);
            const number = label.match(/^(\d+)\./)?.[1];
            return (
              <h2 id={number ? `${prefix}-${number}` : undefined}>
                {children}
              </h2>
            );
          },
          pre: ({ children }) => {
            const code = Children.toArray(children).find((child) =>
              isValidElement(child),
            );
            if (
              isValidElement<{ className?: string; children?: ReactNode }>(
                code,
              ) &&
              code.props.className === "language-mermaid"
            )
              return (
                <Diagram definition={textContent(code.props.children).trim()} />
              );
            return <pre>{children}</pre>;
          },
          img: () => null,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
