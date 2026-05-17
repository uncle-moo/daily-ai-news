export type SourceType =
  | "rss"
  | "github"
  | "github-trending"
  | "hacker-news"
  | "hugging-face"
  | "arxiv"
  | "search";

export interface TimeWindow {
  labelDate: string;
  start: Date;
  end: Date;
  timezone: string;
}

export interface RepoMetadata {
  fullName: string;
  description?: string;
  language?: string;
  stars?: number;
  forks?: number;
  license?: string;
  createdAt?: string;
  updatedAt?: string;
  topics?: string[];
  url: string;
}

export interface RawItem {
  source: string;
  sourceType: SourceType;
  raw: unknown;
}

export interface NormalizedItem {
  id: string;
  source: string;
  sourceType: SourceType;
  title: string;
  url: string;
  publishedAt?: string;
  summary?: string;
  authors?: string[];
  tags?: string[];
  repo?: RepoMetadata;
  raw?: unknown;
}

export interface AnalyzedNewsItem {
  title: string;
  summary: string;
  whyImportant: string;
  importance: number;
  sources: string[];
}

export interface AnalyzedRepoItem {
  fullName: string;
  summary: string;
  coreCapabilities: string[];
  useCases: string[];
  projectData: string;
  whyWatch: string;
  url: string;
}

export interface AnalyzedReport {
  date: string;
  highlights: string[];
  news: AnalyzedNewsItem[];
  repositories: AnalyzedRepoItem[];
  rejected: string[];
}

export interface RssSourceConfig {
  name: string;
  url: string;
}

export interface SourcesConfig {
  /** Which top-level collectors are enabled */
  enabledSources: Set<"rss" | "github" | "github-trending" | "hacker-news" | "hugging-face">;
  /** RSS feed list */
  rssSources: RssSourceConfig[];
  /** Keywords used by the GitHub repository search collector */
  githubKeywords: string[];
  /** Search terms used by the Hacker News collector */
  hackerNewsKeywords: string[];
  /** Time range for GitHub Trending: "daily" | "weekly" | "monthly" */
  githubTrendingSince: "daily" | "weekly" | "monthly";
  /** Language filter for GitHub Trending, e.g. "python". Empty string means all languages */
  githubTrendingLanguage: string;
}

export interface RuntimeConfig {
  timezone: string;
  baseUrl: string;
  apiKey: string;
  aiModel: string;
  githubToken?: string;
  feishuWebhookUrl?: string;
  feishuSecret?: string;
  autoCommitReport: boolean;
  reportArtifact: boolean;
  maxItemsPerSource: number;
  maxItemsForAnalysis: number;
  dryRun: boolean;
  sources: SourcesConfig;
}
