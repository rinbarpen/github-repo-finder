# letta 源码学习指南

> 基于选定源码的结构化索引 · archive · 56ba9c255526
> 生成于 2026-10-28T18:02:33.080Z。这是 Repo Atlas 生成的证据索引，非 DeepWiki 官方内容；未执行或验证目标项目。架构与行为需沿来源继续核实。

## 项目概览

围绕状态与记忆构建 Agent，对照迁移说明和历史服务端学习。

Platform for stateful agents: AI with advanced memory that can learn and self-improve over time.

**为什么值得读：** 对照 main 的源码迁移说明与 archive 历史服务端研究记忆状态；当前实现位于 letta-ai/letta-code。

| 项目 | 信息 |
| --- | --- |
| 研究方向 | Agent Memory / 记忆与上下文 |
| 语言 | 未识别 |
| 许可证 | Apache-2.0 |
| 分支 / 标签 | archive |
| 固定提交 | [56ba9c255526](https://github.com/letta-ai/letta/commit/56ba9c25552605eec89de8ed3dc6394b625c1993) |
| 上游主页 | [letta-ai/letta](https://github.com/letta-ai/letta) |

## 目录地图

以下目录实际存在于该提交，用于定位入口，不代表已完成全仓分析。

- [`.github/`](https://github.com/letta-ai/letta/tree/56ba9c25552605eec89de8ed3dc6394b625c1993/.github)
- [`alembic/`](https://github.com/letta-ai/letta/tree/56ba9c25552605eec89de8ed3dc6394b625c1993/alembic)
- [`assets/`](https://github.com/letta-ai/letta/tree/56ba9c25552605eec89de8ed3dc6394b625c1993/assets)
- [`certs/`](https://github.com/letta-ai/letta/tree/56ba9c25552605eec89de8ed3dc6394b625c1993/certs)
- [`db/`](https://github.com/letta-ai/letta/tree/56ba9c25552605eec89de8ed3dc6394b625c1993/db)
- [`examples/`](https://github.com/letta-ai/letta/tree/56ba9c25552605eec89de8ed3dc6394b625c1993/examples)
- [`fern/`](https://github.com/letta-ai/letta/tree/56ba9c25552605eec89de8ed3dc6394b625c1993/fern)
- [`letta/`](https://github.com/letta-ai/letta/tree/56ba9c25552605eec89de8ed3dc6394b625c1993/letta)
- [`otel/`](https://github.com/letta-ai/letta/tree/56ba9c25552605eec89de8ed3dc6394b625c1993/otel)
- [`sandbox/`](https://github.com/letta-ai/letta/tree/56ba9c25552605eec89de8ed3dc6394b625c1993/sandbox)
- [`scripts/`](https://github.com/letta-ai/letta/tree/56ba9c25552605eec89de8ed3dc6394b625c1993/scripts)
- [`tests/`](https://github.com/letta-ai/letta/tree/56ba9c25552605eec89de8ed3dc6394b625c1993/tests)



## 核心文件与符号



### 1. README.md

来源：[README.md](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/README.md) · 读取 4,715 字符

阅读目标：了解项目定位、安装方式、示例与官方文档入口。

当前片段未提取到顶层符号，请打开来源继续阅读。

### 2. pyproject.toml

来源：[pyproject.toml](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/pyproject.toml) · 读取 5,409 字符

阅读目标：核对依赖、包入口、构建和运行约定。

当前片段未提取到顶层符号，请打开来源继续阅读。

### 3. letta/agent.py

来源：[letta/agent.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agent.py) · 读取 10,000 字符（片段，已截断）

阅读目标：从实际定义出发，跟踪调用方、状态变化及异常分支。

当前片段识别到的符号：`BaseAgent`、`step`、`Agent`、`__init__`、`load_last_function_response`、`ensure_read_only_block_not_modified`、`update_memory_if_changed`。

### 4. letta/agents/agentloop.py

来源：[letta/agents/agentloop.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agents/agent_loop.py) · 读取 2,699 字符

阅读目标：从实际定义出发，跟踪调用方、状态变化及异常分支。

当前片段识别到的符号：`AgentLoop`、`load`。

### 5. letta/agents/baseagentv2.py

来源：[letta/agents/baseagentv2.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agents/base_agent_v2.py) · 读取 4,532 字符

阅读目标：从实际定义出发，跟踪调用方、状态变化及异常分支。

当前片段识别到的符号：`BaseAgentV2`、`__init__`、`agent_id`、`build_request`、`step`、`stream`。

## 建议阅读路线

1. 从 README 确认项目边界，依据官方文档运行最小示例。
2. 从包清单定位公开入口，对照上面的核心文件查找调用关系。
3. 选择一次最小任务，记录输入、状态、工具或存储调用以及输出。
4. 为异常、取消和重复调用分别设计一个实验，验证自己的理解。
5. 切换到另一个跟踪分支或版本，对照固定提交复查行为变化。

## 研究问题

- [ ] 写入、检索、更新、删除记忆分别在哪里实现？
- [ ] 如何划分用户、会话和 Agent 的记忆边界？
- [ ] 如何验证检索质量以及记忆过期和冲突的处理？
- [ ] 哪些行为已经通过实际代码或实验验证，哪些仍然是假设？
- [ ] 与同类别其他仓库相比，接口和设计取舍有哪些不同？

## 动手实验

- 复现 README 的最小示例，记录运行环境、版本与结果。
- 在一个关键入口加入日志，画出一次调用的真实时序。
- 用一个失败输入观察错误是如何返回和恢复的。

## 来源与覆盖范围

采集 5 个文件片段，目录记录 1282 项。分析固定到提交 `56ba9c25552605eec89de8ed3dc6394b625c1993`，不随上游分支漂移。文件选择为启发式抽样，不能据此推断完整架构。

- [README.md](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/README.md)
- [pyproject.toml](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/pyproject.toml)
- [letta/agent.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agent.py)
- [letta/agents/agentloop.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agents/agent_loop.py)
- [letta/agents/baseagentv2.py](https://github.com/letta-ai/letta/blob/56ba9c25552605eec89de8ed3dc6394b625c1993/letta/agents/base_agent_v2.py)

完整在线知识库入口：[DeepWiki](https://deepwiki.com/letta-ai/letta)（是否已被该服务索引以实际页面为准）。
