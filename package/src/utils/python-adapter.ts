import { Decimal } from 'decimal.js';
import { z } from 'zod';

/**
 * Python adapter layer for maintaining compatibility with Python's
 * datetime.isoformat() and numeric coercion rules
 */

// Configure Decimal.js to match Python's decimal module behavior
Decimal.set({
  precision: 28, // Python decimal default precision
  rounding: Decimal.ROUND_HALF_EVEN, // Python's default rounding mode
  toExpNeg: -7, // Match Python's scientific notation thresholds
  toExpPos: 21,
  minE: -324, // Match Python float limits
  maxE: 308,
  crypto: true, // Use crypto for random number generation
  modulo: Decimal.ROUND_DOWN, // Python's % operator behavior
});

/**
 * Python-compatible datetime handling with ±5ms tolerance
 */
export class PythonDateTime {
  private date: Date;

  constructor(date?: Date | string | number) {
    if (date === undefined) {
      this.date = new Date();
    } else if (typeof date === 'string') {
      this.date = new Date(date);
    } else if (typeof date === 'number') {
      this.date = new Date(date);
    } else {
      this.date = date;
    }
  }

  /**
   * Matches Python's datetime.isoformat() exactly
   * Format: YYYY-MM-DDTHH:mm:ss.ssssss
   */
  isoformat(): string {
    const year = this.date.getUTCFullYear();
    const month = String(this.date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(this.date.getUTCDate()).padStart(2, '0');
    const hour = String(this.date.getUTCHours()).padStart(2, '0');
    const minute = String(this.date.getUTCMinutes()).padStart(2, '0');
    const second = String(this.date.getUTCSeconds()).padStart(2, '0');
    
    // Python includes microseconds (6 digits)
    const microseconds = String(this.date.getUTCMilliseconds() * 1000).padStart(6, '0');
    
    return `${year}-${month}-${day}T${hour}:${minute}:${second}.${microseconds}`;
  }

  /**
   * Get current UTC time matching Python's datetime.utcnow()
   */
  static utcnow(): PythonDateTime {
    return new PythonDateTime(new Date());
  }

  /**
   * Format string matching Python's strftime
   */
  strftime(format: string): string {
    const formatMap: Record<string, string> = {
      '%Y': this.date.getUTCFullYear().toString(),
      '%m': String(this.date.getUTCMonth() + 1).padStart(2, '0'),
      '%d': String(this.date.getUTCDate()).padStart(2, '0'),
      '%H': String(this.date.getUTCHours()).padStart(2, '0'),
      '%M': String(this.date.getUTCMinutes()).padStart(2, '0'),
      '%S': String(this.date.getUTCSeconds()).padStart(2, '0'),
    };

    let result = format;
    for (const [pattern, replacement] of Object.entries(formatMap)) {
      result = result.replace(new RegExp(pattern, 'g'), replacement);
    }
    return result;
  }
}

/**
 * Python-compatible numeric operations using decimal.js
 */
export class PythonNumeric {
  /**
   * Convert to integer with Python's int() behavior
   */
  static int(value: string | number | Decimal): number {
    if (typeof value === 'string') {
      // Python int() truncates towards zero
      const num = parseFloat(value);
      return Math.trunc(num);
    }
    if (value instanceof Decimal) {
      return value.truncated().toNumber();
    }
    return Math.trunc(value);
  }

  /**
   * Convert to float with Python's float() behavior
   */
  static float(value: string | number | Decimal): number {
    if (typeof value === 'string') {
      const num = parseFloat(value);
      if (isNaN(num)) {
        throw new PythonValueError(`could not convert string to float: '${value}'`);
      }
      return num;
    }
    if (value instanceof Decimal) {
      return value.toNumber();
    }
    return value;
  }

  /**
   * High-precision decimal operations matching Python's decimal module
   */
  static decimal(value: string | number): Decimal {
    return new Decimal(value);
  }

  /**
   * Round with Python's round() behavior (banker's rounding)
   */
  static round(value: number, ndigits?: number): number {
    if (ndigits === undefined) {
      // Python's round() uses banker's rounding for .5 cases
      const decimal = new Decimal(value);
      return decimal.toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN).toNumber();
    }
    const decimal = new Decimal(value);
    return decimal.toDecimalPlaces(ndigits, Decimal.ROUND_HALF_EVEN).toNumber();
  }
}

/**
 * Python exception hierarchy mapping to TypeScript
 */
export class PythonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class PythonValueError extends PythonError {
  constructor(message: string) {
    super(message);
  }
}

export class PythonTypeError extends PythonError {
  constructor(message: string) {
    super(message);
  }
}

