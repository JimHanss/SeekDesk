import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  dailyActivityEventSchema,
  dailyApprovalRequestSchema,
  dailyContextItemSchema,
  dailyWorkArtifactSchema,
  dailyWorkConnectorSchema,
  dailyWorkSessionDetailSchema,
  dailyWorkSessionSummarySchema,
  dailyWorkTemplateSchema,
  dailyWorkWorkflowSchema,
  defaultDailyActivityEvents,
  defaultDailyWorkApprovalRequests,
  defaultDailyWorkArtifacts,
  defaultDailyWorkConnectors,
  defaultDailyWorkContextItems,
  defaultDailyWorkSessionDetails,
  defaultDailyWorkSessionSummaries,
  defaultDailyWorkTemplates,
  defaultDailyWorkflows,
  type DailyActivityEvent,
  type DailyApprovalRequest,
  type DailyContextItem,
  type DailyWorkArtifact,
  type DailyWorkConnector,
  type DailyWorkSessionDetail,
  type DailyWorkSessionSummary,
  type DailyWorkTemplate,
  type DailyWorkWorkflow
} from "@seekdesk/shared";

type JsonCollectionKey =
  | "templates"
  | "context"
  | "approvals"
  | "artifacts"
  | "sessions"
  | "events"
  | "connectors"
  | "workflows";

type JsonArrayParser<T> = {
  parse(input: unknown): T[];
};

const jsonFileNames: Record<JsonCollectionKey, string> = {
  templates: "templates.json",
  context: "context.json",
  approvals: "approvals.json",
  artifacts: "artifacts.json",
  sessions: "sessions.json",
  events: "events.json",
  connectors: "connectors.json",
  workflows: "workflows.json"
};

export interface DailyWorkRepository {
  listTemplates(): Promise<DailyWorkTemplate[]>;
  listContextItems(): Promise<DailyContextItem[]>;
  listApprovalRequests(): Promise<DailyApprovalRequest[]>;
  listArtifacts(): Promise<DailyWorkArtifact[]>;
  listSessionSummaries(): Promise<DailyWorkSessionSummary[]>;
  listSessionDetails(): Promise<DailyWorkSessionDetail[]>;
  listEvents(): Promise<DailyActivityEvent[]>;
  listConnectors(): Promise<DailyWorkConnector[]>;
  listWorkflows(): Promise<DailyWorkWorkflow[]>;
}

export class SeedDailyWorkRepository implements DailyWorkRepository {
  async listTemplates() {
    return cloneJson(defaultDailyWorkTemplates);
  }

  async listContextItems() {
    return cloneJson(defaultDailyWorkContextItems);
  }

  async listApprovalRequests() {
    return cloneJson(defaultDailyWorkApprovalRequests);
  }

  async listArtifacts() {
    return cloneJson(defaultDailyWorkArtifacts);
  }

  async listSessionSummaries() {
    return cloneJson(defaultDailyWorkSessionSummaries);
  }

  async listSessionDetails() {
    return cloneJson(defaultDailyWorkSessionDetails);
  }

  async listEvents() {
    return cloneJson(defaultDailyActivityEvents);
  }

  async listConnectors() {
    return cloneJson(defaultDailyWorkConnectors);
  }

  async listWorkflows() {
    return cloneJson(defaultDailyWorkflows);
  }
}

export class JsonDailyWorkRepository implements DailyWorkRepository {
  constructor(
    private readonly dataDir: string,
    private readonly seedRepository: DailyWorkRepository = new SeedDailyWorkRepository()
  ) {}

  async listTemplates() {
    return this.readCollection(
      "templates",
      dailyWorkTemplateSchema.array(),
      () => this.seedRepository.listTemplates()
    );
  }

  async listContextItems() {
    return this.readCollection(
      "context",
      dailyContextItemSchema.array(),
      () => this.seedRepository.listContextItems()
    );
  }

  async listApprovalRequests() {
    return this.readCollection(
      "approvals",
      dailyApprovalRequestSchema.array(),
      () => this.seedRepository.listApprovalRequests()
    );
  }

  async listArtifacts() {
    return this.readCollection(
      "artifacts",
      dailyWorkArtifactSchema.array(),
      () => this.seedRepository.listArtifacts()
    );
  }

  async listSessionSummaries() {
    const details = await this.listSessionDetails();

    return dailyWorkSessionSummarySchema.array().parse(
      details.map(({ recentMessages, ...summary }) => {
        void recentMessages;
        return summary;
      })
    );
  }

  async listSessionDetails() {
    return this.readCollection(
      "sessions",
      dailyWorkSessionDetailSchema.array(),
      () => this.seedRepository.listSessionDetails()
    );
  }

  async listEvents() {
    return this.readCollection(
      "events",
      dailyActivityEventSchema.array(),
      () => this.seedRepository.listEvents()
    );
  }

  async listConnectors() {
    return this.readCollection(
      "connectors",
      dailyWorkConnectorSchema.array(),
      () => this.seedRepository.listConnectors()
    );
  }

  async listWorkflows() {
    return this.readCollection(
      "workflows",
      dailyWorkWorkflowSchema.array(),
      () => this.seedRepository.listWorkflows()
    );
  }

  private async readCollection<T>(
    key: JsonCollectionKey,
    parser: JsonArrayParser<T>,
    fallback: () => Promise<T[]>
  ): Promise<T[]> {
    const filePath = join(this.dataDir, jsonFileNames[key]);

    try {
      const rawJson = await readFile(filePath, "utf8");
      const parsed = JSON.parse(rawJson) as unknown;
      const collection = unwrapJsonCollection(parsed, key);

      return parser.parse(collection);
    } catch (error) {
      if (isMissingFileError(error)) {
        return fallback();
      }

      throw error;
    }
  }
}

export function createDailyWorkRepositoryFromEnv(
  env: NodeJS.ProcessEnv = process.env
): DailyWorkRepository {
  const dataDir = env.SEEKDESK_DATA_DIR?.trim();

  if (!dataDir) {
    return new SeedDailyWorkRepository();
  }

  return new JsonDailyWorkRepository(dataDir);
}

function unwrapJsonCollection(input: unknown, key: JsonCollectionKey): unknown {
  if (Array.isArray(input)) {
    return input;
  }

  if (input && typeof input === "object" && key in input) {
    return (input as Record<JsonCollectionKey, unknown>)[key];
  }

  return input;
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
