# letta 源码学习指南

> 基于选定源码的结构化索引 · archive · 56ba9c255526
> 生成于 2026-10-29T02:55:26.686Z。这是 Repo Atlas 生成的证据索引，非 DeepWiki 官方内容；未执行或验证目标项目。架构与行为需沿来源继续核实。


> AI 辅助分析，请对照来源验证。

# letta 源码学习指南

> 基于选定源码的结构化索引 · archive · 56ba9c255526  
> 生成于 2026-10-29T02:55:26.686Z。这是 Repo Atlas 生成的证据索引，非 DeepWiki 官方内容；未执行或验证目标项目。架构与行为需沿来源继续核实。  
> 本文仅依据所提供的 5 个文件片段进行分析，所有具体架构判断均附固定提交链接；未覆盖区域已显式标记。不声称已运行项目。

## 1. 项目定位

从 README 可知，该仓库是 **legacy Letta server**（原 MemGPT），即 Letta V1 API 和 SDK 背后的 API 服务端；活跃开发已迁移至 `letta-ai/letta-code`，自托管 API 服务端现在推荐使用 App Server。项目目标是构建具有高级记忆、可随时间学习和自我改进的 AI Agent。  
来源：[README.md](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/README.md)

从 `pyproject.toml` 可知，包名为 `letta`，版本 `0.16.8`，描述为“Create LLM agents with long-term memory and custom tools”，要求 Python `>=3.11,<3.14`，命令行入口为 `letta = letta.main:app`。依赖中包含 FastAPI、SQLAlchemy、Pydantic、多个 LLM 提供商 SDK、数据库可选依赖（Postgres、SQLite、Pinecone、Redis）以及 OpenTelemetry 等，说明这是一个功能较完整的服务端项目。  
来源：[pyproject.toml](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/pyproject.toml)

因此，本仓库适合用于学习 **历史服务端的 Agent 执行循环、状态管理与记忆边界**，而非当前主线的 Letta Code 实现。索引中的目录地图（`alembic/`、`letta/`、`tests/` 等）仅用于定位入口，本文未分析这些目录的完整内容。

## 2. 基于已读代码的架构

### 2.1 抽象接口层

代码中存在两个抽象基类，代表不同代际的 Agent 契约：

- `BaseAgent`：仅定义一个抽象方法 `step(input_messages: List[MessageCreate]) -> LettaUsageStatistics`，注释说明“Only one interface is required: step”。  
  来源：[letta/agent.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agent.py)

- `BaseAgentV2`：定义更丰富的抽象方法 `build_request`、`step`、`stream`，并提供 `agent_id` 属性（返回 `agent_state.id`）。其中：
  - `build_request` 用于 dry-run，返回发给 LLM provider 的请求载荷；
  - `step` 为阻塞模式，返回 `LettaResponse`；
  - `stream` 为流式模式，返回异步生成器，可逐 token 或逐 step 产出消息。
  三个方法都接受客户端工具/技能、`override_system`、`billing_context` 等参数。  
  来源：[letta/agents/base_agent_v2.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agents/base_agent_v2.py)

**推断**：`BaseAgent` 对应旧版单步接口，`BaseAgentV2` 对应新版可支持流式、dry-run、客户端工具暂停的执行循环。两者并存说明仓库处于迁移/兼容阶段。

### 2.2 执行循环选择：AgentLoop 工厂

`AgentLoop` 是一个工厂类，静态方法 `load(agent_state, actor)` 根据 `agent_state.agent_type` 和 `agent_state.enable_sleeptime` 返回不同的执行循环实现：

- 当 `agent_type` 为 `letta_v1_agent` 或 `sleeptime_agent`：
  - 若 `enable_sleeptime` 为真：
    - 若 `multi_agent_group is None`，记录 warning 并回退到 `LettaAgentV3`；
    - 否则返回 `SleeptimeMultiAgentV4`；
  - 若未启用 sleeptime，返回 `LettaAgentV3`。