export class PythonKeyError extends PythonError {
  constructor(message: string) {
    super(message);
  }
}

export class PythonFileNotFoundError extends PythonError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Zod schema extensions for Python compatibility
 */
export const ZodPythonExtensions = {
  /**
   * String validation with Python str() coercion
   */
  pythonString: () => z.union([z.string(), z.number(), z.boolean()])
    .transform((val) => String(val)),

  /**
   * Integer validation with Python int() coercion
   */
  pythonInt: () => z.union([z.string(), z.number()])
    .transform((val) => PythonNumeric.int(val)),

  /**
   * Float validation with Python float() coercion
   */
  pythonFloat: () => z.union([z.string(), z.number()])
    .transform((val) => PythonNumeric.float(val)),

  /**
   * Datetime validation with Python datetime compatibility
   */
  pythonDateTime: () => z.union([z.string(), z.date(), z.number()])
    .transform((val) => new PythonDateTime(val)),

  /**
   * List validation with Python list() behavior
   */
  pythonList: <T>(schema: z.ZodSchema<T>) => 
    z.union([z.array(schema), z.string(), z.null(), z.undefined()])
      .transform((val) => {
        if (val === null || val === undefined) return [];
        if (typeof val === 'string') return val.split('');
        return val;
      }),
};

/**
 * Python-style string methods
 */
export class PythonString {
  constructor(private value: string) {}

  /**
   * Python str.split() behavior
   */
  split(separator?: string, maxsplit?: number): string[] {
    if (separator === undefined) {
      // Python splits on any whitespace and removes empty strings
      return this.value.trim().split(/\s+/).filter(s => s.length > 0);
    }
    
    if (maxsplit === undefined) {
      return this.value.split(separator);
    }
    
    const parts = this.value.split(separator);
    if (parts.length <= maxsplit + 1) {
      return parts;
    }
    
    const result = parts.slice(0, maxsplit);
    result.push(parts.slice(maxsplit).join(separator));
    return result;
  }

  /**
   * Python str.strip() behavior
   */
  strip(chars?: string): string {
    if (chars === undefined) {
      return this.value.trim();
    }
    
    const charSet = new Set(chars.split(''));
    let start = 0;
    let end = this.value.length - 1;
    
    while (start <= end && charSet.has(this.value[start])) {
      start++;
    }
    
    while (end >= start && charSet.has(this.value[end])) {
      end--;
    }
    
    return this.value.slice(start, end + 1);
  }

  /**
   * Python str.lower() behavior
   */
  lower(): string {
    return this.value.toLowerCase();
  }

  /**
   * Python str.count() behavior
   */
  count(substring: string): number {
    let count = 0;
    let pos = 0;
    
    while ((pos = this.value.indexOf(substring, pos)) !== -1) {
      count++;
      pos += substring.length;
    }
    
    return count;
  }

  toString(): string {
    return this.value;
  }
}

/**
 * Utility functions for Python compatibility
 */
export const PythonUtils = {
  /**
   * Python len() function
   */
  len(obj: string | unknown[] | Record<string, unknown>): number {
    if (typeof obj === 'string') return obj.length;
    if (Array.isArray(obj)) return obj.length;
    if (typeof obj === 'object' && obj !== null) return Object.keys(obj).length;
    throw new PythonTypeError(`object of type '${typeof obj}' has no len()`);
  },

  /**
   * Python range() function
   */
  range(start: number, stop?: number, step = 1): number[] {
    if (stop === undefined) {
      stop = start;
      start = 0;
    }
    
    const result: number[] = [];
    if (step > 0) {
      for (let i = start; i < stop; i += step) {
        result.push(i);
      }
    } else if (step < 0) {
      for (let i = start; i > stop; i += step) {
        result.push(i);
      }
    }
    
    return result;
  },

  /**
   * Python sum() function
   */
  sum(iterable: number[], start = 0): number {
    return iterable.reduce((acc, val) => acc + val, start);
  },

  /**
   * Python min() function
   */
  min(...args: number[]): number {
    if (args.length === 0) {
      throw new PythonValueError('min expected at least 1 argument, got 0');
    }
    return Math.min(...args);
  },

  /**
   * Python max() function
   */
  max(...args: number[]): number {
    if (args.length === 0) {
      throw new PythonValueError('max expected at least 1 argument, got 0');
    }
    return Math.max(...args);
  },
};

/**
 * Type-safe wrapper for Python-style operations
 */
export type ZodValidated<T> = T & { __zodValidated: true };

export function validateWithZod<T>(schema: z.ZodSchema<T>, data: unknown): ZodValidated<T> {
  const result = schema.parse(data);
  return result as ZodValidated<T>;
} 