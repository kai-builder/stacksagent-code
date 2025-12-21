import { z } from 'zod';

/**
 * Creates a Zod schema for boolean values that handles MCP's string-based parameter passing.
 * MCP protocol passes all parameters as strings, so we need to preprocess them into booleans.
 *
 * @param defaultValue Optional default value for the boolean parameter
 * @returns A Zod schema that coerces string values to booleans
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   enabled: coercedBoolean(true).describe('Enable feature'),
 *   confirmAction: coercedBoolean().describe('Confirm action'),
 * });
 * ```
 */
export const coercedBoolean = (defaultValue?: boolean) =>
  z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        const normalized = val.toLowerCase();
        return normalized === 'true' || normalized === '1';
      }
      return val;
    },
    defaultValue !== undefined
      ? z.boolean().optional().default(defaultValue)
      : z.boolean().optional()
  );
