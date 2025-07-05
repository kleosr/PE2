import { z } from 'zod';
import { ZodValidated } from '@/utils/python-adapter';

/**
 * Zod schemas for PE2 prompt structure with Python-equivalent validation
 */

// Difficulty levels matching Python enum
export const DifficultyLevelSchema = z.enum([
  'NOVICE',
  'INTERMEDIATE', 
  'ADVANCED',
  'EXPERT',
  'MASTER'
]);

export type DifficultyLevel = z.infer<typeof DifficultyLevelSchema>;

// Complexity factors schema matching Python analysis
export const ComplexityFactorsSchema = z.object({
  length_score: z.number().min(0).max(4),
  technical_keywords: z.number().min(0).max(4),
  domain_keywords: z.number().min(0).max(3),
  structural_cues: z.number().min(0).max(4),
  logical_connectors: z.number().min(0).max(3),
  punctuation_density: z.number().min(0).max(2),
});

export type ComplexityFactors = z.infer<typeof ComplexityFactorsSchema>;

// Complexity analysis result schema
export const ComplexityAnalysisSchema = z.object({
  difficulty: DifficultyLevelSchema,
  iterations: z.number().min(1).max(5),
  score: z.number().min(0).max(20),
  factors: ComplexityFactorsSchema,
  word_count: z.number().min(0),
  explanation: z.string(),
});

export type ComplexityAnalysis = ZodValidated<z.infer<typeof ComplexityAnalysisSchema>>;

// PE2 prompt structure schema
export const PE2PromptSchema = z.object({
  context: z.string().min(1, "Context cannot be empty"),
  role: z.string().min(1, "Role cannot be empty"),
  task: z.union([
    z.string().min(1, "Task cannot be empty"),
    z.array(z.string().min(1)).min(1, "Task array cannot be empty")
  ]),
  constraints: z.union([
    z.string().min(1, "Constraints cannot be empty"),
    z.array(z.string().min(1)).min(1, "Constraints array cannot be empty")
  ]),
  output: z.union([
    z.string().min(1, "Output cannot be empty"),
    z.record(z.string(), z.unknown()).refine(
      (obj) => Object.keys(obj).length > 0,
      "Output object cannot be empty"
    )
  ]),
});

export type PE2Prompt = ZodValidated<z.infer<typeof PE2PromptSchema>>;

// Refinement history schema
export const RefinementHistoryItemSchema = z.object({
  iteration: z.number().min(1),
  edits: z.string().min(1),
  timestamp: z.string().optional(),
});

export type RefinementHistoryItem = z.infer<typeof RefinementHistoryItemSchema>;

export const RefinementHistorySchema = z.array(RefinementHistoryItemSchema);

export type RefinementHistory = z.infer<typeof RefinementHistorySchema>;

// Performance metrics schema
export const PerformanceMetricsSchema = z.object({
  accuracy_gain: z.string(),
  complexity_analysis: z.string(),
  optimization_level: z.number().min(0),
  generated_by: z.string().default("KleoSr PE2-CLI v2.0"),
});

export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;

// Complete PE2 output schema
export const PE2OutputSchema = z.object({
  prompt: PE2PromptSchema,
  complexity: ComplexityAnalysisSchema,
  history: RefinementHistorySchema,
  metrics: PerformanceMetricsSchema,
  generated_at: z.string(),
});

export type PE2Output = ZodValidated<z.infer<typeof PE2OutputSchema>>;

// CLI arguments schema
export const CLIArgumentsSchema = z.object({
  input_file: z.string().min(1, "Input file path required"),
  model: z.string().default("deepseek/deepseek-r1:free"),
  iterations: z.number().min(1).max(5).optional(),
  output_file: z.string().default("output.md"),
  auto_difficulty: z.boolean().default(false),
  yes: z.boolean().default(false),
});

export type CLIArguments = ZodValidated<z.infer<typeof CLIArgumentsSchema>>;

// Validation functions with Python-style error messages
export function validatePE2Prompt(data: unknown): PE2Prompt {
  try {
    const result = PE2PromptSchema.parse(data);
    return result as PE2Prompt;
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

export function validateComplexityAnalysis(data: unknown): ComplexityAnalysis {
  try {
    const result = ComplexityAnalysisSchema.parse(data);
    return result as ComplexityAnalysis;
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

export function validateCLIArguments(data: unknown): CLIArguments {
  try {
    const result = CLIArgumentsSchema.parse(data);
    return result as CLIArguments;
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