import { mkdir, readFile, writeFile } from "node:fs/promises";
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

export type DailyWorkDataLayerStatus = {
  currentLayer: "seed_mock" | "json_local" | "future_database";
  dataDirConfigured: boolean;
  jsonLocalReady: boolean;
  futureDatabaseReady: false;
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
  updateApprovalRequest(request: DailyApprovalRequest): Promise<DailyApprovalRequest>;
  updateSessionDetail(session: DailyWorkSessionDetail): Promise<DailyWorkSessionDetail>;
  upsertActivityEvent(event: DailyActivityEvent): Promise<DailyActivityEvent>;
  getDataLayerStatus(): Promise<DailyWorkDataLayerStatus>;
}

export class DailyWorkRepositoryDataError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "DailyWorkRepositoryDataError";

    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export class SeedDailyWorkRepository implements DailyWorkRepository {
  private readonly templates = cloneJson(defaultDailyWorkTemplates);
  private readonly contextItems = cloneJson(defaultDailyWorkContextItems);
  private readonly approvalRequests = cloneJson(defaultDailyWorkApprovalRequests);
  private readonly artifacts = cloneJson(defaultDailyWorkArtifacts);
  private readonly sessionDetails = cloneJson(defaultDailyWorkSessionDetails);
  private readonly events = cloneJson(defaultDailyActivityEvents);
  private readonly connectors = cloneJson(defaultDailyWorkConnectors);
  private readonly workflows = cloneJson(defaultDailyWorkflows);

  async listTemplates() {
    return cloneJson(this.templates);
  }

  async listContextItems() {
    return cloneJson(this.contextItems);
  }

  async listApprovalRequests() {
    return cloneJson(this.approvalRequests);
  }

  async listArtifacts() {
    return cloneJson(this.artifacts);
  }

  async listSessionSummaries() {
    return dailyWorkSessionSummarySchema.array().parse(
      this.sessionDetails.map(({ recentMessages, ...summary }) => {
        void recentMessages;
        return summary;
      })
    );
  }

  async listSessionDetails() {
    return cloneJson(this.sessionDetails);
  }

  async listEvents() {
    return cloneJson(this.events);
  }

  async listConnectors() {
    return cloneJson(this.connectors);
  }

  async listWorkflows() {
    return cloneJson(this.workflows);
  }

  async updateApprovalRequest(request: DailyApprovalRequest) {
    const parsed = dailyApprovalRequestSchema.parse(request);

    return cloneJson(parsed);
  }

  async updateSessionDetail(session: DailyWorkSessionDetail) {
    const parsed = dailyWorkSessionDetailSchema.parse(session);

    return cloneJson(parsed);
  }

  async upsertActivityEvent(event: DailyActivityEvent) {
    const parsed = dailyActivityEventSchema.parse(event);

    return cloneJson(parsed);
  }

  async getDataLayerStatus(): Promise<DailyWorkDataLayerStatus> {
    return {
      currentLayer: "seed_mock",
      dataDirConfigured: false,
      jsonLocalReady: false,
      futureDatabaseReady: false
    };
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

  async updateApprovalRequest(request: DailyApprovalRequest) {
    const parsed = dailyApprovalRequestSchema.parse(request);
    const approvalRequests = await this.listApprovalRequests();
    replaceById(approvalRequests, parsed);
    await this.writeCollection(
      "approvals",
      dailyApprovalRequestSchema.array(),
      approvalRequests
    );

    return cloneJson(parsed);
  }

  async updateSessionDetail(session: DailyWorkSessionDetail) {
    const parsed = dailyWorkSessionDetailSchema.parse(session);
    const sessionDetails = await this.listSessionDetails();
    replaceById(sessionDetails, parsed);
    await this.writeCollection(
      "sessions",
      dailyWorkSessionDetailSchema.array(),
      sessionDetails
    );

    return cloneJson(parsed);
  }

  async upsertActivityEvent(event: DailyActivityEvent) {
    const parsed = dailyActivityEventSchema.parse(event);
    const events = await this.listEvents();
    upsertFirstById(events, parsed);
    await this.writeCollection("events", dailyActivityEventSchema.array(), events);

    return cloneJson(parsed);
  }

  async getDataLayerStatus(): Promise<DailyWorkDataLayerStatus> {
    let jsonLocalReady = true;

    try {
      await mkdir(this.dataDir, { recursive: true });
    } catch {
      jsonLocalReady = false;
    }

    return {
      currentLayer: "json_local",
      dataDirConfigured: true,
      jsonLocalReady,
      futureDatabaseReady: false
    };
  }

  private async readCollection<T>(
    key: JsonCollectionKey,
    parser: JsonArrayParser<T>,
    fallback: () => Promise<T[]>
  ): Promise<T[]> {
    const filePath = join(this.dataDir, jsonFileNames[key]);
    let rawJson: string;

    try {
      rawJson = await readFile(filePath, "utf8");
    } catch (error) {
      if (isMissingFileError(error)) {
        const seedValues = await fallback();
        await this.writeCollection(key, parser, seedValues);

        return seedValues;
      }

      throw error;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(rawJson) as unknown;
    } catch (error) {
      throw createInvalidJsonFileError(key, filePath, error);
    }

    const collection = unwrapJsonCollection(parsed, key);

    try {
      return parser.parse(collection);
    } catch (error) {
      throw createInvalidSchemaFileError(key, filePath, error);
    }
  }

  private async writeCollection<T>(
    key: JsonCollectionKey,
    parser: JsonArrayParser<T>,
    values: T[]
  ) {
    const parsed = parser.parse(values);
    const filePath = join(this.dataDir, jsonFileNames[key]);

    await mkdir(this.dataDir, { recursive: true });
    await writeFile(
      filePath,
      `${JSON.stringify({ [key]: parsed }, null, 2)}\n`,
      "utf8"
    );
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

function createInvalidJsonFileError(
  key: JsonCollectionKey,
  filePath: string,
  cause: unknown
) {
  return new DailyWorkRepositoryDataError(
    `Invalid daily-work JSON data file for collection "${key}" at ${filePath}: ${formatErrorMessage(cause)}`,
    cause
  );
}

function createInvalidSchemaFileError(
  key: JsonCollectionKey,
  filePath: string,
  cause: unknown
) {
  return new DailyWorkRepositoryDataError(
    `Invalid daily-work JSON schema for collection "${key}" at ${filePath}: ${formatSchemaError(cause)}`,
    cause
  );
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function formatSchemaError(error: unknown): string {
  if (hasSchemaIssues(error)) {
    return error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";

        return `${path}: ${issue.message}`;
      })
      .join("; ");
  }

  return formatErrorMessage(error);
}

function hasSchemaIssues(error: unknown): error is {
  issues: Array<{ path: Array<string | number>; message: string }>;
} {
  if (!error || typeof error !== "object" || !("issues" in error)) {
    return false;
  }

  const issues = (error as { issues: unknown }).issues;

  return Array.isArray(issues);
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function replaceById<T extends { id: string }>(items: T[], nextItem: T) {
  const index = items.findIndex((item) => item.id === nextItem.id);

  if (index === -1) {
    items.push(nextItem);
    return;
  }

  items[index] = nextItem;
}

function upsertFirstById<T extends { id: string }>(items: T[], nextItem: T) {
  const filtered = items.filter((item) => item.id !== nextItem.id);
  items.length = 0;
  items.push(nextItem, ...filtered);
}
