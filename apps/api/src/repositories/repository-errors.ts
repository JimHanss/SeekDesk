export class DailyWorkRepositoryAccessError extends Error {
  readonly code = "workspace_access_denied";
  readonly statusCode = 403;

  constructor(resource: string, id: string) {
    super(`${resource} "${id}" belongs to a different owner.`);
    this.name = "DailyWorkRepositoryAccessError";
  }
}
