# Daily AI News Design

## Context

This project will create a scheduled script that collects the previous day's AI-related updates, cleans and analyzes them with an LLM, writes a Markdown daily report, and sends a concise version to a Feishu bot.

The project directory is currently empty and is not a Git repository. The first implementation will create a TypeScript CLI project designed to run in GitHub Actions.

## Goals

- Run every day at 09:00 Asia/Shanghai through GitHub Actions.
- Collect yesterday's AI news, technical updates, open-source projects, tools, and model releases.
- Use Vercel AI SDK so the LLM provider and model can be switched by configuration.
- Merge duplicate items, filter weakly relevant items, and classify the final content.
- Analyze selected GitHub repositories and tools with concise, evidence-based summaries.
- Generate a full Markdown report in `reports/YYYY-MM-DD.md`.
- Send a shorter Markdown summary to a Feishu bot.
- Support automatic report commits and artifact upload, with both behaviors configurable.
- Keep a clean extension point for future search APIs.

## Non-Goals

- No database or long-running backend service in the first version.
- No browser-based admin UI.
- No dependency on scraping GitHub Trending HTML.
- No paid search API integration in the first version, though the collector interface will allow one later.
- No cross-day semantic history system in the first version beyond simple storage extension points.

## Recommended Approach

Build a lightweight TypeScript CLI with configuration-driven collectors and GitHub Actions scheduling.

This approach keeps the first version easy to run and maintain. It also leaves room for later additions such as cached deduplication, search APIs, or more sources without changing the core flow.

## Architecture

The main entry point will be `src/index.ts`. It will orchestrate the pipeline:

1. Load configuration.
2. Calculate yesterday's time window in `Asia/Shanghai`.
3. Run collectors concurrently.
4. Normalize source-specific records into a shared item shape.
5. Apply rule-based filtering and deduplication.
6. Call the LLM through Vercel AI SDK.
7. Render full Markdown and Feishu Markdown.
8. Write the report file.
9. Send the Feishu notification.
10. Let GitHub Actions upload artifacts and optionally commit the report.

Planned modules:

- `src/config/`: environment variables, source configuration, runtime options.
- `src/collectors/`: RSS, GitHub, Hugging Face, arXiv, Hacker News, and future search collectors.
- `src/normalize/`: source-to-common-item normalization.
- `src/ai/`: Vercel AI SDK integration, prompts, structured output validation, retry handling.
- `src/render/`: full report Markdown and Feishu summary Markdown.
- `src/notifiers/feishu.ts`: Feishu bot message formatting, signing, chunking, and sending.
- `src/storage/`: report writing and future state/cache interfaces.
- `.github/workflows/daily.yml`: scheduled and manual GitHub Actions workflow.

## Sources

The first version will use a hybrid model: fixed high-quality sources first, with a future search collector interface reserved.

Initial source categories:

- Company and lab blogs through RSS where available: OpenAI, Anthropic, Google DeepMind, Meta AI, Microsoft AI, NVIDIA, Hugging Face Blog, and similar sources.
- Research and model platforms: arXiv categories such as `cs.AI`, `cs.CL`, and `cs.LG`; Hugging Face trending models, datasets, and spaces where accessible.
- Open-source and tools: GitHub Search API for AI-related repositories created or updated in the target window, using keywords such as `LLM`, `agent`, `RAG`, `MCP`, `AI coding`, and `multimodal`.
- Community source: Hacker News as a low-priority source.

GitHub Trending will not be scraped in the first version because it has no stable official API. GitHub Search API will be preferred for reliability.

## Data Model

Collectors will return source-specific raw records and then normalize them into a common shape.

`RawItem` will preserve source-specific fields for debugging.

`NormalizedItem` will include:

- `id`
- `source`
- `sourceType`
- `title`
- `url`
- `publishedAt`
- `summary`
- `authors`
- `tags`
- `repo`, when the item is a GitHub repository
- `raw`

GitHub repository metadata will include:

- `fullName`
- `description`
- `language`
- `stars`
- `forks`
- `license`
- `createdAt`
- `updatedAt`
- `topics`
- `url`

## LLM Processing

LLM integration will use Vercel AI SDK. Provider and model will be configured through environment variables.

The first version will split LLM work into two stages:

1. Batch clean and deduplicate normalized items.
   - Merge duplicate or near-duplicate updates.
   - Filter marketing noise and weakly related content.
   - Classify items into `AI资讯` and `GitHub仓库/工具`.
   - Produce structured JSON with title, summary, importance score, source links, and merge rationale.

