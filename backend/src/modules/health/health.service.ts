import * as healthRepository from "./health.repository.js";

// Throws if the database can't be reached.
export function checkDatabase(): Promise<void> {
  return healthRepository.pingDatabase();
}
