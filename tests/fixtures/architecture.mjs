import { excerptSource } from "../../scripts/source-reader.mjs";

export function architectureFixture() {
  const files = [
    [
      "src/engine.ts",
      "export function handle(input) {\n  const facts = extract(input);\n  const vectors = embed(facts);\n  write(vectors);\n  return rank(search(input));\n}\n",
    ],
    [
      "src/extract.ts",
      'export function extract(message) {\n  return message.split(";");\n}\nexport function embed(facts) {\n  return facts.map(fact => [fact.length]);\n}\n',
    ],
    [
      "src/store.ts",
      "const records = [];\nexport function write(vectors) {\n  records.push(...vectors);\n}\nexport function search(query) {\n  return records.filter(record => record[0] >= query.length);\n}\n",
    ],
    [
      "src/rank.ts",
      "export function rank(records) {\n  return records.sort((a, b) => b[0] - a[0]);\n}\n",
    ],
  ];
  const sources = files.map(([path, content]) =>
    excerptSource({
      path,
      content,
      url: `https://github.com/org/memory/blob/${"a".repeat(40)}/${path}`,
    }),
  );
  const evidence = (path, startLine = 1, endLine = 3) => [
    { path, startLine, endLine },
  ];
  const sentence =
    "使用同一个输入解释数据如何变化，引用的实现可以直接检查并设计反例验证。";
  const modules = [
    {
      id: "entry",
      name: "请求入口",
      role: sentence,
      input: "用户传入的对话文本",
      output: "准备写入的记忆事实",
      state: "本次请求的工作数据",
      kind: "project",
      evidence: evidence("src/engine.ts"),
    },
    {
      id: "extractor",
      name: "事实与表示",
      role: sentence,
      input: "需要处理的输入消息",
      output: "事实列表和向量表示",
      state: "计算得到的临时表示",
      kind: "project",
      evidence: evidence("src/extract.ts"),
    },
    {
      id: "store",
      name: "存储与排序",
      role: sentence,
      input: "写入向量或检索请求",
      output: "按得分排序的结果",
      state: "保存起来的记录集合",
      kind: "project",
      evidence: evidence("src/store.ts", 1, 4),
    },
  ];
  const steps = [
    ["handle", "src/engine.ts", 1, 6],
    ["extract", "src/extract.ts", 1, 3],
    ["embed", "src/extract.ts", 4, 6],
    ["write", "src/store.ts", 2, 4],
    ["search", "src/store.ts", 5, 7],
    ["rank", "src/rank.ts", 1, 3],
  ];
  const report = {
    overview: {
      plainLanguage: "把对话变成可以找回的记录，再按查询返回有关的内容。",
      problem: sentence,
      scenarioInput: "用户给出两段需要记住的对话作为输入。",
      scenarioOutput: "根据查询返回经过筛选并排序的相关记录。",
    },
    modules,
    relations: [
      { from: "entry", to: "extractor", label: "提取事实" },
      { from: "extractor", to: "store", label: "写入表示" },
    ],
    flow: steps.map(([symbol, path, startLine, endLine], i) => ({
      title: `处理这个请求的第 ${i + 1} 步`,
      symbol,
      owner: "project",
      input: sentence,
      action: sentence,
      stateChange: sentence,
      output: sentence,
      evidence: evidence(path, startLine, endLine),
    })),
    technologies: [
      "分离原文和记忆事实",
      "把内容映射为可比较的表示",
      "保存候选并按相关性排序",
    ].map((name, i) => ({
      name,
      problem: sentence,
      mechanism: sentence,
      pseudocode: "输入消息\n提取事实\n保存表示\n查询并排序候选",
      dataStructures: sentence,
      projectCode: sentence,
      externalDependency: sentence,
      tradeoff: sentence,
      evidence: steps[i + 1]
        ? evidence(steps[i + 1][1], steps[i + 1][2], steps[i + 1][3])
        : [],
    })),
    decisions: [1, 2, 3].map((i) => ({
      decision: `把职责拆成可分别检验的第 ${i} 个边界`,
      constraint: sentence,
      alternative: sentence,
      why: sentence,
      cost: sentence,
      kind: "engineering-inference",
      maintainerQuote: "",
      evidence: evidence("src/store.ts", 1, 7),
    })),
    codeWalkthroughs: ["src/engine.ts", "src/rank.ts"].map((path) => ({
      title: "从实际代码理解数据如何改变",
      explanation: sentence + sentence,
      evidence: evidence(path, 1, 3),
    })),
    experiments: [1, 2].map((i) => ({
      question: `第 ${i} 个输入变化如何影响结果`,
      change: sentence,
      expected: sentence,
      evidence: evidence("src/rank.ts"),
    })),
    takeaways: [sentence, sentence, sentence],
    gaps: ["这只是测试用的小型记忆流程，不代表任何实际项目。"],
  };
  return { sources, report, files };
}