- 当 `enable_sleeptime` 为真且 `agent_type != voice_convo_agent`：
  - 若 `multi_agent_group is None`，记录 warning 并回退到 `LettaAgentV2`；
  - 否则返回 `SleeptimeMultiAgentV3`。
- 其他情况返回 `LettaAgentV2`。

来源：[letta/agents/agent_loop.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agents/agent_loop.py)

**观察**：工厂集中了版本选择和回退逻辑，调用方无需硬编码具体 Agent 类；`SleeptimeMultiAgentV3/V4` 与 `LettaAgentV2/V3` 均需继承 `BaseAgentV2`（从 `AgentLoop.load` 返回类型标注和导入关系可推断）。但 `LettaAgentV2`、`LettaAgentV3`、`SleeptimeMultiAgentV3`、`SleeptimeMultiAgentV4` 的具体实现未在本次片段中提供，属于未覆盖区域。

### 2.3 旧版 `Agent` 实现片段

`Agent` 继承 `BaseAgent`，构造函数接受 `interface`、`agent_state`、`user`、`mcp_clients`、`save_last_response` 等参数。片段中可见的初始化与行为包括：

- 断言 `agent_state.memory` 为 `Memory` 类型；
- 初始化 `ToolRulesSolver`，并根据模型是否支持结构化输出给出警告；
- 初始化多个管理器：`BlockManager`、`MessageManager`、`PassageManager`、`ProviderManager`、`AgentManager`、`JobManager`、`StepManager`、`TelemetryManager`（或 `NoopTelemetryManager`）；
- 通过 `load_last_function_response()` 从 in-context 消息历史中加载最后一个工具响应；
- `ensure_read_only_block_not_modified(new_memory)`：若只读 block 的值被修改，抛出 `ValueError(READ_ONLY_BLOCK_EDIT_ERROR)`；
- `update_memory_if_changed(new_memory)`：比较新 Memory 编译结果与系统消息内容，若不同则更新内部记忆与系统提示（片段在更新系统消息处截断，后续未覆盖）。

来源：[letta/agent.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agent.py)

**推断**：`Agent` 负责一次 Agent 执行循环中的状态管理、记忆一致性检查和工具响应恢复，但 `step` 方法的具体实现未包含在片段中，因此无法详细描述其调用 LLM、执行工具、持久化消息的完整流程。

### 2.4 推断的分层结构

从 `letta/agent.py` 的 import 和构造函数可推断项目大致分为：

- **接口/Agent 层**：`BaseAgent`、`Agent`、`BaseAgentV2`、`AgentLoop`；
- **服务层**：`AgentManager`、`BlockManager`、`MessageManager`、`PassageManager`、`ProviderManager`、`JobManager`、`StepManager`、`TelemetryManager`；
- **Schema 层**：`AgentState`、`Memory`、`BlockUpdate`、`Message`、`MessageCreate`、`Tool`、`ToolExecutionResult`、`LettaUsageStatistics` 等；
- **ORM 层**：`letta.orm.User`；
- **LLM API 层**：`letta.llm_api.llm_api_tools.create`、`LLMClient`；
- **工具执行层**：`ToolExecutionSandbox`、`ToolManager`、`ToolRulesSolver`；
- **MCP 客户端**：`AsyncBaseMCPClient`；
- **提示词与系统消息**：`PromptGenerator`、`letta.system` 中的打包函数；
- **遥测/追踪**：`letta.otel.tracing`、`TelemetryManager`。

以上均为基于 import 和构造函数的推断，未读取对应文件内容。链接：[letta/agent.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agent.py)

**未覆盖区域**：`services/`、`schemas/`、`orm/`、`llm_api/`、`functions/`、`prompts/` 的具体实现；API 路由；数据库迁移；测试；MCP 实际连接逻辑；`LettaAgentV2/V3` 与 `SleeptimeMultiAgentV3/V4` 的 step/stream 实现。

## 3. 关键调用链（基于片段）

