import { z } from 'zod';
import { ZodValidated } from '@/utils/python-adapter';

/**
 * Zod schemas for LLM provider interfaces and task types
 */

// Provider types
export const ProviderTypeSchema = z.enum([
  'openrouter',
  'gemini',
  'ollama'
]);

export type ProviderType = z.infer<typeof ProviderTypeSchema>;

// Health status schema
export const HealthStatusSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  latency_ms: z.number().min(0),
  last_check: z.string(),
  error_rate: z.number().min(0).max(1),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;

// Provider capabilities schema
export const ProviderCapabilitiesSchema = z.object({
  supports_completion: z.boolean(),
  supports_chat: z.boolean(),
  supports_embedding: z.boolean(),
  max_tokens: z.number().min(1),
  models: z.array(z.string()),
  rate_limits: z.object({
    requests_per_minute: z.number().min(1),
    tokens_per_minute: z.number().min(1),
  }),
});

export type ProviderCapabilities = z.infer<typeof ProviderCapabilitiesSchema>;

// Task type schemas with generic constraints
export const CompletionTaskSchema = z.object({
  type: z.literal('completion'),
  prompt: z.string().min(1),
  max_tokens: z.number().min(1).max(8192).optional(),
  temperature: z.number().min(0).max(2).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
});

export type CompletionTask<T = unknown> = ZodValidated<z.infer<typeof CompletionTaskSchema> & T>;

export const ChatTaskSchema = z.object({
  type: z.literal('chat'),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string().min(1),
  })).min(1),
  max_tokens: z.number().min(1).max(8192).optional(),
  temperature: z.number().min(0).max(2).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
});

export type ChatTask<T = unknown> = ZodValidated<z.infer<typeof ChatTaskSchema> & T>;

export const EmbeddingTaskSchema = z.object({
  type: z.literal('embedding'),
  input: z.union([z.string(), z.array(z.string())]),
  model: z.string().optional(),
});

export type EmbeddingTask<T = unknown> = ZodValidated<z.infer<typeof EmbeddingTaskSchema> & T>;

// Union of all task types
export const TaskSchema = z.discriminatedUnion('type', [
  CompletionTaskSchema,
  ChatTaskSchema,
  EmbeddingTaskSchema,
]);

export type TaskType = z.infer<typeof TaskSchema>;

// Execution options schema
export const ExecutionOptionsSchema = z.object({
  timeout_ms: z.number().min(1000).default(30000),
  retry_attempts: z.number().min(0).max(5).default(3),
  retry_delay_ms: z.number().min(100).default(1000),
  provider_preference: z.array(ProviderTypeSchema).optional(),
  fallback_enabled: z.boolean().default(true),
  parallel_execution: z.boolean().default(false),
});

export type ExecutionOptions = z.infer<typeof ExecutionOptionsSchema>;

// Provider error schema with Python exception hierarchy
export const ProviderErrorSchema = z.object({
  type: z.enum([
    'connection_error',
    'authentication_error', 
    'rate_limit_error',
    'validation_error',
    'timeout_error',
    'server_error',
    'unknown_error'
  ]),
  message: z.string(),
  provider: ProviderTypeSchema,
  status_code: z.number().optional(),
  retry_after_ms: z.number().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type ProviderError = z.infer<typeof ProviderErrorSchema>;

// Result wrapper schema
export const ResultSchema = <T extends z.ZodSchema>(dataSchema: T) => z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    data: dataSchema,
    metadata: z.object({
      provider: ProviderTypeSchema,
      latency_ms: z.number().min(0),
      tokens_used: z.number().min(0).optional(),
      model_used: z.string().optional(),
    }),
  }),
  z.object({
    success: z.literal(false),
    error: ProviderErrorSchema,
  }),
]);

export type Result<T, E = ProviderError> = 
  | { success: true; data: T; metadata: { provider: ProviderType; latency_ms: number; tokens_used?: number; model_used?: string } }
  | { success: false; error: E };

// Provider configuration schemas
export const OpenRouterConfigSchema = z.object({
  api_key: z.string().min(1),
  base_url: z.string().url().default('https://openrouter.ai/api/v1'),
  default_model: z.string().default('deepseek/deepseek-r1:free'),
  headers: z.record(z.string(), z.string()).optional(),
});

export type OpenRouterConfig = z.infer<typeof OpenRouterConfigSchema>;

export const GeminiConfigSchema = z.object({
  api_key: z.string().min(1),
  base_url: z.string().url().default('https://generativelanguage.googleapis.com'),
  default_model: z.string().default('gemini-pro'),
  safety_settings: z.array(z.object({
    category: z.string(),
    threshold: z.string(),
  })).optional(),
});

export type GeminiConfig = z.infer<typeof GeminiConfigSchema>;

export const OllamaConfigSchema = z.object({
  base_url: z.string().url().default('http://localhost:11434'),
  default_model: z.string().default('llama2'),
  timeout_ms: z.number().min(1000).default(60000),
});

export type OllamaConfig = z.infer<typeof OllamaConfigSchema>;

// Circuit breaker configuration schema
export const CircuitBreakerConfigSchema = z.object({
  failure_threshold: z.number().min(1).default(5),
  recovery_timeout_ms: z.number().min(1000).default(60000),
  half_open_max_calls: z.number().min(1).default(3),
  fibonacci_backoff: z.boolean().default(true),
  max_backoff_ms: z.number().min(1000).default(30000),
});

export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfigSchema>;

// Validation functions with Python-style error messages
export function validateTask<T extends TaskType>(data: unknown): T {
  try {
    const result = TaskSchema.parse(data);
    return result as T;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const pythonStyleMessage = error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
      throw new Error(`ValueError: ${pythonStyleMessage}`);
    }
    throw error;
  }
}

export function validateExecutionOptions(data: unknown): ExecutionOptions {
  try {
    return ExecutionOptionsSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const pythonStyleMessage = error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
      throw new Error(`ValueError: ${pythonStyleMessage}`);
    }
    throw error;
  }
} 