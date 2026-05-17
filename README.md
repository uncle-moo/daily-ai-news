# Daily AI News

Daily AI News 是一个基于 GitHub Actions 的每日 AI 资讯自动化脚本。它会定时收集 AI 相关资讯、技术动态、GitHub 仓库和工具信息，使用 LLM 清洗、去重和分析，生成 Markdown 日报，并发送摘要到飞书机器人。

## 现有能力

- 自定义资讯源：可在 `src/config/sources.ts` 中配置 RSS 来源和 GitHub 搜索关键词。
- 可配置飞书机器人：通过 `FEISHU_WEBHOOK_URL` 和 `FEISHU_SECRET` 配置飞书机器人通知。
- 可切换 LLM：通过 `BASE_URL`、`API_KEY`、`AI_MODEL` 接入 DeepSeek 或其他 OpenAI-compatible 服务。
- 自动生成日报：完整报告写入 `reports/YYYY-MM-DD.md`。
- 定时运行：GitHub Actions 每天北京时间 09:00 自动执行。
- 支持手动触发：可在 GitHub Actions 页面手动运行，并支持 dry-run。

## 本地运行

```bash
corepack pnpm install
cp .env.example .env
corepack pnpm dry-run
```

## GitHub Actions Secrets

在 `Settings` -> `Secrets and variables` -> `Actions` -> `Secrets` 中配置：

- `API_KEY`：LLM API Key，例如 DeepSeek Key。
- `FEISHU_WEBHOOK_URL`：飞书机器人 webhook。
- `FEISHU_SECRET`：飞书机器人签名密钥；如果机器人没有开启签名校验，可不填。

## GitHub Actions Variables

在 `Settings` -> `Secrets and variables` -> `Actions` -> `Variables` 中配置：

- `BASE_URL`：OpenAI-compatible API 地址，例如 `https://api.deepseek.com/v1`。
- `AI_MODEL`：模型名，例如 `deepseek-chat` 或 `deepseek-reasoner`。
- `AUTO_COMMIT_REPORT`：是否自动提交日报到仓库，`true` 或 `false`。
- `REPORT_ARTIFACT`：是否上传日报为 Actions artifact，`true` 或 `false`。
- `MAX_ITEMS_PER_SOURCE`：每个数据源最多采集的条目数。

## 定时规则

Workflow cron 为：

```yaml
0 1 * * *
```

GitHub Actions 使用 UTC 时间，因此该配置对应北京时间每天 09:00。

## 常用命令

- `corepack pnpm dev`：本地 dry-run。
- `corepack pnpm dry-run`：采集并生成报告，但不发送飞书。
- `corepack pnpm start`：采集、生成报告并发送飞书。
- `corepack pnpm test`：运行测试。
- `corepack pnpm lint`：运行 TypeScript 类型检查。
