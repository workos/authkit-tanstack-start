/**
 * Input check shared by the `switchToOrganization` server function and the
 * `switchToOrganizationAction` action (issue #139).
 *
 * Validators are part of what the client bundle can see, so this file must
 * not import anything server-only. Keep it dependency-free.
 */

export interface SwitchToOrganizationInputOptions {
  /** Name of the calling function, used in the error message. */
  fnName: string;
  /** Whether the expected shape includes an optional string `returnTo`. */
  withReturnTo: boolean;
}

/**
 * Throws an `Error` naming `fnName` and the expected shape when `input` is not
 * an object with a non-empty string `organizationId` (and, when `withReturnTo`
 * is set, a `returnTo` that is either absent or a string). Returns `input`
 * unchanged otherwise.
 */
export function validateSwitchToOrganizationInput<T>(input: T, options: SwitchToOrganizationInputOptions): T {
  const shape = options.withReturnTo ? '{ organizationId: string, returnTo?: string }' : '{ organizationId: string }';
  const invalid = () => new Error(`${options.fnName} requires ${shape}`);

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw invalid();
  }

  const { organizationId, returnTo } = input as { organizationId?: unknown; returnTo?: unknown };

  if (typeof organizationId !== 'string' || organizationId === '') {
    throw invalid();
  }

  if (options.withReturnTo && returnTo !== undefined && typeof returnTo !== 'string') {
    throw invalid();
  }

  return input;
}
