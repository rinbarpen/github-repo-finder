# mem0 源码学习指南

> 基于选定源码的结构化索引 · ts-v3.3.1 · 94c3fe9f238f
> 生成于 2026-10-29T02:55:26.686Z。这是 Repo Atlas 生成的证据索引，非 DeepWiki 官方内容；未执行或验证目标项目。架构与行为需沿来源继续核实。


> AI 辅助分析，请对照来源验证。

# mem0 源码学习指南

> 基于选定源码的结构化索引 · ts-v3.3.1 · 94c3fe9f238f
> 生成于 2026-10-29T02:55:26.686Z。这是 Repo Atlas 生成的证据索引，非 DeepWiki 官方内容；未执行或验证目标项目。架构与行为需沿来源继续核实。

> **本文档的性质**：源码阅读笔记，不是运行报告。所有架构判断都只依据下列 5 个文件片段，且都附固定提交链接。文中明确标注「已读」「推断」「未覆盖」。我没有运行目标项目，也不声称其行为与我描述一致；片段截断处的方法体属于未验证区域。

---

## 1. 覆盖范围（先看这里）

| 文件 | 读取情况 | 可用于判断什么 |
| --- | --- | --- |
| [`README.md`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/README.md) | 10,000 字符，**已截断** | 项目定位、新算法宣传、安装与最小示例 |
| [`pyproject.toml`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/pyproject.toml) | 3,394 字符，**完整** | 包名/版本、依赖分层、构建约定 |
| [`mem0/client/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/client/main.py) | 10,000 字符，**已截断** | 托管客户端初始化、请求头、身份校验辅助函数 |
| [`mem0/memory/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/memory/main.py) | 10,000 字符，**已截断** | 开源 Memory 的导入拼图、校验/清洗辅助函数 |
| [`mem0/proxy/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/proxy/main.py) | 7,055 字符，**完整** | LLM 代理的端到端编排 |

**明确未覆盖**：`mem0/memory/main.py` 中 `add()`/`search()` 的方法体（片段停在 `_safe_deepcopy_config`）、`mem0/client/main.py` 中 `add()/search()/delete()` 的方法体（片段停在 `_validate_api_key` 开头）、`server/`、`cli/`、`mem0-ts/`、`integrations/`、`tests/`、`docs/`、各 `vector_stores/*`、`utils/factory.py`、`configs/*` 的实体内容。凡是涉及这些位置的描述，本文一律标记为「推断」。

**版本注意**：索引标题标注分支/标签为 `ts-v3.3.1`，但固定提交中的 [`pyproject.toml`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/pyproject.toml) 声明包名 `mem0ai`、版本 `2.2.1`。二者关系未在已读片段中说明；本文不假设它们是同一版本标识。

---

## 2. 项目定位

据 [`README.md`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/README.md)：

- 定位是「The Memory Layer for AI Agents」——为 AI Agent/应用提供持久化记忆、检索与个性化上下文的**基础设施**，强调 drop-in 与 production。
- 声称支持 **Multi-Level Memory**：User、Session、Agent 三类状态。[README](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/README.md)
- README 同时给出三种交付形态：库（`pip install mem0ai` / `npm install mem0ai`）、自托管 Server（`docker compose up`）、云平台（`app.mem0.ai`）。[README](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/README.md)
- README 宣称 2026 年 4 月的新记忆算法要点：**Single-pass ADD-only extraction**（一次 LLM 调用、无 UPDATE/DELETE，记忆只累积）、**Agent-generated facts are first-class**、**Entity linking**、**Multi-signal retrieval**（semantic + BM25 + entity 并行打分融合）、**Temporal Reasoning**。[README](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/README.md)

⚠️ 上述 benchmark 数字与「managed platform 含开源 SDK 不具备的优化」是 README 的**自述**，本文不背书；且 README 片段已截断，最小示例的后半段（`assistant_resp` 之后）未读到。

---

## 3. 基于已读代码的架构

### 3.1 三个运行时入口，一个代理层

已读代码显示存在**两类后端** + **一个统一门面**：

1. **开源 `Memory`**：`mem0/memory/main.py`，本地/自托管实现，依赖可插拔的 embedder、LLM、reranker、vector store。[`memory/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/memory/main.py)
2. **托管 `MemoryClient`**：`mem0/client/main.py`，通过 HTTPS 访问 `https://api.mem0.ai`，用 API Key 鉴权。[`client/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/client/main.py)
3. **统一代理 `Mem0`**：`mem0/proxy/main.py`，构造时二选一：有 `api_key` 走 `MemoryClient`，否则 `Memory.from_config(config)` 或 `Memory()`。这是已读代码里能直接确认的分叉逻辑。[`proxy/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/proxy/main.py)

```python
# proxy/main.py（已读）
if api_key:
    self.mem0_client = MemoryClient(api_key, host)
else:
    self.mem0_client = Memory.from_config(config) if config else Memory()
```

> 来源：[proxy/main.py](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/proxy/main.py)

**推断**：这一层把「本地开源」与「托管 API」抽象成同一套 `add/search` 语义，代价是两种后端返回结构不同（`_format_query_with_memories` 里用 `isinstance` 分别处理 `relevant_memories["results"]` 和直接迭代 `relevant_memories`），说明统一是**薄抽象**而非强契约。[`proxy/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/proxy/main.py)

### 3.2 开源 Memory 侧的依赖拼图（来自 import 列表）

`memory/main.py` 的 import 块本身就是一张架构图（这是**已读**的直接证据，不是推测）：

| import 组 | 暗示的职责 |
| --- | --- |
| `MemoryConfig`, `MemoryItem`, `MemoryType` | 配置与记忆项模型 |
| `ADDITIVE_EXTRACTION_PROMPT`, `generate_additive_extraction_prompt`, `PROCEDURAL_MEMORY_SYSTEM_PROMPT`, `AGENT_CONTEXT_SUFFIX` | 记忆抽取提示词（与 README 的 ADD-only 呼应） |
| `EmbedderFactory`, `LlmFactory`, `RerankerFactory`, `VectorStoreFactory` | 四类可插拔组件 |
| `extract_entities`, `extract_entities_batch` | 实体抽取（与 README 的 entity linking 呼应） |
| `get_bm25_params`, `normalize_bm25`, `lemmatize_for_bm25`, `score_and_rank`, `ENTITY_BOOST_WEIGHT` | 多信号检索打分（与 README 的 semantic/BM25/entity 融合呼应） |
| `SQLiteManager` | 本地元数据/历史存储 |
| `extract_json`, `parse_messages`, `parse_vision_messages`, `remove_code_blocks` | 消息解析与 LLM 输出解析 |
| `VectorStoreBase` | 向量存储基类 |

> 来源：[memory/main.py](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/memory/main.py)

由此可确认：开源侧**不是单一向量库**，而是「embedder + LLM + reranker + vector store + SQLite」的组合，且检索包含 BM25 与实体加成两条非纯向量信号。[`memory/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/memory/main.py)

### 3.3 托管 MemoryClient 侧的已读细节

`MemoryClient.__init__` 已读部分：

- `api_key` 来源：参数或 `MEM0_API_KEY` 环境变量；缺失直接 `ValueError`。
- `host` 默认 `https://api.mem0.ai`。
- 调用 `setup_config()`（模块级）与 `get_user_id()`。
- **用 API Key 的 MD5 覆盖 `self.user_id`**，并作为请求头 `Mem0-User-ID` 的值。
- 自定义 `httpx.Client` 时，用 `_apply_client_headers` 合并头，而不是整体覆盖。
- 初始化后通过 `GET /v1/ping/` 校验 Key（`_validate_api_key`），并从响应读取 `org_id`/`project_id`。
- 构造 `Project` 子客户端，并尝试把匿名遥测 ID alias 到邮箱。

> 来源：[client/main.py](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/client/main.py)

请求头设计（已读代码 + 代码内注释）：

- `Authorization: Token {api_key}`、`Mem0-User-ID`、`X-Mem0-Client`。
- `X-Mem0-Source` 与 `X-Application` 是 **SET-ONCE**：外层已设置则 SDK 不覆盖。
- `X-Mem0-Client` 是 **APPEND-ONLY**：每层追加自己，形成栈。
- `_bounded_stack` 限制为最多 **4 条 / 200 字符**，并且**整条丢弃**而非截断字符；保留位留给本 SDK 自己。

> 来源：[client/main.py](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/client/main.py)

这组规则有明确的设计意图（已在代码注释中说明）：防止插件/封装层覆盖外层身份，也防止 SDK 在自身调用链中「消失」。

### 3.4 边界与安全：已读的关键辅助函数

`memory/main.py` 已读的 `_strip_identity_keys`、`_reject_top_level_entity_params` 直接说明：**身份/租户边界不通过 metadata，也不通过顶层实参**，只能通过 `filters`：

- `ENTITY_PARAMS = {"user_id", "agent_id", "run_id"}`，`_IDENTITY_KEYS = ENTITY_PARAMS | {"actor_id"}`。
- metadata 中出现身份键会被剥离；update 路径上「值相同」静默接受，「值改变」仅告警；creation 路径一律丢弃并告警。
- 顶层 `user_id/agent_id/run_id` 会被 `_reject_top_level_entity_params` 直接 `ValueError`。
- 代码注释点名 issues `#4490`、`#6277`、`#6655`。

> 来源：[memory/main.py](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/memory/main.py)

⚠️ **已读代码中有一处需核实的不一致**：`memory/main.py` 的 `ENTITY_PARAMS` 是 `{"user_id", "agent_id", "run_id"}`，而 `client/main.py` 的是 `{"user_id", "agent_id", "app_id", "run_id"}`（多 `app_id`）。同时，`proxy/main.py` 的 `_fetch_relevant_memories` 把 `user_id/agent_id/run_id` 作为**顶层实参**传给 `self.mem0_client.search(...)`，但 `memory/main.py` 的 `_reject_top_level_entity_params` 明确拒绝顶层实体参数。二者是否兼容**取决于未读到的 `search()` 方法体**，本文不断言这是 bug，只标记为必须用源码核实的分叉点。

另一个已读的安全设计：`_is_sensitive_field` 采用三层判定（runtime 字段白名单 → 精确敏感名 → 后缀匹配），配合 `_safe_deepcopy_config` 在 `deepcopy` 失败时回退到 dict 克隆，并在回退中保留 runtime 对象、对敏感字段置 `None`。用途是配置进入遥测前脱敏。

> 来源：[memory/main.py](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/memory/main.py)

---

## 4. 关键调用链

### 4.1 Proxy 端到端（`Completions.create`，完整可读）

```
调用方
  └─ Mem0().chat.completions.create(model, messages, user_id/agent_id/run_id, ...)
       ├─ 校验：至少一个 user_id/agent_id/run_id      → 否则 ValueError
       ├─ litellm.supports_function_calling(model)    → 否则 ValueError
       ├─ _prepare_messages(messages)
       │    └─ 无 system 消息 → 头部插入 MEMORY_ANSWER_PROMPT
       ├─ 若最后一条是 user：
       │    ├─ _async_add_to_memory(...)              → 新 daemon 线程 → mem0_client.add(...)
       │    └─ _fetch_relevant_memories(...)          → mem0_client.search(query=最后6条拼接, top_k=10)
       │         └─ _format_query_with_memories(...)  → 把记忆拼进最后一条 user 消息
       ├─ litellm.completion(...)                     → 透传大量 OpenAI 兼容参数
       └─ capture_event / capture_client_event
```

> 来源：[proxy/main.py](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/proxy/main.py)

**已读确认的行为细节**：
- 写入是**异步线程**、检索是**同步等待**，二者并发；不保证 add 完成于本次 search 之前。
- 检索 query 只取最后 **6 条**消息，代码里留了 `TODO: Make it better by summarizing the past conversation`。
- `memories_text` 对 `Memory` 与 `MemoryClient` 分别取值；`Memory` 分支还会读 `relations` 作为 `entities`。
- `_format_query_with_memories` 返回的模板是 `- Relevant Memories/Facts: ...\n\n- Entities: ...\n\n- User Question: ...`。

> 来源：[proxy/main.py](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/proxy/main.py)

### 4.2 开源 Memory 写入（**推断，方法体未读**）

根据 import 拼图与 README 自述，可**推断**入口是 `Memory.add(messages, filters/user_id/...)`，内部大致为：

```
add(messages)
  ├─ 参数校验（_validate_and_trim_entity_id 等）
  ├─ parse_messages / parse_vision_messages / remove_code_blocks
  ├─ LLM 抽取：ADDITIVE_EXTRACTION_PROMPT + generate_additive_extraction_prompt（ADD-only）
  ├─ extract_entities / extract_entities_batch（实体链接）
  ├─ EmbedderFactory 产出向量
  ├─ VectorStoreFactory 实例 .insert(...)
  └─ SQLiteManager 记录本地状态
```

⚠️ 方法名与顺序是**推断**：片段未出现 `def add`，也未出现 `.insert(...)` 调用。可确证的是上述模块被 import。[`memory/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/memory/main.py)

### 4.3 开源 Memory 检索（**推断，方法体未读**）

推断路径：`search(query, filters, top_k)` → `_validate_and_trim_search_query` + `_validate_search_params` → embed → 向量检索 + BM25 + 实体匹配 → `score_and_rank` / `normalize_bm25` / `ENTITY_BOOST_WEIGHT` 融合 → 返回 `{"results": [...]}`（README 示例读的是 `relevant_memories["results"]`）。[`memory/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/memory/main.py)、[`README.md`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/README.md)

已读的校验规则可确证：`threshold` 必须 0–1（含端点）、`top_k` 必须非负整数且不能是 `bool`、query 必须非空字符串且会 `strip()`。[`memory/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/memory/main.py)

### 4.4 MemoryClient 初始化链（完整可读段）

```
MemoryClient(api_key=?, host=?, client=?)
  ├─ api_key = arg or env MEM0_API_KEY        → 缺失则 ValueError
  ├─ user_id = MD5(api_key)
  ├─ client 已给 → 覆盖 base_url + _apply_client_headers（合并而非覆盖）
  │  否则      → httpx.Client(..., timeout=300, headers=_client_headers)
  ├─ _validate_api_key() → GET /v1/ping/ → 读 org_id/project_id
  ├─ Project(client, org_id, project_id, user_email)
  ├─ _maybe_alias_anon_to_email(user_email)   → 仅当 PostHog 启用
  └─ capture_client_event("client.init", ...)
```

> 来源：[client/main.py](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/client/main.py)

---

## 5. 设计取舍（每条附证据）

| 取舍 | 已读证据 | 代价 / 风险 |
| --- | --- | --- |
| **记忆只增不改**（ADD-only） | README 自述「one LLM call, no UPDATE/DELETE」；`memory/main.py` 导入 `ADDITIVE_EXTRACTION_PROMPT` | 冲突消解与过期处理被推后；README 提到 migration guide，说明行为有破坏性变更 |
| **身份只能走 filters** | `_reject_top_level_entity_params`、`_strip_identity_keys` | API 更严格（顶层传 user_id 直接报错）；但降低了 metadata 越权风险 |
| **请求头 SET-ONCE / APPEND-ONLY** | `_client_headers` 注释 + `_bounded_stack` | 栈最多 4 层，超过即丢早期层身份；换来插件可组合性 |
| **多信号检索** | `get_bm25_params`/`normalize_bm25`/`score_and_rank`/`ENTITY_BOOST_WEIGHT`；README 描述 | 引入 `spacy`/分词等额外依赖（`pyproject` 的 `nlp` extra），部署更重 |
| **配置深拷贝失败即降级** | `_safe_deepcopy_config` | 降级克隆可能丢字段（敏感字段置 `None`、失败再退回空类） |
| **托管/开源双实现 + 薄代理** | `proxy/main.py` 的 `isinstance` 分支 | 返回结构不统一，调用方需按后端分支处理 |
| **遥测默认存在** | `posthog` 为必装依赖；`_maybe_alias_anon_to_email`、`capture_client_event` | 隐私敏感场景需显式关闭；代码中 `MEM0_TELEMETRY` 开关存在 |

> 来源：[`README.md`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/README.md)、[`pyproject.toml`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/pyproject.toml)、[`memory/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/memory/main.py)、[`client/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/client/main.py)、[`proxy/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/proxy/main.py)

**依赖层面可确证**：核心依赖只有 8 个（qdrant-client、pydantic、openai、httpx、posthog、pytz、sqlalchemy、protobuf），而 vector store、LLM、embeddings 全部在 `optional-dependencies` 中按需安装——这是「轻核心 + 重插件」的明确取舍。[`pyproject.toml`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/pyproject.toml)

---

## 6. 分步学习路径

**Step 0 — 建立边界（30 分钟）**
读 [`README.md`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/README.md) 的定位/算法段 + [`pyproject.toml`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/pyproject.toml) 的依赖分层。产出：一张「核心依赖 vs 可选依赖」表，理解为什么 vector store 不装也能 import。

**Step 1 — 读「代理」，不读「实现」**
先读 [`proxy/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/proxy/main.py)（完整、短、链路闭合），画出 4.1 的时序。这是全仓最容易建立全局感的地方。

**Step 2 — 读「客户端」，理解托管面**
读 [`client/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/client/main.py) 的 `_client_headers`、`_bounded_stack`、`_apply_client_headers`、`__init__`。关注点不是 HTTP 方法，而是**身份头如何不被覆盖**。

**Step 3 — 读「开源核心」的 import 与校验函数**
读 [`memory/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/memory/main.py) 的 import 块 + `_strip_identity_keys` / `_reject_top_level_entity_params` / `_validate_*` / `_is_sensitive_field` / `_safe_deepcopy_config`。这一步回答「边界如何被强制」。

**Step 4 — 补齐未覆盖区（需自行打开源码）**
按优先级：`Memory.add/search` 方法体 → `utils/factory.py` 的四个 Factory → `utils/scoring.py` 的 `score_and_rank` → `memory/storage.py` 的 `SQLiteManager` → `configs/base.py` 的 `MemoryConfig`。这四块是本文所有「推断」的验证点。

**Step 5 — 对照实验**
做第 7 节的实验，把「推断」变成「已核实」或「已证伪」。

---

## 7. 动手实验（设计，非执行结果）

> 以下为**实验设计**。我没有运行它们；请自行在固定提交 `94c3fe9f238f` 的代码上执行并记录结果。

**实验 A — 顶层实体参数是否被拒**
对 `Memory.add(...)` / `Memory.search(...)` 传顶层 `user_id=`，观察是否触发 `_reject_top_level_entity_params` 的 `ValueError`。若未触发，说明 `add/search` 内部另有处理，本文 3.4 的「不一致」需要修正。依据：[`memory/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/memory/main.py)

**实验 B — metadata 身份键剥离**
在 `add(metadata={"user_id": "attacker"})` 与 `add(metadata={"user_id": "<与 filters 相同>"})` 两种输入下，观察是否分别出现警告。依据：`_strip_identity_keys` 的 creation 路径「一律丢弃并告警」，update 路径「相同值静默」。[`memory/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/memory/main.py)

**实验 C — Proxy 的写读时序**
在 `Completions.create` 前后打时间戳，验证 `_async_add_to_memory` 的 daemon 线程是否在本轮 `search` 之前完成。预期：**不保证**，因为二者无 join。依据：[`proxy/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/proxy/main.py)

**实验 D — 边界输入**
对 `search` 传 `query="   "`、`threshold=1.5`、`top_k=-1`、`top_k=True`，分别记录错误消息。这四条在已读代码中有明确分支。依据：[`memory/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/memory/main.py)

**实验 E — 请求头栈**
预设 `MEM0_CLIENT_STACK` 为 4 条，再构造 `MemoryClient`，检查最终 `X-Mem0-Client` 是否仍包含 `mem0-python/<version>`，以及是否正好丢弃最早条目。依据：[`client/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/client/main.py) 的 `_bounded_stack`

**实验 F — 敏感字段脱敏**
构造一个含 `api_key`、`db_password`、`http_auth` 的配置，强制 `deepcopy` 失败，观察回退克隆中三者的取值。依据：`_is_sensitive_field` 三层判定 + `_safe_deepcopy_config`。[`memory/main.py`](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/memory/main.py)

---

## 8. 未覆盖区域与待核实假设（汇总）

**未覆盖（无任何已读证据）**：
- `Memory.add()` / `Memory.search()` / `Memory.update()` / `Memory.delete()` 的方法体与真实时序。
- `MemoryClient` 的 `add/search/get_all/delete` 等 HTTP 方法体（片段只到 `_validate_api_key` 开头）。
- `utils/factory.py` 中四个 Factory 的注册机制。
- `memory/storage.py` 的 `SQLiteManager` 表结构。
- `configs/base.py` 的 `MemoryConfig` 字段与默认值。
- `server/`（自托管）、`cli/`、`mem0-ts/`、`integrations/`、`tests/`。
- README 中被截断的最小示例后半段。

**待核实假设（本文标注为「推断」）**：
1. `add` 内部依次做抽取→实体→嵌入→写向量库→写 SQLite 的顺序。依据仅为 import 拼图。
2. `search` 内部是「向量 + BM25 + 实体」三路融合。依据仅为 `score_and_rank`/`normalize_bm25`/`ENTITY_BOOST_WEIGHT` 的导入名与 README 自述。
3. `Memory.search` 接受顶层 `user_id`（与 `proxy/main.py` 的调用形态一致）。与 `_reject_top_level_entity_params` 存在表面冲突，需读方法体裁决。
4. `memory/main.py` 的 `ENTITY_PARAMS` 缺 `app_id` 是有意还是遗漏，未读代码无法判断。

---

## 9. 来源清单（固定提交 `94c3fe9f238f`）

- [README.md](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/README.md)
- [pyproject.toml](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/pyproject.toml)
- [mem0/client/main.py](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/client/main.py)
- [mem0/memory/main.py](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/memory/main.py)
- [mem0/proxy/main.py](https://github.com/mem0ai/mem0/blob/94c3fe9f238f3dbf29c9ce98643bd71eb13077cd/mem0/proxy/main.py)

**再次声明**：本文只基于上述 5 个片段。目录地图（`.agents/`、`server/`、`cli/`、`mem0-ts/` 等）来自证据索引的目录记录，不代表已分析。所有「行为」描述请沿对应源码链接继续核实；本文未执行、未验证目标项目。