1. 调用方（推测为 API 路由或服务层）通过 `AgentLoop.load(agent_state, actor)` 获取执行循环实例。  
   来源：[letta/agents/agent_loop.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agents/agent_loop.py)

2. `AgentLoop.load` 根据 `agent_type` 和 `enable_sleeptime` 选择 `LettaAgentV3`、`LettaAgentV2`、`SleeptimeMultiAgentV4` 或 `SleeptimeMultiAgentV3`，并在 `multi_agent_group` 缺失时回退并记录 warning。  
   同上。

3. 这些实现预期继承 `BaseAgentV2`，因此需实现 `build_request`、`step`、`stream` 三个抽象方法。  
   来源：[letta/agents/base_agent_v2.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agents/base_agent_v2.py)

4. 旧版 `Agent` 的构造过程会初始化多个管理器，调用 `load_last_function_response()` 从历史消息恢复最后一个工具响应；记忆更新路径通过 `update_memory_if_changed` 和 `ensure_read_only_block_not_modified` 控制。  
   来源：[letta/agent.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agent.py)

5. **推断**：在 `step`/`stream` 内部，执行循环会调用 `letta.llm_api.llm_api_tools.create` 请求 LLM、解析工具调用、通过 `ToolExecutionSandbox` 执行工具、更新消息与记忆，并持久化到各 Manager。该推断基于 `agent.py` 的 import 和属性初始化，但具体控制流未在片段中展开，需阅读 `LettaAgentV2/V3` 实现核实。

## 4. 设计取舍

- **多代抽象接口并存**：`BaseAgent` 仅要求 `step`，`BaseAgentV2` 提供 `build_request`/`step`/`stream` 三种模式，并接受客户端工具、客户端技能、`billing_context` 等参数。这体现了从简单阻塞接口向 dry-run、流式和客户端工具暂停能力的演进，同时保留旧接口兼容性。  
  来源：[letta/agent.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agent.py)、[letta/agents/base_agent_v2.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agents/base_agent_v2.py)

- **工厂集中版本选择与回退**：`AgentLoop` 将 agent 类型、sleeptime、多 agent group 的组合逻辑集中在一个静态方法中，并在配置不完整时回退到标准实现并记录 warning，避免调用方分散处理版本差异。  
  来源：[letta/agents/agent_loop.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agents/agent_loop.py)

- **记忆一致性优先**：`update_memory_if_changed` 通过比较编译后的 Memory 与系统消息文本决定是否更新，`ensure_read_only_block_not_modified` 对只读块修改直接抛错。这说明设计上把系统提示与记忆块视为需要显式同步和保护的持久状态。  
  来源：[letta/agent.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agent.py)

- **可扩展但依赖复杂**：`pyproject.toml` 通过可选依赖支持多种数据库（Postgres、SQLite、Pinecone、Redis）、LLM 提供商（Bedrock、Anthropic、OpenAI 等）和沙箱/工具环境（E2B、Modal、Docker）。这提供了部署灵活性，但也增加了依赖面和环境配置复杂度。  
  来源：[pyproject.toml](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/pyproject.toml)

- **注意**：以上取舍仅基于片段观察，完整设计意图需结合未覆盖的服务层、路由和测试代码核实。

## 5. 分步学习路径

1. **确认项目边界**：阅读 README，理解本仓库是 legacy server，当前主线在 `letta-code`。  
   来源：[README.md](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/README.md)

2. **核对入口与依赖**：阅读 `pyproject.toml`，记录命令行入口 `letta = letta.main:app`、Python 版本范围、可选数据库/LLM 依赖。  
   来源：[pyproject.toml](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/pyproject.toml)

3. **理解执行循环选择**：阅读 `letta/agents/agent_loop.py`，画出 `agent_type` × `enable_sleeptime` × `multi_agent_group` 的选择矩阵及回退条件。  
   来源：[letta/agents/agent_loop.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agents/agent_loop.py)

