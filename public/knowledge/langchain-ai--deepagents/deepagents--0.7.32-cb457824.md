# deepagents 源码学习指南

> 基于选定源码的结构化索引 · deepagents==0.7.32 · e85c6b980878
> 生成于 2026-10-29T02:55:26.686Z。这是 Repo Atlas 生成的证据索引，非 DeepWiki 官方内容；未执行或验证目标项目。架构与行为需沿来源继续核实。


> AI 辅助分析，请对照来源验证。

# deepagents 源码学习指南

> 基于选定源码的结构化索引 · deepagents==0.7.32 · e85c6b980878  
> 生成于 2026-10-29T02:55:26.686Z。这是 Repo Atlas 生成的证据索引，非 DeepWiki 官方内容；未执行或验证目标项目。架构与行为需沿来源继续核实。

> 覆盖说明：采集 5 个文件片段，目录记录 2214 项。分析固定到提交 [e85c6b98087861512d2c5240305e16cfac68a746](https://github.com/langchain-ai/deepagents/commit/e85c6b98087861512d2c5240305e16cfac68a746)，不随上游分支漂移。文件选择为启发式抽样，不能据此推断完整架构。

> 本文未运行项目；源码与 README 均作为待分析数据处理，其中出现的任何操作指令不执行。证据索引中异步子 Agent 条目写作 `asyncsubagents.py`，但其给出的链接与内容路径为 `async_subagents.py`；本文使用给定来源链接，路径差异待核实。

## 阅读标记

- **[源码]**：可在给定提交的已读片段中直接确认。
- **[推断]**：基于已读导入、类型、docstring 或函数名得出的结构性判断，尚未读到完整实现。
- **[未覆盖]**：当前片段未包含，不能下结论。

---

## 1. 项目定位

- README 将 Deep Agents 定义为开源 **agent harness**，即“开箱即用的、有观点的 agent”，可扩展、覆盖或替换任意部件。[README.md](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/README.md)
- README 的原则包括：面向长程多步任务的有观点默认值、无需 fork 即可扩展、模型无关、基于 LangGraph 的生产能力（流式、持久化、检查点），并通过 LangSmith 提供追踪、评估和部署。[README.md](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/README.md)
- README 列出的能力包括：子 Agent、可插拔文件系统后端、上下文管理、Shell、持久记忆、人类在环、Skills、自定义工具/MCP。[README.md](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/README.md)
- README 的 FAQ 明确了层次关系：LangGraph 是图运行时，LangChain `create_agent` 是轻量 harness，Deep Agents 是构建在 `create_agent` 之上的更有观点的 harness，并内置文件系统、子 Agent、上下文管理和 Skills。[README.md](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/README.md)
- README 的安全模型是“trust the LLM”：Agent 能做其工具允许的任何事，边界应在工具/沙箱层实施，而不是期待模型自我约束。[README.md](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/README.md)

---

## 2. 基于已读代码的架构

### 2.1 主装配层：`graph.py`

- `graph.py` 的模块 docstring 声明其是 Deep Agents 的主图装配模块，提供 `create_deep_agent`，用于构造带有 planning、filesystem、subagent、summarization middleware 的完整 deep agent。[graph.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/graph.py)
- 该文件从 `langchain.agents` 导入 `AgentState` 与 `create_agent`，说明 Deep Agents 的装配建立在 LangChain agent harness 之上。[graph.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/graph.py)
- 该文件导入多种中间件：`HumanInTheLoopMiddleware`、`FilesystemMiddleware`、`MemoryMiddleware`、`SkillsMiddleware`、`SubAgentMiddleware`、`AsyncSubAgentMiddleware`、`create_summarization_middleware`、`PatchToolCallsMiddleware`、`UnsupportedContentMiddleware`，以及文件和提示缓存相关辅助模块。[graph.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/graph.py)
- `DeepAgentState` 继承 `AgentState`，并将 `messages` 定义为带 `DeltaChannel(_messages_delta_reducer, snapshot_frequency=50)` 的必填字段；docstring 声称这可将检查点增长从 O(N²) 降到 O(N)。这是源码中的设计声明，片段未包含基准测试。[graph.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/graph.py)
- 片段中可见的辅助函数包括：`__getattr__`、`_build_default_model`、`get_default_model`、`_merge_fs_interrupt_on`、`_passed_skills_sources`、`_apply_custom_middleware`。[graph.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/graph.py)
- `_merge_fs_interrupt_on` 将文件系统权限生成的 interrupt 配置与用户 `interrupt_on` 合并；同名工具时用户配置优先；二者都为空时返回 `None`，以便省略 `HumanInTheLoopMiddleware`。[graph.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/graph.py)
- `_apply_custom_middleware` 按 `.name` 将自定义中间件合并进基础栈：同名则原位替换并保持顺序；新名字则插入到最后一个 `core_names` 成员之后，或在未设置 `core_names` 时追加到末尾。[graph.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/graph.py)
- `get_default_model` 自 `0.5.3` 起废弃，计划在 `1.0.0` 移除；`BASE_AGENT_PROMPT` 自 `0.7.0` 起废弃，计划在 `0.9.0` 移除。片段显示默认模型为 `ChatAnthropic(model_name="claude-sonnet-4-6")`。[graph.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/graph.py)
- **[推断]** `create_deep_agent` 很可能负责按某种顺序实例化并组合上述中间件；但当前片段在 `_apply_custom_middleware` 中途截断，未读到 `create_deep_agent` 的完整函数体、参数处理和真实中间件顺序。[graph.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/graph.py)

### 2.2 后端协议：`backends/protocol.py`

- 模块 docstring 声明其定义 `BackendProtocol`，所有后端实现必须遵循；后端可将文件存于 state、文件系统、数据库等不同位置，并提供统一的文件操作接口。[protocol.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/backends/protocol.py)
- `FileDownloadResponse` 与 `FileUploadResponse` 是为批量操作中的部分成功设计的；错误可使用标准化的 `FileOperationError` 字面量，也可使用后端特定错误字符串。[protocol.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/backends/protocol.py)
- 标准错误码包括 `file_not_found`、`permission_denied`、`is_directory`、`invalid_path`，并提供了对应常量。[protocol.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/backends/protocol.py)
- `FileInfo` 只要求 `path`，`is_dir`、`size`、`modified_at` 为 best-effort；`GrepMatch` 支持可选的上下文行；`FileData` 区分 `utf-8` 文本与 `base64` 二进制。[protocol.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/backends/protocol.py)
- `ReadResult.__post_init__` 对分页字段做严格校验：`start_line`/`end_line` 必须成对出现；`no_lines_requested` 不能与错误或分页字段混用；`next_offset` 和 `total_lines` 需要窗口字段；窗口必须满足 `1 <= start_line <= end_line`，`total_lines >= end_line`，`next_offset == end_line`。[protocol.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/backends/protocol.py)
- 常量显示同步 grep 默认超时 15 秒，异步 grep 包装超时 35 秒，沙箱 glob 往返超时 30 秒。[protocol.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/backends/protocol.py)
- **[未覆盖]** 当前片段未包含 `BackendProtocol` 类主体、各后端实现、文件读写/搜索方法签名及异常到错误码的具体映射。

### 2.3 异步子 Agent：`middleware/async_subagents.py`

- 模块 docstring 说明异步子 Agent 通过 LangGraph SDK 在远程 Agent Protocol 服务器上启动后台 run；与同步子 Agent 不同，它立即返回 task ID，主 Agent 可监控进度并发送更新；兼容 LangGraph Platform 与自托管服务器。[async_subagents.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/async_subagents.py)
- `AsyncSubAgent` 规格包含 `name`、`description`、`graph_id`、可选 `url`、`headers`、`webhook`、`update_strategy`、`notify_parent`、`mode`。[async_subagents.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/async_subagents.py)
- `update_strategy` 支持 `interrupt`（停止当前 run 并启动后续）与 `enqueue`（排队到当前 run 之后），默认 `interrupt`。[async_subagents.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/async_subagents.py)
- `notify_parent` 控制子 Agent 完成时是否唤醒空闲父 Agent，默认 `True`；`mode` 支持 `isolated`（默认，只发送委派描述）与 `fork`（实验性，发送父对话快照加任务描述）。[async_subagents.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/async_subagents.py)
- `AsyncTask` 持久化在 Agent state 中，记录 `task_id`、`agent_name`、`thread_id`、`run_id`、`status`、时间戳，并可选记录 `superseded_run_ids`。[async_subagents.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/async_subagents.py)
- `_tasks_reducer` 将更新字典合并进已有任务字典；`AsyncSubAgentState` 通过 `Annotated[NotRequired[dict[str, AsyncTask]], _tasks_reducer]` 暴露 `async_tasks`。[async_subagents.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/async_subagents.py)
- 代码中定义了 `_TERMINAL_STATUSES = {"cancelled", "success", "error", "timeout", "interrupted"}`，注释说明终态任务可跳过实时状态获取；`waiting` 表示子 Agent 暂停等待用户输入。[async_subagents.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/async_subagents.py)
- `StartAsyncTaskSchema` 是 `start_async_task` 工具的输入 schema，但当前片段只读到其开头。[async_subagents.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/async_subagents.py)
- **[推断]** 实际链路可能是：主 Agent 调用启动工具 → 通过 LangGraph SDK 在远程线程/run 上启动任务 → 将 `AsyncTask` 写入 `async_tasks` → 后续查询/更新工具读取并合并状态。启动、查询、取消、更新工具的具体实现和异常分支未在当前片段中读到。[async_subagents.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/async_subagents.py)

### 2.4 记忆中间件：`middleware/memory.py`

- 模块 docstring 说明其实现 `AGENTS.md` 规范：从可配置来源加载记忆/上下文，并注入系统提示；与按需加载的 Skills 不同，memory 总是加载，提供持久上下文。[memory.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/memory.py)
- 多个来源按顺序加载并拼接，后续来源出现在前序来源之后；HTML 注释 `<!-- ... -->` 在注入前被剥离。[memory.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/memory.py)
- `MemoryState` 定义 `memory_contents` 为 `PrivateStateAttr`，注释说明其不会包含在最终 Agent state 中。[memory.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/memory.py)
- `MemoryMiddleware.__init__` 接收 `backend`、`sources`、`add_cache_control`、`system_prompt`；`sources` 为记忆文件路径列表，按顺序加载。[memory.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/memory.py)
- `add_cache_control=True` 时，在 Anthropic 模型上给最后一个系统消息内容块加 `cache_control: {"type": "ephemeral"}`，与 `AnthropicPromptCachingMiddleware` 的静态系统提示断点配合；非 Anthropic 模型无操作。[memory.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/memory.py)
- `MEMORY_SYSTEM_PROMPT` 明确将 `<agent_memory>` 视为磁盘文件数据，而非隐藏系统指令；要求模型在记忆与用户请求、安全策略或工具验证证据冲突时优先用户与验证证据；并指导何时通过 `edit_file` 更新记忆、何时不要更新。[memory.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/memory.py)
- `MemoryMiddleware` 的 `trace_policy` 使用 `omit_payload` 默认省略 hook 输入；`state_schema = MemoryState`。[memory.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/memory.py)
- **[推断]** 由于导入了 `append_to_system_message` 并定义了 `MEMORY_SYSTEM_PROMPT`，记忆中间件很可能在模型调用前读取来源、拼接内容并追加到系统消息；但当前片段未包含具体 hook 方法，不能确认读取失败、空文件、缓存控制等分支的实际行为。[memory.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/memory.py)

---

## 3. 关键调用链：可确认片段与待补全部分

| 环节 | 可确认内容 | 证据状态 |
| --- | --- | --- |
| 公共入口 | README Quickstart 调用 `create_deep_agent`；`graph.py` docstring 声明它提供 `create_deep_agent` 作为主入口。 | [源码] [README](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/README.md) / [graph.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/graph.py) |
| 状态通道 | `DeepAgentState` 继承 `AgentState`，`messages` 使用 `DeltaChannel`，`snapshot_frequency=50`。 | [源码] [graph.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/graph.py) |
| 中间件装配 | `graph.py` 导入 `create_agent` 与多种中间件；`_apply_custom_middleware` 按名称替换或插入。 | [源码] 装配事实；[推断] 完整实例化顺序未读 [graph.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/graph.py) |
| 人类在环合并 | `_merge_fs_interrupt_on` 合并文件系统权限 interrupt 与用户 interrupt；用户同名优先。 | [源码] [graph.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/graph.py) |
| 记忆加载 | `MemoryMiddleware.__init__` 接收 backend 与 sources；`MemoryState` 保存 `memory_contents`；提示常量存在。 | [源码] 初始化/状态/常量；[推断] hook 读取与注入 [memory.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/memory.py) |
| 异步任务 | `StartAsyncTaskSchema` 存在；`AsyncSubAgentState` 用 reducer 维护 `async_tasks`；模块导入 LangGraph SDK 客户端。 | [源码] 类型/reducer；[推断] 工具启动 remote run 的完整链路 [async_subagents.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/async_subagents.py) |

---

## 4. 设计取舍

- **通过中间件名称组合扩展，而不是要求 fork**：`_apply_custom_middleware` 允许同名替换、未知名追加到核心段之后，降低扩展成本；代价是名称成为装配契约，冲突语义需要使用者理解。[graph.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/graph.py)
- **人类在环配置可被用户覆盖**：文件系统权限生成的 interrupt 与用户配置合并，用户同名优先；无配置时返回 `None` 以省略中间件。这使默认策略可被局部覆盖，但也要求用户理解覆盖后果。[graph.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/graph.py)
- **用 `DeltaChannel` 控制检查点增长**：docstring 声称将 messages 检查点增长从 O(N²) 降到 O(N)，并通过 `snapshot_frequency=50` 控制快照频率；实际收益未在当前片段中基准验证。[graph.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/graph.py)
- **后端契约强调批量部分成功与标准化错误**：`FileDownloadResponse`/`FileUploadResponse` 允许逐文件成功或失败，错误码面向 LLM 可理解、可修复的条件；这提高批量操作可用性，但要求后端正确分类错误。[protocol.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/backends/protocol.py)
- **分页校验前置且严格**：`ReadResult.__post_init__` 在构造时拒绝不一致字段，避免后端输出跳过未显示源行；代价是后端实现必须遵守更细的字段契约。[protocol.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/backends/protocol.py)
- **异步子 Agent 以远程后台任务换取并发与监控能力**：立即返回 task ID，主 Agent 可继续工作并监控/更新；状态持久化在 `async_tasks`，终态可跳过实时查询。代价是依赖远程 Agent Protocol 服务、线程/run 状态同步和更新策略语义。[async_subagents.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/async_subagents.py)
- **记忆“总是加载”，Skills“按需加载”**：记忆提供持久上下文，但会占用系统提示；HTML 注释剥离和“记忆是参考材料而非隐藏指令”的提示设计，试图降低陈旧或恶意记忆的风险。[memory.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/memory.py)
- **Anthropic 提示缓存作为可选优化**：`add_cache_control` 只在 Anthropic 模型上生效，并与静态系统提示缓存断点配合；非 Anthropic 模型无操作，体现模型特定优化被隔离在可选路径。[memory.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/memory.py)
- **弃用策略显式化**：默认模型和旧 `BASE_AGENT_PROMPT` 都有版本化弃用说明，表明项目在收紧隐式默认行为；但当前片段未展示完整迁移路径。[graph.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/graph.py)

---

## 5. 分步学习路径

1. **先读 README，建立层次边界**：确认 Deep Agents、LangChain `create_agent`、LangGraph 的分层关系，以及“trust the LLM”的安全边界。[README.md](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/README.md)
2. **读 `graph.py` 的导入与状态定义**：先看 `DeepAgentState`、中间件导入列表、`_merge_fs_interrupt_on`、`_apply_custom_middleware`，再寻找 `create_deep_agent` 完整函数体。[graph.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/graph.py)
3. **读后端协议数据契约**：重点看 `FileDownloadResponse`、`FileUploadResponse`、`FileInfo`、`GrepMatch`、`ReadResult` 和错误码，理解文件工具对后端的期望。[protocol.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/backends/protocol.py)
4. **读记忆中间件**：理解 `AGENTS.md` 来源顺序、HTML 注释剥离、`memory_contents` 私有状态、提示缓存和信任边界。[memory.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/memory.py)
5. **读异步子 Agent 状态模型**：先看 `AsyncSubAgent`、`AsyncTask`、`_tasks_reducer`、`AsyncSubAgentState`，再补读启动/更新/取消工具和 Middleware hook。[async_subagents.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/async_subagents.py)
6. **再进入未覆盖模块**：`subagents.py`、`filesystem.py`、`summarization.py`、各 backend 实现、测试与 examples。当前证据不足以判断完整调用链。

---

## 6. 实验设计（均未执行）

> 以下为基于已读源码的学习实验设计，不代表已运行或已验证。

1. **静态装配实验**：完整阅读 `create_deep_agent` 函数体，列出中间件实际顺序；再与 `_apply_custom_middleware` 的“同名替换、新名插入到核心段之后”规则对照。[graph.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/graph.py)
2. **`ReadResult` 契约实验**：构造非法字段组合，预期触发 `ValueError`，例如只设置 `start_line`、`no_lines_requested` 与分页字段混用、`next_offset != end_line`。该预期直接来自 `__post_init__` 校验代码，但未运行。[protocol.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/backends/protocol.py)
3. **记忆加载实验**：用一个实现后端协议的对象提供含 HTML 注释的 `AGENTS.md`，观察 `memory_contents` 是否按来源顺序保存、注释是否被剥离、最终系统提示是否包含 `<agent_memory>`；需要补读 `MemoryMiddleware` 的实际 hook。[memory.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/memory.py)
4. **异步本地传输实验**：源码注释说明省略 `url` 时使用进程内 ASGI 传输，且只适用于异步父 Agent 入口（如 `ainvoke`）；同步 `invoke` 需要可达的 Agent Protocol URL。可据此设计启动、查询、更新、取消的观察实验，但需先读未覆盖的工具实现。[async_subagents.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/async_subagents.py)
5. **重复调用与终态实验**：围绕 `_TERMINAL_STATUSES`、`update_strategy="interrupt"/"enqueue"`、`superseded_run_ids` 设计重复更新和取消场景，验证任务状态如何合并；当前仅有类型与注释，缺少工具实现，不能给出预期结果。[async_subagents.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/async_subagents.py)

---

## 7. 未覆盖区域与待核实问题

- **[未覆盖]** `create_deep_agent` 完整函数体、参数解析、中间件实例化顺序、默认工具注册、planning 中间件的具体实现。
- **[未覆盖]** `MemoryMiddleware` 的 hook 方法、读取失败处理、空来源处理、缓存控制实际注入位置。
- **[未覆盖]** `AsyncSubAgentMiddleware` 的启动/查询/更新/取消工具实现，远程 run 失败、超时、重试、重复启动的处理。
- **[未覆盖]** `SubAgentMiddleware`、`FilesystemMiddleware`、`SkillsMiddleware`、`SummarizationMiddleware`、`PatchToolCallsMiddleware`、`UnsupportedContentMiddleware` 的行为。
- **[未覆盖]** 各 backend 实现（state/filesystem/sandbox/remote）与 `BackendProtocol` 类主体。
- **[未覆盖]** 测试、examples、openwiki、打包与发布配置；目录存在不等于已分析。
- **待核实问题**：一次任务在模型、工具与执行器之间如何流转？失败重试、权限与执行隔离如何实现？长任务状态如何保留和恢复？异步子 Agent 的终态与父 Agent 唤醒如何协调？这些都需要沿固定提交继续读源码。

---

## 8. 来源

- [README.md](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/README.md)
- [libs/deepagents/deepagents/graph.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/graph.py)
- [libs/deepagents/deepagents/backends/protocol.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/backends/protocol.py)
- [libs/deepagents/deepagents/middleware/async_subagents.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/async_subagents.py)
- [libs/deepagents/deepagents/middleware/memory.py](https://github.com/langchain-ai/deepagents/blob/e85c6b98087861512d2c5240305e16cfac68a746/libs/deepagents/deepagents/middleware/memory.py)

固定提交：[e85c6b98087861512d2c5240305e16cfac68a746](https://github.com/langchain-ai/deepagents/commit/e85c6b98087861512d2c5240305e16cfac68a746)。