/**
 * src/discovery/errors.ts
 *
 * Discovery-specific error types for better error handling and reporting.
 */

export class DiscoveryError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "DiscoveryError";
  }
}

export class NetworkError extends DiscoveryError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "NetworkError";
  }
}

export class RegistryNotFoundError extends DiscoveryError {
  constructor(public readonly registryName: string) {
    super(`Registry ENS name ${registryName} has no agent:index record`);
    this.name = "RegistryNotFoundError";
  }
}