4. **掌握抽象契约**：阅读 `letta/agents/base_agent_v2.py`，对比 `step` 与 `stream` 参数差异，注意 `include_compaction_messages` 注释“Not used in V2, but accepted for API compatibility”。  
   来源：[letta/agents/base_agent_v2.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agents/base_agent_v2.py)

5. **分析旧版 Agent 片段**：阅读 `letta/agent.py`，重点关注构造函数的各 Manager 初始化、`load_last_function_response`、`ensure_read_only_block_not_modified`、`update_memory_if_changed`；注意 `step` 方法片段被截断，需自行查看完整文件。  
   来源：[letta/agent.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agent.py)

6. **进入未覆盖的服务层**：从 `AgentManager`、`BlockManager`、`MessageManager`、`PassageManager` 开始阅读 `letta/services/`（本次未提供）。建议先看这些 Manager 的接口和 ORM 映射，再回到 Agent 循环。

7. **理解数据模型**：阅读 `letta/schemas/agent.py` 中的 `AgentState`、`letta/schemas/memory.py` 中的 `Memory`、`letta/schemas/message.py` 中的 `MessageCreate`（本次未提供），对照 `AgentLoop` 的条件字段。

8. **追踪一次请求**：在 API 路由层找到调用 `AgentLoop.load` 的位置，记录从 HTTP 请求到 `step`/`stream` 的完整链路（本次未提供路由代码，需自行定位）。

## 6. 实验建议（均未执行）

以下实验用于验证基于片段的推断，需在完整源码和环境中进行，本文未运行：

- **实验 1：记忆更新触发条件**  
  在 `Agent.update_memory_if_changed` 处加日志，构造新旧 `Memory` 对象，观察 `new_memory.compile()` 与系统消息内容的比较结果，确认何时触发系统消息更新。需先阅读完整方法以确定 `compile()` 的输出格式。

- **实验 2：只读块保护**  
  构造一个只读 block 被修改的 `Memory`，调用 `ensure_read_only_block_not_modified`，验证抛出 `ValueError(READ_ONLY_BLOCK_EDIT_ERROR)`。需从常量文件确认错误消息内容。

- **实验 3：sleeptime 回退**  
  构造 `agent_state.enable_sleeptime=True` 且 `multi_agent_group=None` 的 `AgentState`，调用 `AgentLoop.load`，观察是否记录 warning 并返回 `LettaAgentV3`（当 `agent_type` 为 `letta_v1_agent`/`sleeptime_agent`）或 `LettaAgentV2`（其他类型）。

- **实验 4：V2 与 V3 的 step/stream 差异**  
  阅读 `LettaAgentV2` 与 `LettaAgentV3` 的 `step`/`stream` 实现（本次未提供），对比消息管理、工具执行、上下文压缩和流式输出策略的差异。

- **实验 5：数据库后端切换**  
  利用 `pyproject.toml` 中的可选依赖，分别以 SQLite 和 Postgres 启动服务，观察 `AgentState` 持久化行为差异。需准备完整数据库迁移和 API 密钥，未验证。

## 7. 来源与覆盖范围

- **固定提交**：[56ba9c255526](https://github.com/letta-ai/letta/commit/56ba9c25552605eec89de8ed3dc6394b625c1993)
- **已读文件片段**（5 个）：
  - [README.md](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/README.md)
  - [pyproject.toml](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/pyproject.toml)
  - [letta/agent.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agent.py)（截断至 10,000 字符）
  - [letta/agents/agent_loop.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agents/agent_loop.py)（索引中路径记为 `agentloop.py`）
  - [letta/agents/base_agent_v2.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agents/base_agent_v2.py)（索引中路径记为 `baseagentv2.py`）

- **覆盖声明**：采集了 5 个文件片段，目录记录 1282 项；文件选择为启发式抽样，不能据此推断完整架构。本文未分析 `services/`、`schemas/`、`orm/`、`llm_api/`、`functions/`、`prompts/`、API 路由、数据库迁移和测试。所有“推断”均未通过完整源码或运行验证；所有具体架构判断均附上述固定提交链接。不声称已运行项目，不编造文件、API 或链接。