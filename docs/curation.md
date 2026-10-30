# 经典与新锐：选题和源码学习路线

核对日期：2026-10-30。收录从 9 个增加到 21 个；新增项目各跟踪默认分支，原有的多版本配置保留。

经典项目用于理解成熟的设计模式；新锐项目用于跟进近期活跃的设计方向。选题检查公开实现、维护状态、可辨认的执行入口以及相对于现有项目的学习价值。标签由人工选题维护。

## 此次新增的经典项目

| 项目 | 方向 | 学什么 | 固定源码入口 |
| --- | --- | --- | --- |
| [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | Harness | 理解状态更新、并行步骤、持久化与中断恢复如何进入同一执行循环。 | [state.py](https://github.com/langchain-ai/langgraph/blob/6f2df053f4487ce6ea8decc0d7482c8e46e0f132/libs/langgraph/langgraph/graph/state.py) |
| [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) | Harness | 比较角色式任务编排与显式状态图，研究任务上下文、工具执行和结果交接。 | [crew.py](https://github.com/crewAIInc/crewAI/blob/97bbfb64811775a965304bda45c8ec0e8e4ef3a2/lib/crewai/src/crewai/crew.py) |
| [pydantic/pydantic-ai](https://github.com/pydantic/pydantic-ai) | Harness | 研究确定性类型验证怎样约束不确定的模型输出，以及验证失败如何进入重试。 | [abstract.py](https://github.com/pydantic/pydantic-ai/blob/5db735a8a61463e3e3b5349ccd3ec12a63d8f621/pydantic_ai_slim/pydantic_ai/agent/abstract.py) |
| [run-llama/llama_index](https://github.com/run-llama/llama_index) | Memory / 上下文 | 把 RAG、聊天历史缓冲和长期 memory block 分清，学习 token 预算与检索注入。 | [memory.py](https://github.com/run-llama/llama_index/blob/619d74664e8404612038bc15a1a40c686037277c/llama-index-core/llama_index/core/memory/memory.py) |
| [vercel/ai](https://github.com/vercel/ai) | 人机交互 | 沿浏览器发送消息、服务端流式生成和客户端归并，研究前后端协议边界。 | [use-chat.ts](https://github.com/vercel/ai/blob/dfed8e8234b684c3e2a0571ad1a1078c8364b44c/packages/react/src/use-chat.ts) |
| [langgenius/dify](https://github.com/langgenius/dify) | 人机交互 | 学习界面配置怎样成为执行请求，以及工作流暂停、表单提交和恢复的边界。 | [app_generator.py](https://github.com/langgenius/dify/blob/4d26f85847e0b9240b7a81f94aa99c49c9dbe95d/api/core/app/apps/workflow/app_generator.py) |

## 此次新增的新锐项目

| 项目 | 方向 | 学什么 | 固定源码入口 |
| --- | --- | --- | --- |
| [microsoft/agent-framework](https://github.com/microsoft/agent-framework) | Harness | 对比框架的通用 Agent 抽象和上层 Harness，研究长任务循环与人工审批的协作。 | [_agent.py](https://github.com/microsoft/agent-framework/blob/1a6300e287658d184201e2389decf6c183c0ff87/python/packages/core/agent_framework/_harness/_agent.py) |
| [bytedance/deer-flow](https://github.com/bytedance/deer-flow) | Harness | 学习沙箱租约、子任务委派和上下文管理如何跨越一次模型调用。 | [agent.py](https://github.com/bytedance/deer-flow/blob/c50cdc5161779c8b32cda6a0cb575303195f5e65/backend/packages/harness/deerflow/agents/lead_agent/agent.py) |
| [earendil-works/pi](https://github.com/earendil-works/pi) | Harness | 研究小型核心怎样承载工具调用、打断与后续输入，再由编码会话层扩展。 | [agent-loop.ts](https://github.com/earendil-works/pi/blob/f09d01b85e0384647fcab6779d35ab9dabe04be3/packages/agent/src/agent-loop.ts) |
| [volcengine/OpenViking](https://github.com/volcengine/OpenViking) | Memory / 上下文 | 比较向量记录与目录式上下文组织，研究摘要层级、检索预算和会话记忆提交。 | [core.py](https://github.com/volcengine/OpenViking/blob/68f3ad28e7976f4e5973663bc80dd252453170e3/openviking/service/core.py) |
| [MemTensor/MemOS](https://github.com/MemTensor/MemOS) | Memory / 上下文 | 研究 memory cube 与具体记忆实现的边界，比较图/树组织与简单向量记忆。 | [core.py](https://github.com/MemTensor/MemOS/blob/64388b50e2a15528bcdf032e65a1ac792bcf63ee/src/memos/mem_os/core.py) |
| [a2ui-project/a2ui](https://github.com/a2ui-project/a2ui) | 人机交互 | 比较结构化 UI 描述、任意代码生成与文本事件，研究可信组件映射和数据绑定。 | [message-processor.ts](https://github.com/a2ui-project/a2ui/blob/b8bee8fbd16f37afae8a6ba3f1ad16a76d305130/typescript/core/web_core/src/processing/message-processor.ts) |

## 按问题选择阅读路线

- **运行闭环：** 先看 LangGraph 的状态与提交，再比较 CrewAI 的任务组织、Pydantic AI 的验证与重试；接着研究 Pi 的核心循环、DeerFlow 的工作环境和 Microsoft Agent Framework 的 harness 装配。
- **记忆与上下文：** 用 LlamaIndex 区分历史缓冲、memory block 和检索；与现有 Mem0、Graphiti 对照，再读 OpenViking 的目录与分层上下文、MemOS 的容器与具体记忆后端。
- **人机交互：** Vercel AI SDK 跟踪消息与工具审批；Dify 跟踪可视化配置、人工输入和恢复；A2UI 跟踪组件描述、客户端渲染和 action 回传，与现有 AG-UI、assistant-ui 对照。

## 本次核对中的变化

- Pi 使用当前规范仓库 [earendil-works/pi](https://github.com/earendil-works/pi)，旧 badlogic/pi-mono 地址会跳转。
- A2UI 使用当前规范仓库 [a2ui-project/a2ui](https://github.com/a2ui-project/a2ui)，旧 google/A2UI 地址会跳转。
- [Chainlit](https://github.com/Chainlit/chainlit) 在本次核对时已归档，因此这批默认跟踪项目采用 Dify 补充经典平台方向。

## 文档生成要求

每个新增项目都配置具体输入场景、至少四个已核实的核心文件和设计问题。导读沿真实执行和数据变化展开，解释核心机制、替代方案与代价；只讲 Provider、类型或初始化不能完成执行路径分析。第三方框架、存储和执行引擎的内部逻辑须有证据才能展开。

经典/新锐标签、摘要和发现标签的编辑会更新目录展示，并复用已有分支文档；源码提交、阅读场景或核心阅读配置变化时才重新分析。笔记继续按仓库与版本隔离。
