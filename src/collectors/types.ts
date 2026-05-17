import type { NormalizedItem, RuntimeConfig, TimeWindow } from "../types.js";

export interface CollectorContext {
  config: RuntimeConfig;
  window: TimeWindow;
}

export interface Collector {
  name: string;
  collect(context: CollectorContext): Promise<NormalizedItem[]>;
}