2. Analyze selected GitHub repositories and tools.
   - Explain what problem the project solves.
   - Summarize core capabilities.
   - Identify suitable use cases.
   - Include project metadata.
   - State why it is worth watching, based only on available evidence.

The prompts will require evidence-based output. The model must not invent facts beyond the provided links and metadata. Items without enough evidence should be omitted or marked as uncertain.

Structured output will be validated before rendering. If JSON parsing or validation fails, the LLM call will retry once.

## Markdown Output

The full report will be written to `reports/YYYY-MM-DD.md`.

Report structure:

```md
# AI 日报 YYYY-MM-DD

> 时间窗口：YYYY-MM-DD 00:00 - 23:59 Asia/Shanghai

## 今日摘要

- 3-5 条最重要变化

## AI资讯

### 1. 标题
- 摘要：
- 为什么重要：
- 来源：
- 相关链接：

## GitHub仓库/工具

### 1. repo/name
- 简介：
- 核心能力：
- 适用场景：
- 项目数据：
- 关注理由：
- 链接：

## 候选但未入选

- 可选审计信息，默认只写入完整报告，不发送到飞书
```

The Feishu message will be shorter:

```md
# AI 日报 YYYY-MM-DD

## 今日摘要

## AI资讯
- **标题**：一句话摘要 [来源]

## GitHub仓库/工具
- **repo/name**：一句话价值判断 [GitHub]
```

If the Feishu content exceeds a safe message size, the notifier will split it into multiple messages.

## Configuration

Configuration will come from source config files, environment variables, GitHub Secrets, and GitHub Variables.

Example environment variables:

```env
TZ=Asia/Shanghai
AI_PROVIDER=openai
AI_MODEL=gpt-4.1-mini
OPENAI_API_KEY=
FEISHU_WEBHOOK_URL=
FEISHU_SECRET=
AUTO_COMMIT_REPORT=true
REPORT_ARTIFACT=true
MAX_ITEMS_PER_SOURCE=30
```

Provider-specific keys will only be read from environment variables and GitHub Secrets. Secrets must never be logged.

## GitHub Actions

The workflow will support:

- `schedule` with cron `0 1 * * *`, which corresponds to 09:00 Asia/Shanghai.
- `workflow_dispatch` for manual runs.
- Dependency installation.
- Tests and type checks.
- Daily script execution.
- Report artifact upload.
- Optional commit of `reports/YYYY-MM-DD.md` when `AUTO_COMMIT_REPORT=true`.

If auto-commit is disabled, the report will still be uploaded as an artifact and sent to Feishu.

## Error Handling

- A single collector failure will not stop the whole run; it will be logged as a warning.
- If all collectors fail or return no usable data, the run will fail.
- LLM structured output failures will retry once.
- If LLM processing still fails, raw candidates will be saved as an artifact for debugging.
- Feishu send failure will fail the workflow after the Markdown report is generated.
- Auto-commit failure will mark the workflow failed so permission issues are visible.
- Logs must not print API keys, Feishu secrets, or full webhook URLs.

## Testing

Unit tests:

- Time window calculation for `Asia/Shanghai`.
- RSS item normalization.
- URL, title, and repository deduplication.
- Markdown rendering.
- Feishu signature generation.

Integration tests:

- Run the pipeline with fixture collector data.
- Mock Vercel AI SDK responses.
- Verify full report generation and Feishu summary rendering.

Local commands:

- `pnpm dev`: run once locally.
- `pnpm test`: run tests.
- `pnpm lint`: run type checks and formatting checks.
- `pnpm dry-run`: collect and render without sending Feishu messages or committing.

## Acceptance Criteria

- A manual GitHub Actions run can generate a report for the previous day.
- The scheduled workflow runs at 09:00 Asia/Shanghai.
- The script can use at least one LLM provider through Vercel AI SDK.
- The report contains `今日摘要`, `AI资讯`, and `GitHub仓库/工具`.
- GitHub repository entries include a short analysis and project metadata.
- Feishu receives a concise Markdown summary.
- The full Markdown report is saved and either committed or uploaded as an artifact according to configuration.
- The pipeline can run in dry-run mode without external side effects.

## Implementation Notes

- Prefer official APIs and RSS feeds over HTML scraping.
- Keep collectors small and independent so source failures are isolated.
- Keep search API support as an interface, not an active dependency in the first version.
- Use structured schemas for LLM outputs to reduce rendering failures.
- Keep prompts focused on summarization and evidence-based analysis rather than broad commentary.
