#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import readline from 'readline';
import inquirer from 'inquirer';
import os from 'os';
import {
    SessionManager,
    createProgressBar,
    displayStatusBar,
    COMMANDS,
    getCommandSuggestions,
    validatePrompt,
    formatOutput,
    copyToClipboard,
    createTable,
    highlightCode,
    ThemeManager,
    StatsTracker
} from './utils.js';
import { createOpenAIClient } from './providers/openai/client.js';
import { createAnthropicClient } from './providers/anthropic/client.js';
import { createGoogleClient } from './providers/google/client.js';
import { createOllamaClient } from './providers/ollama/client.js';
import { createOpenRouterClient } from './providers/openrouter/client.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration management
const CONFIG_DIR = path.join(os.homedir(), '.kleosr-pe2');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Initialize utilities
const sessionManager = new SessionManager();
const themeManager = new ThemeManager();
const statsTracker = new StatsTracker();

// Global state
let lastResult = null;

// Global flag to track if we're processing a prompt
let isProcessingPrompt = false;

// Add prompts directory constant
const PROMPTS_DIR = path.join(process.cwd(), 'pe2-prompts');

// === BEGIN: Remove agentic layer (rollback to v3.1.0) ===
// Stub replacements for removed agentic classes so rest of the code compiles
class ConversationMemoryStub {
  addEntry() {}
  getContext() { return { domain: 'general', history: [], avgComplexity: 0 }; }
}
class StrategySelectorStub {
  selectStrategy() { return { iterations: undefined, focus: 'generic', adaptiveFeatures: [] }; }
}
class MultiAgentEvaluatorStub {
  async evaluate() { return { scores: {}, overallScore: 0 }; }
}

// Replace original instances with stubs
const conversationMemory = new ConversationMemoryStub();
const strategySelector = new StrategySelectorStub();
const multiAgentEvaluator = new MultiAgentEvaluatorStub();
// === END: Remove agentic layer ===

// Clear console with cross-platform support
function clearConsole() {
    process.stdout.write(process.platform === 'win32' ? '\x1Bc' : '\x1B[2J\x1B[3J\x1B[H');
}

// Set terminal title
function setTerminalTitle(title) {
    process.stdout.write(`\x1b]0;${title}\x07`);
}

// Provider configurations
const PROVIDERS = {
    openai: {
        name: 'OpenAI',
        baseURL: 'https://api.openai.com/v1',
        models: [
            // GPT-4 family (latest and most capable)
            'gpt-4o',
            'gpt-4o-mini',
            'gpt-4-turbo',
            'gpt-4-turbo-2024-04-09',
            'gpt-4',
            'gpt-4-0613',
            'gpt-4-32k',
            'gpt-4-32k-0613',
            // GPT-3.5 family (cost-effective)
            'gpt-3.5-turbo',
            'gpt-3.5-turbo-0125',
            'gpt-3.5-turbo-1106',
            'gpt-3.5-turbo-16k',
            // o1 reasoning models
            'o1-preview',
            'o1-mini',
            // Legacy models (for compatibility)
            'gpt-4-1106-preview',
            'gpt-4-0125-preview'
        ],
        defaultModel: 'gpt-4o-mini',
        keyLabel: 'OpenAI API Key'
    },
    anthropic: {
        name: 'Anthropic (Claude)',
        baseURL: 'https://api.anthropic.com/v1',
        models: [
            // Claude 3.5 family (latest and most capable)
            'claude-3-5-sonnet-20241022',
            'claude-3-5-sonnet-20240620',
            'claude-3-5-haiku-20241022',
            // Claude 3 family
            'claude-3-opus-20240229',
            'claude-3-sonnet-20240229',
            'claude-3-haiku-20240307',
            // Legacy Claude models
            'claude-2.1',
            'claude-2.0',
            'claude-instant-1.2'
        ],
        defaultModel: 'claude-3-5-sonnet-20241022',
        keyLabel: 'Anthropic API Key'
    },
    google: {
        name: 'Google (Gemini)',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        models: [
            // Gemini 1.5 family (latest and most capable)
            'gemini-1.5-pro-latest',
            'gemini-1.5-pro',
            'gemini-1.5-pro-002',
            'gemini-1.5-flash-latest',
            'gemini-1.5-flash',
            'gemini-1.5-flash-002',
            'gemini-1.5-flash-8b-latest',
            'gemini-1.5-flash-8b',
            // Gemini 1.0 family
            'gemini-1.0-pro-latest',
            'gemini-1.0-pro',
            'gemini-1.0-pro-001',
            // Legacy models (for compatibility)
            'gemini-pro',
            'gemini-pro-vision'
        ],
        defaultModel: 'gemini-1.5-flash-latest',
        keyLabel: 'Google AI API Key'
    },
    openrouter: {
        name: 'OpenRouter (Multi-Provider)',
        baseURL: 'https://openrouter.ai/api/v1',
        models: [
            // OpenAI models via OpenRouter
            'openai/gpt-4o',
            'openai/gpt-4o-mini',
            'openai/gpt-4-turbo',
            'openai/gpt-4',
            'openai/gpt-3.5-turbo',
            'openai/o1-preview',
            'openai/o1-mini',
            // Anthropic models via OpenRouter
            'anthropic/claude-3-5-sonnet',
            'anthropic/claude-3-5-haiku',
            'anthropic/claude-3-opus',
            'anthropic/claude-3-sonnet',
            'anthropic/claude-3-haiku',
            // Google models via OpenRouter
            'google/gemini-1.5-pro-latest',
            'google/gemini-1.5-flash-latest',
            'google/gemini-pro',
            // Meta Llama models
            'meta-llama/llama-3.3-70b-instruct',
            'meta-llama/llama-3.2-90b-instruct',
            'meta-llama/llama-3.1-405b-instruct',
            'meta-llama/llama-3.1-70b-instruct',
            'meta-llama/llama-3.1-8b-instruct',
            'meta-llama/llama-3-70b-instruct',
            'meta-llama/llama-3-8b-instruct',
            // Mistral models
            'mistralai/mistral-large',
            'mistralai/mistral-small',
            'mistralai/codestral',
            'mistralai/mistral-7b-instruct',
            'mistralai/mixtral-8x7b-instruct',
            'mistralai/mixtral-8x22b-instruct',
            // DeepSeek models
            'deepseek/deepseek-r1',
            'deepseek/deepseek-v3',
            'deepseek/deepseek-coder',
            // Qwen models
            'qwen/qwen-2.5-72b-instruct',
            'qwen/qwen-2.5-7b-instruct',
            // Other popular models
            'perplexity/llama-3.1-sonar-large-128k-online',
            'nvidia/llama-3.1-nemotron-70b-instruct'
        ],
        defaultModel: 'openai/gpt-4o-mini',
        keyLabel: 'OpenRouter API Key'
    },
    ollama: {
        name: 'Ollama (Local)',
        baseURL: 'http://localhost:11434',
        models: [
            // Popular Llama models
            'llama3.2',
            'llama3.1',
            'llama3',
            'llama2',
            // Mistral family
            'mistral',
            'mixtral',
            'mistral-nemo',
            // Code-specific models
            'codellama',
            'deepseek-coder',
            'starcoder2',
            // Lightweight models
            'phi3',
            'phi3.5',
            'gemma2',
            'qwen2.5',
            // Specialized models
            'nomic-embed-text',
            'all-minilm',
            'custom'
        ],
        defaultModel: 'llama3.2',
        keyLabel: 'Ollama Base URL'
    }
};

function ensureConfigDir() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

function loadConfig() {
    ensureConfigDir();
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const configData = fs.readFileSync(CONFIG_FILE, 'utf-8');
            return JSON.parse(configData);
        } catch (error) {
            console.log(chalk.yellow('Warning: Could not load config file, using defaults.'));
            return {};
        }
    }
    return {};
}

function saveConfig(config) {
    ensureConfigDir();
    try {
        // Ensure sensitive data is stored with user-only permissions (0600)
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
        // In case file existed previously with broader permissions
        fs.chmodSync(CONFIG_FILE, 0o600);
        return true;
    } catch (error) {
        console.log(chalk.red(`❌ Error saving config: ${error.message}`));
        return false;
    }
}

function getDefaultConfig() {
    return {
        apiKey: null,
        model: 'openai/gpt-4o-mini',
        provider: 'openrouter'
    };
}

// New banner rendering for Gemini-style CLI
function renderAnsiShadowFiglet(text) {
    // Render figlet text in ANSI Shadow font, white with black shadow
    const figletText = figlet.textSync(text, { font: 'ANSI Shadow' });
    // ANSI Shadow already includes shadow, so just color the text white
    return chalk.white(figletText);
}

function displayBanner() {
    setTerminalTitle('KleoSr PE2-CLI');
    clearConsole();
    console.log(renderAnsiShadowFiglet('KLEOSR PE2'));
    console.log();
    displayStatusBar(loadConfig());
    console.log();
    console.log('Commands:');
    console.log('  /settings    Configure API provider, model, and key');
    console.log('  /config      View current settings');
    console.log('  /model       Quick model switch');
    console.log('  /help        Show all commands');
    console.log();
    console.log('Type your prompt or use a command to begin.');
    console.log();
}

function displayInteractiveBanner() {
    setTerminalTitle('KleoSr PE2-CLI - Interactive Mode');
    clearConsole();
    console.log(renderAnsiShadowFiglet('KLEOSR PE2'));
    console.log();
    displayStatusBar(loadConfig());
    console.log();
    console.log('Commands:');
    console.log('  /settings    Configure API provider, model, and key');
    console.log('  /config      View current settings');
    console.log('  /model       Quick model switch');
    console.log('  /help        Show all commands');
    console.log();
    console.log('Type your prompt or use a command to begin.');
    console.log();
}

const DIFFICULTY_INDICATORS = {
    "NOVICE": "🟢",
    "INTERMEDIATE": "🟡", 
    "ADVANCED": "🟠",
    "EXPERT": "🔴",
    "MASTER": "🟣"
};

// --- PE2 Meta-Prompts ---
const AGENTIC_INITIAL_PROMPT_TEMPLATE = (rawPrompt, context = {}) => {
    const strategy = strategySelector.selectStrategy(context);
    const domainGuidance = strategy.template;
    const adaptiveFeatures = strategy.adaptiveFeatures.join(', ') || 'standard_optimization';
    
    return `
You are an agentic prompt engineer with dynamic adaptation capabilities.

CONTEXT AWARENESS:
- Domain: ${context.domain || 'general'}
- Session history: ${context.sessionLength || 0} previous prompts
- Average complexity: ${context.avgComplexity || 'unknown'}
- Adaptive features: ${adaptiveFeatures}

STRATEGY GUIDANCE:
- Focus: ${strategy.focus}
- Approach: ${domainGuidance}

// Add detailed description guidance
DETAILED DESCRIPTION:
- Provide precise, domain-specific descriptions in the Context field
- Clarify expected output format and examples in the Output field

// Add context specification to reduce hallucinations
CONTEXT SPECIFICATION:
- Only reference information from the provided Raw prompt and context
- Do not hallucinate or assume facts not explicitly given

The PE2 format requires these sections with domain-specific adaptations:
- **Context**: ${context.domain === 'code' ? 'Include technical background and dependencies' : 'Provide comprehensive problem description'}
- **Role**: ${context.domain === 'creative' ? 'Creative expert with domain knowledge' : 'Specialized expert in the relevant field'}
- **Task**: ${context.domain === 'analytical' ? 'Step-by-step analytical framework' : 'Clear action items with expected outcomes'}
- **Constraints**: Domain-appropriate limitations and requirements
- **Output**: Expected format tailored to ${context.domain} tasks

Raw prompt to optimize:
---
${rawPrompt}
---

Generate a PE2-optimized prompt that:
1. Adapts to the ${context.domain} domain requirements
2. Maintains ${strategy.focus} as the primary objective
3. ${context.sessionLength > 3 ? 'Preserves conversation continuity' : 'Establishes clear context'}
4. Employs a step-by-step reasoning plan:
   a) Identify key facts and constraints
   b) Outline logical steps
   c) Draft the final JSON fields

CRITICAL: Return ONLY the JSON object with keys: "context", "role", "task", "constraints", "output".
DO NOT include any explanations or text outside the JSON.
`;
};

const AGENTIC_REFINEMENT_TEMPLATE = (currentPromptJson, refinementHistory, context = {}) => {
    const strategy = strategySelector.selectStrategy(context);
    
    // Add context specification and detailed description for refinement
    // CONTEXT SPECIFICATION:
    // - Use only the provided 'Current PE2 Prompt' and 'Refinement History' as source
    // - Do not introduce assumptions or hallucinations
    // DETAILED DESCRIPTION:
    // - Clearly articulate changes in the 'constraints' and 'output' fields

    return `
 You are an agentic prompt refinement specialist performing context-aware optimization.

 ADAPTIVE CONTEXT:
- Current domain: ${context.domain}
- Refinement iteration: ${refinementHistory.length + 1}
- Strategy focus: ${strategy.focus}
- Previous refinements show: ${refinementHistory.length > 2 ? 'iterative improvement needed' : 'initial optimization phase'}

Current PE2 Prompt:
${currentPromptJson}

Refinement History:
${Array.isArray(refinementHistory) ? refinementHistory.map(item => `- ${item.iteration}: ${item.edits}`).join('\n') : 'No previous refinements'}

DOMAIN-SPECIFIC ANALYSIS for ${context.domain}:
${context.domain === 'code' ? `
- Check for precise technical specifications
- Ensure error handling is addressed
- Verify input/output examples are included` : ''}
${context.domain === 'creative' ? `
- Ensure creative freedom is maintained
- Check for inspirational elements
- Verify constraints don't limit creativity` : ''}
${context.domain === 'analytical' ? `
- Verify logical structure is clear
- Check for comprehensive analysis steps
- Ensure evaluation criteria are defined` : ''}

Analyze and improve the prompt considering:
1. Is the ${strategy.focus} adequately emphasized?
2. Are domain-specific requirements met?
3. ${context.avgComplexity > 15 ? 'Is complex reasoning properly structured?' : 'Is the task clearly defined?'}
4. ${refinementHistory.length > 2 ? 'What patterns in previous refinements suggest further improvements?' : 'What initial optimizations are most critical?'}
5. Employ a structured reasoning sequence:
   a) Identify specific prompt weaknesses
   b) Outline logical refinement steps
   c) Apply refinements in the returned JSON

Provide exactly 5 targeted improvements, then output ONLY the refined JSON.

IMPORTANT: Your ENTIRE response after the 5 improvements must be ONLY the JSON object.
Example of correct response ending:
1. [improvement 1]
2. [improvement 2]
3. [improvement 3]
4. [improvement 4]
5. [improvement 5]

{
  "context": "...",
  "role": "...",
  "task": "...",
  "constraints": "...",
  "output": "..."
}
`;
};

// Replace the original templates
const INITIAL_PROMPT_TEMPLATE = (rawPrompt) => {
    const context = conversationMemory.getContext();
    return AGENTIC_INITIAL_PROMPT_TEMPLATE(rawPrompt, context);
};

const REFINEMENT_PROMPT_TEMPLATE = (currentPromptJson, refinementHistory) => {
    const context = conversationMemory.getContext();
    return AGENTIC_REFINEMENT_TEMPLATE(currentPromptJson, refinementHistory, context);
};

function analyzePromptComplexity(rawPrompt) {
    const promptLower = rawPrompt.toLowerCase();
    let score = 0;

    // 1. Length analysis
    const words = rawPrompt.split(/\s+/).length;
    if (words > 400) score += 4;
    else if (words > 250) score += 3;
    else if (words > 120) score += 2;
    else if (words > 60) score += 1;

    // 2. Technical keywords
    const techKeywords = [
        'algorithm','framework','architecture','microservice','database','api','sdk','ml','ai',
        'neural','blockchain','docker','kubernetes','encryption','protocol','latency','throughput',
        'concurrency','distributed','cloud','python','javascript','java','c++','rust','go'
    ];
    const techHits = techKeywords.filter(kw => promptLower.includes(kw)).length;
    score += Math.min(techHits, 4);

    // 3. Domain keywords
    const domainKeywords = [
        'regulation','compliance','governance','strategy','analytics','research','finance',
        'biotech','healthcare','supply chain','marketing','production','enterprise'
    ];
    const domainHits = domainKeywords.filter(kw => promptLower.includes(kw)).length;
    score += Math.min(domainHits, 3);

    // 4. Structural cues
    const structuralPatterns = [/\n\s*\d+\./, /\n\s*\-/, /```/, /#/];
    const structuralHits = structuralPatterns.filter(pat => pat.test(rawPrompt)).length;
    score += Math.min(structuralHits, 4);

    // 5. Conditional words / logical connectors
    const logicWords = [' if ',' then ',' when ',' unless ',' until ','depending on','while '];
    const logicHits = logicWords.filter(w => promptLower.includes(w)).length;
    score += Math.min(logicHits, 3);

    // 6. Punctuation density & special tokens
    const specialChars = (rawPrompt.match(/[;\{\[]/g) || []).length;
    if (specialChars >= 5) score += 2;
    else if (specialChars >= 2) score += 1;

    // Map score to difficulty & iterations
    let difficulty, iterations;
    if (score <= 4) {
        difficulty = "NOVICE";
        iterations = 1;
    } else if (score <= 8) {
        difficulty = "INTERMEDIATE";
        iterations = 2;
    } else if (score <= 12) {
        difficulty = "ADVANCED";
        iterations = 3;
    } else if (score <= 16) {
        difficulty = "EXPERT";
        iterations = 4;
    } else {
        difficulty = "MASTER";
        iterations = 5;
    }

    return { difficulty, iterations, score };
}

function displayComplexityAnalysis(difficulty, iterations, score, rawPrompt) {
    const indicator = DIFFICULTY_INDICATORS[difficulty];
    
    console.log(chalk.blue('\n🔍 PROMPT COMPLEXITY ANALYSIS'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.white(`📊 Complexity Score: ${score}/20`));
    console.log(chalk.white(`🎚️  Difficulty Level: ${indicator} ${difficulty}`));
    console.log(chalk.white(`🔄 Recommended Iterations: ${iterations}`));
    console.log(chalk.white(`📝 Word Count: ${rawPrompt.split(/\s+/).length} words`));
    console.log(chalk.gray('─'.repeat(50)));
    
    const explanations = {
        "NOVICE": "Simple, straightforward request with clear objectives",
        "INTERMEDIATE": "Moderate complexity with some technical requirements", 
        "ADVANCED": "Complex task requiring domain expertise and multiple steps",
        "EXPERT": "Highly technical with intricate requirements and constraints",
        "MASTER": "Extremely complex, multi-domain, enterprise-level requirements"
    };
    
    console.log(chalk.yellow(`💡 Analysis: ${explanations[difficulty]}`));
    console.log();
}

function getOpenRouterClient(apiKey) {
    return createOpenAIClient(apiKey, 'https://openrouter.ai/api/v1');
}

function getProviderClient(provider, apiKey) {
    switch (provider) {
        case 'openai':
            return createOpenAIClient(apiKey, PROVIDERS.openai.baseURL);
        case 'openrouter':
            return createOpenRouterClient({ apiKey, baseURL: PROVIDERS.openrouter.baseURL });
        case 'anthropic':
            return createAnthropicClient(apiKey);
        case 'google':
            return createGoogleClient(apiKey);
        case 'ollama':
            // For Ollama the apiKey parameter is actually the base URL; fall back to default if empty
            return createOllamaClient(apiKey || PROVIDERS.ollama.baseURL);
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }
}

async function promptForConfig(rl) {
    console.log(chalk.hex('#FFD93D')('\n🔧 Configuration Setup'));
    console.log(chalk.hex('#B19CD9')('Let\'s configure your AI provider and API settings.\n'));
    
    try {
        // Provider selection
        const { provider } = await inquirer.prompt([
            {
                type: 'list',
                name: 'provider',
                message: 'Select your AI provider:',
                choices: [
                    { name: `${PROVIDERS.openai.name} - Direct OpenAI API`, value: 'openai' },
                    { name: `${PROVIDERS.anthropic.name} - Direct Anthropic API`, value: 'anthropic' },
                    { name: `${PROVIDERS.google.name} - Direct Google AI API`, value: 'google' },
                    { name: `${PROVIDERS.openrouter.name} - Access multiple providers`, value: 'openrouter' },
                    { name: `${PROVIDERS.ollama.name} - Local Ollama`, value: 'ollama' }
                ],
                default: 'openrouter'
            }
        ]);

        const providerConfig = PROVIDERS[provider];
        
        // === Provider-specific connection details ===
        let apiKey = '';
        if (provider === 'ollama') {
            const { baseURL } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'baseURL',
                    message: 'Enter your Ollama base URL (press Enter for default):',
                    default: providerConfig.baseURL
                }
            ]);
            apiKey = baseURL.trim();
        } else {
            const resp = await inquirer.prompt([
                {
                    type: 'password',
                    name: 'apiKey',
                    message: `Enter your ${providerConfig.keyLabel}:`,
                    mask: '*',
                    validate: (input) => {
                        if (!input.trim()) {
                            return 'API key is required';
                        }
                        return true;
                    }
                }
            ]);
            apiKey = resp.apiKey.trim();
        }
    
    // Model selection
        const { model } = await inquirer.prompt([
            {
                type: 'list',
                name: 'model',
                message: 'Select a model:',
                choices: [
                    ...providerConfig.models.map(model => ({
                        name: model === providerConfig.defaultModel ? `${model} (recommended)` : model,
                        value: model
                    })),
                    { name: '📝 Enter Custom Model', value: 'custom' }
                ],
                default: providerConfig.defaultModel
            }
        ]);

        let finalModel = model;
        if (model === 'custom') {
            const { customModel } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'customModel',
                    message: 'Enter custom model name:',
                    validate: (input) => {
                        if (!input.trim()) {
                            return 'Model name is required';
                        }
                        return true;
                    }
                }
            ]);
            finalModel = customModel.trim();
        }

        const config = {
            provider,
            apiKey,
            model: finalModel
        };
    
    if (saveConfig(config)) {
        console.log(chalk.hex('#50E3C2')(`\n✅ Configuration saved!`));
            console.log(chalk.hex('#B19CD9')(`🌐 Provider: ${providerConfig.name}`));
        console.log(chalk.hex('#B19CD9')(`📝 Model: ${config.model}`));
        console.log(chalk.hex('#B19CD9')(`🔑 API Key: ${config.apiKey.substring(0, 8)}...`));
        console.log(chalk.hex('#B19CD9')(`📁 Config saved to: ${CONFIG_FILE}\n`));
            return config;
    } else {
        console.log(chalk.red('❌ Failed to save configuration.'));
        return null;
    }
    } catch (error) {
        if (error.isTtyError) {
            console.log(chalk.red('❌ Interactive prompts are not supported in this environment.'));
            console.log(chalk.yellow('Please run this in a proper terminal.'));
        } else {
            console.log(chalk.red(`❌ Configuration error: ${error.message}`));
        }
        return null;
    }
}

async function generateInitialPrompt(client, rawPrompt, model) {
    console.log(chalk.cyan("🚀 Generating initial PE2 prompt..."));
    try {
        const response = await client.chat.completions.create({
            model: model,
            messages: [
                {
                    role: "system",
                    content: INITIAL_PROMPT_TEMPLATE(rawPrompt),
                },
            ],
            headers: {
                "HTTP-Referer": "https://pe2-cli-tool.local",
                "X-Title": "KleoSr PE2-CLI Tool",
            },
        });

        const content = response.choices[0].message.content;
        
        // Debug logging
        if (process.env.DEBUG) {
            console.log(chalk.gray('Raw response content:'));
            console.log(chalk.gray(content.substring(0, 500) + '...'));
        }
        
        // Clean up the content to extract valid JSON
        try {
            // Try to parse as-is first
            return { prompt: JSON.parse(content), edits: "Initial prompt generation." };
        } catch (jsonError) {
            // If that fails, try to extract JSON from the content
            // Robust brace extraction: take substring from first '{' to matching last '}'
            const firstBrace = content.indexOf('{');
            const lastBrace = content.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                try {
                    let jsonStr = content.slice(firstBrace, lastBrace + 1);
                    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
                    const parsed = JSON.parse(jsonStr);
                    
                    // Validate that all required fields are present
                    const requiredFields = ['context', 'role', 'task', 'constraints', 'output'];
                    const hasAllFields = requiredFields.every(field => parsed.hasOwnProperty(field));
                    
                    if (hasAllFields) {
                        return { prompt: parsed, edits: "Initial prompt generation." };
                    } else {
                        // If fields are missing, try to construct them
                        const validPrompt = {
                            context: parsed.context || "No context provided",
                            role: parsed.role || "Expert assistant",
                            task: parsed.task || "Complete the requested task",
                            constraints: parsed.constraints || "Follow best practices",
                            output: parsed.output || "Provide appropriate output"
                        };
                        return { prompt: validPrompt, edits: "Initial prompt generation with field validation." };
                    }
                } catch (parseError) {
                    console.log(chalk.yellow(`Warning: JSON extraction failed: ${parseError.message}`));
                }
            }
            
            // If all else fails, try to extract individual fields
            const extractField = (fieldName) => {
                const patterns = [
                    new RegExp(`"${fieldName}"\\s*:\\s*"([^"]*)"`, 'i'),
                    new RegExp(`'${fieldName}'\\s*:\\s*'([^']*)'`, 'i'),
                    new RegExp(`${fieldName}\\s*:\\s*"([^"]*)"`, 'i'),
                    new RegExp(`\\*\\*${fieldName}\\*\\*:?\\s*([^\\n\\*]+)`, 'i'),
                    new RegExp(`${fieldName}:?\\s*([^\\n]+)`, 'i')
                ];
                
                for (const pattern of patterns) {
                    const match = content.match(pattern);
                    if (match && match[1]) {
                        return match[1].trim();
                    }
                }
                return null;
            };
            
            // Try to construct prompt from extracted fields
            const context = extractField('context');
            const role = extractField('role');
            const task = extractField('task');
            const constraints = extractField('constraints');
            const output = extractField('output');
            
            if (context || role || task) {
                return {
                    prompt: {
                        context: context || "Context based on: " + rawPrompt.substring(0, 200) + "...",
                        role: role || "Expert assistant specialized in the given domain",
                        task: task || "Complete the task as described in the user's prompt",
                        constraints: constraints || "Ensure accuracy, clarity, and adherence to best practices",
                        output: output || "Deliver a comprehensive and well-structured response"
                    },
                    edits: "Initial prompt generation with field extraction fallback."
                };
            }
            
            // Ultimate fallback - create a basic structure
            return {
                prompt: {
                    context: `The user wants to: ${rawPrompt.substring(0, 500)}${rawPrompt.length > 500 ? '...' : ''}`,
                    role: "Expert assistant with deep knowledge in the relevant domain",
                    task: "1. Understand the user's requirements\n2. Provide a comprehensive solution\n3. Ensure clarity and completeness",
                    constraints: "- Be accurate and thorough\n- Follow best practices\n- Provide clear explanations",
                    output: "A well-structured response that fully addresses the user's needs"
                },
                edits: "Initial prompt generation with automatic structuring."
            };
        }
    } catch (error) {
        console.log(chalk.red(`❌ Error during initial prompt generation: ${error.message}`));
        return { prompt: null, edits: null };
    }
}

async function refinePrompt(client, currentPromptJson, refinementHistory, model, iterationNum) {
    console.log(chalk.cyan(`🔄 Refining prompt (Iteration ${iterationNum})...`));
    try {
        const systemPrompt = REFINEMENT_PROMPT_TEMPLATE(
            currentPromptJson,
            refinementHistory
        );
        
        const response = await client.chat.completions.create({
            model: model,
            messages: [
                {
                    role: "system",
                    content: systemPrompt,
                },
            ],
            headers: {
                "HTTP-Referer": "https://pe2-cli-tool.local",
                "X-Title": "KleoSr PE2-CLI Tool",
            },
        });

        const content = response.choices[0].message.content;
        
        try {
            // Try to parse as-is first
            const refinedPromptJson = JSON.parse(content);
            const editsSummary = `Refined prompt based on PE2 principles (Iteration ${iterationNum}).`;
            return { prompt: refinedPromptJson, edits: editsSummary };
        } catch (jsonError) {
            // If that fails, try to extract JSON from the content
            // Robust brace extraction: take substring from first '{' to matching last '}'
            const firstBrace = content.indexOf('{');
            const lastBrace = content.lastIndexOf('}');
            
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                try {
                    let jsonStr = content.slice(firstBrace, lastBrace + 1);
                    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
                    const parsed = JSON.parse(jsonStr);
                    
                    // Validate that all required fields are present
                    const requiredFields = ['context', 'role', 'task', 'constraints', 'output'];
                    const hasAllFields = requiredFields.every(field => parsed.hasOwnProperty(field));
                    
                    if (hasAllFields) {
                        return { prompt: parsed, edits: "Refined prompt generation." };
                    } else {
                        // If fields are missing, try to construct them
                        const validPrompt = {
                            context: parsed.context || "No context provided",
                            role: parsed.role || "Expert assistant",
                            task: parsed.task || "Complete the requested task",
                            constraints: parsed.constraints || "Follow best practices",
                            output: parsed.output || "Provide appropriate output"
                        };
                        return { prompt: validPrompt, edits: "Refined prompt generation with field validation." };
                    }
                } catch (parseError) {
                    console.log(chalk.yellow(`Warning: JSON extraction failed: ${parseError.message}`));
                }
            }
            
            // If no valid JSON, return null
            console.log(chalk.yellow(`Warning: Could not parse refinement JSON, keeping current version`));
            return { prompt: null, edits: null };
        }
    } catch (error) {
        console.log(chalk.red(`❌ Error during prompt refinement: ${error.message}`));
        return { prompt: null, edits: null };
    }
}

function formatMarkdownOutput(pe2Prompt, history, metrics, difficulty, complexityScore) {
    const indicator = DIFFICULTY_INDICATORS[difficulty];
    
    const markdown = `
# PE²-Optimized Prompt ${indicator}

**Difficulty Level:** ${difficulty} | **Complexity Score:** ${complexityScore}/20 | **Generated:** ${new Date().toLocaleString()}

## Agentic Analysis
- **Domain Focus:** ${metrics.domain_focus || 'general'}
- **Adaptive Features:** ${metrics.adaptive_features || 'standard'}
- **Overall Quality:** ${metrics.overall_quality || 'N/A'}

### Quality Scores
${metrics.quality_scores ? Object.entries(metrics.quality_scores)
    .map(([key, value]) => `- **${key.charAt(0).toUpperCase() + key.slice(1)}:** ${value.toFixed(1)}/10`)
    .join('\n') : '- Not available'}

## Context
${pe2Prompt.context || 'N/A'}

## Role
${pe2Prompt.role || 'N/A'}

## Task
${pe2Prompt.task || 'N/A'}

## Constraints
${pe2Prompt.constraints || 'N/A'}

## Output
${pe2Prompt.output || 'N/A'}

---

# Refinement History
${history.map(item => `### Iteration ${item.iteration}\n- ${item.edits}\n`).join('\n')}

---

# Performance Metrics
- **Estimated Accuracy Gain**: ${metrics.accuracy_gain || 'N/A'}
- **Complexity Analysis**: ${difficulty} level prompt with ${complexityScore}/20 complexity score
- **Optimization Level**: ${history.length} iterations applied
- **Generated by**: KleoSr PE²-CLI v3.1 (Agentic Edition)

---

*Generated with ❤️ by KleoSr PE²-CLI - Adaptive Intelligence for Prompt Engineering*
`;
    return markdown;
}

async function handleCommand(command, rl, config) {
    switch (command) {
        case '/settings':
            setTerminalTitle('KleoSr PE2-CLI - Settings Configuration');
            config = await promptForConfig(rl);
            setTerminalTitle('KleoSr PE2-CLI - Interactive Mode');
            return config;
            
        case '/config':
            setTerminalTitle('KleoSr PE2-CLI - Current Configuration');
            console.log('\n' + themeManager.color('info')('Current Configuration:'));
            const configTable = createTable(
                ['Setting', 'Value'],
                [
                    ['Provider', config.provider || 'Not set'],
                    ['Model', config.model || 'Not set'],
                    ['API Key', config.apiKey ? config.apiKey.substring(0, 8) + '...' : 'Not set'],
                    ['Theme', themeManager.currentTheme]
                ]
            );
            console.log(configTable);
            setTerminalTitle('KleoSr PE2-CLI - Interactive Mode');
            break;
            
        case '/model':
            // Clear any potential lingering output
            process.stdout.write('\r\x1b[K');
            setTerminalTitle('KleoSr PE2-CLI - Model Selection');
            const { quickModel } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'quickModel',
                    message: 'Enter model name (or press Enter to select from list):',
                }
            ]);
            
            if (quickModel.trim()) {
                config.model = quickModel.trim();
                saveConfig(config);
                console.log(themeManager.color('success')(`✓ Model changed to: ${config.model}`));
            } else {
                // Show model selection
                const providerConfig = PROVIDERS[config.provider];
                if (providerConfig) {
                    const { selectedModel } = await inquirer.prompt([
                        {
                            type: 'list',
                            name: 'selectedModel',
                            message: 'Select a model:',
                            choices: [
                                ...providerConfig.models.map(m => ({ name: m, value: m })),
                                { name: '📝 Enter Custom Model', value: 'custom' }
                            ]
                        }
                    ]);
                    
                    if (selectedModel === 'custom') {
                        const { customModel } = await inquirer.prompt([
                            {
                                type: 'input',
                                name: 'customModel',
                                message: 'Enter custom model name:',
                                validate: (input) => input.trim() ? true : 'Model name required'
                            }
                        ]);
                        config.model = customModel.trim();
                    } else {
                        config.model = selectedModel;
                    }
                    
                    saveConfig(config);
                    console.log(themeManager.color('success')(`✓ Model changed to: ${config.model}`));
                }
            }
            setTerminalTitle('KleoSr PE2-CLI - Interactive Mode');
            return config;
            
        case '/clear':
            clearConsole();
            displayInteractiveBanner();
            break;
            
        case '/history':
            const sessions = sessionManager.loadHistory();
            if (sessions.length === 0) {
                console.log(themeManager.color('warning')('No history found.'));
            } else {
                console.log('\n' + themeManager.color('info')('Recent Sessions:'));
                sessions.slice(0, 5).forEach((session, idx) => {
                    console.log(`\n${idx + 1}. Session ${session.id} - ${new Date(session.timestamp).toLocaleString()}`);
                    console.log(`   Prompts: ${session.prompts.length}`);
                });
            }
            break;
            
        case '/export':
            const exportPath = path.join(process.cwd(), `pe2-export-${Date.now()}.json`);
            fs.writeFileSync(exportPath, JSON.stringify(sessionManager.currentSession, null, 2));
            console.log(themeManager.color('success')(`✓ Session exported to: ${exportPath}`));
            break;
            
        case '/import':
            const { importPath } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'importPath',
                    message: 'Enter file path to import:',
                    validate: (input) => {
                        if (!input.trim()) return 'Path required';
                        if (!fs.existsSync(input)) return 'File not found';
                        return true;
                    }
                }
            ]);
            
            try {
                const content = fs.readFileSync(importPath, 'utf-8');
                console.log(themeManager.color('success')('✓ File imported successfully'));
                return content;
            } catch (error) {
                console.log(themeManager.color('error')(`✗ Import failed: ${error.message}`));
            }
            break;
            
        case '/theme':
            const newTheme = themeManager.currentTheme === 'dark' ? 'light' : 'dark';
            themeManager.setTheme(newTheme);
            console.log(themeManager.color('success')(`✓ Theme changed to: ${newTheme}`));
            return config;
            
        case '/batch':
            const { batchPath } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'batchPath',
                    message: 'Enter file path containing prompts (one per line):',
                    validate: (input) => {
                        if (!input.trim()) return 'Path required';
                        if (!fs.existsSync(input)) return 'File not found';
                        return true;
                    }
                }
            ]);
            
            try {
                const prompts = fs.readFileSync(batchPath, 'utf-8').split('\n').filter(p => p.trim());
                console.log(themeManager.color('info')(`Found ${prompts.length} prompts to process.`));
                return { batch: prompts };
            } catch (error) {
                console.log(themeManager.color('error')(`✗ Batch load failed: ${error.message}`));
            }
            break;
            
        case '/copy':
            if (lastResult) {
                await copyToClipboard(lastResult);
            } else {
                console.log(themeManager.color('warning')('No result to copy.'));
            }
            break;

        case '/clearall':
            if (fs.existsSync(PROMPTS_DIR)) {
                fs.readdirSync(PROMPTS_DIR).forEach(f => {
                    fs.unlinkSync(path.join(PROMPTS_DIR, f));
                });
                console.log(themeManager.color('success')('✓ All saved prompts cleared.'));
            } else {
                console.log(themeManager.color('warning')('No prompts folder to clear.'));
            }
            break;
            
        case '/help':
        default:
            console.log('\n' + themeManager.color('info')('Available Commands:'));
            const helpTable = createTable(
                ['Command', 'Description'],
                Object.entries(COMMANDS).map(([cmd, desc]) => [cmd, desc])
            );
            console.log(helpTable);
            break;
    }
    
    return config;
}

async function interactiveMode(initialInput = null, cliOptions = {}) {
    displayInteractiveBanner();
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.hex('#4A90E2')('> ')
    });

    // Load or create configuration
    let config = { ...getDefaultConfig(), ...loadConfig() };
    
    if (!config.apiKey) {
        console.log(themeManager.color('warning')('⚠️  First time setup required.'));
        console.log(themeManager.color('muted')('Please configure your API provider and key to continue.\n'));
        config = await promptForConfig(rl);
        if (!config || !config.apiKey) {
            console.log(themeManager.color('error')('\n✗ Configuration cancelled or incomplete.'));
            rl.close();
            return;
        }
    }

    // Initialize client with error handling
    let client;
    try {
        const apiKeyInitial = resolveApiKey(config.provider, config.apiKey);
        client = config.provider ? getProviderClient(config.provider, apiKeyInitial) : getOpenRouterClient(apiKeyInitial);
    } catch (error) {
        console.log(themeManager.color('error')(`\n✗ Failed to initialize API client: ${error.message}`));
        console.log(themeManager.color('muted')('Please check your configuration with /settings'));
        rl.close();
        return;
    }
    
    let sessionCounter = 1;

    // If a prompt was supplied on the command line, handle it immediately.
    if (initialInput) {
        let rawPrompt = initialInput;
        let inputSource = 'direct text';

        // Detect file vs direct text (reuse earlier logic)
        if (!cliOptions.text && !cliOptions.file && fs.existsSync(initialInput)) {
            rawPrompt = fs.readFileSync(initialInput, 'utf-8').trim();
            inputSource = `file: ${initialInput}`;
        } else if (cliOptions.file) {
            if (fs.existsSync(initialInput)) {
                rawPrompt = fs.readFileSync(initialInput, 'utf-8').trim();
                inputSource = `file: ${initialInput}`;
            } else {
                console.log(themeManager.color('error')(`❌ Error: File not found at ${initialInput}`));
            }
        }

        if (rawPrompt) {
            console.log(themeManager.color('info')(`📝 Initial input: ${inputSource}`));
            const { difficulty, iterations: recIter, score: compScore } = analyzePromptComplexity(rawPrompt);
            displayComplexityAnalysis(difficulty, recIter, compScore, rawPrompt);

            if (!cliOptions.autoDifficulty) {
                await processPrompt(rawPrompt, client, config, sessionCounter++);
            }
        }
    }

    rl.prompt();

    rl.on('line', async (input) => {
        const trimmedInput = input.trim();
        
        // Handle empty input
        if (trimmedInput === '') {
            rl.prompt();
            return;
        }
        
        // Handle commands
        if (trimmedInput.startsWith('/')) {
            const command = trimmedInput.toLowerCase().split(' ')[0];
            
            // Special handling for exit
            if (command === '/exit' || command === '/quit') {
                console.log(themeManager.color('success')('\n✨ Thanks for using KleoSr PE2-CLI! Goodbye!'));
                rl.close();
                return;
            }
            
            // Clear any potential progress bar remnants
            process.stdout.write('\r\x1b[K');
            
            // Handle other commands
            const result = await handleCommand(command, rl, config);
            
            if (result && typeof result === 'object') {
                // Configuration was updated
                config = { ...config, ...result };
                if (result.provider || result.apiKey) {
                    const newApiKey = resolveApiKey(config.provider, config.apiKey);
                    const newClient = config.provider ? getProviderClient(config.provider, newApiKey) : getOpenRouterClient(newApiKey);
                    client = newClient;
                }

                // Refresh UI banner with updated status line
                clearConsole();
                displayInteractiveBanner();
            }
            
            // Handle special returns (imported content or batch)
            if (typeof result === 'string') {
                await processPrompt(result, client, config, sessionCounter++);
            } else if (result && result.batch) {
                for (const prompt of result.batch) {
                    console.log(`\n${themeManager.color('info')('Processing prompt:')} ${prompt.substring(0, 50)}...`);
                    await processPrompt(prompt, client, config, sessionCounter++);
                }
            }
            
            rl.prompt();
            return;
        }
        
        // Old command handling for backward compatibility
        if (trimmedInput === 'exit' || trimmedInput === 'quit') {
            console.log(themeManager.color('success')('\n✨ Thanks for using KleoSr PE2-CLI! Goodbye!'));
            rl.close();
            return;
        }
        
        if (trimmedInput === 'help') {
            await handleCommand('/help', rl, config);
            rl.prompt();
            return;
        }
        
        if (trimmedInput === 'config') {
            await handleCommand('/settings', rl, config);
            rl.prompt();
            return;
        }
        
        if (trimmedInput === 'status') {
            await handleCommand('/config', rl, config);
            rl.prompt();
            return;
        }
        
        // Process as prompt
        await processPrompt(trimmedInput, client, config, sessionCounter++);
            rl.prompt();
    });

    rl.on('close', () => {
        console.log(chalk.hex('#50E3C2')('\n✨ Session ended. Have a great day!'));
        process.exit(0);
    });
}

async function processPrompt(prompt, client, config, sessionId) {
    let progressBar = null;
    isProcessingPrompt = true;
    
    try {
        setTerminalTitle(`KleoSr PE2-CLI - Processing Session ${sessionId}`);
        
        // Validate prompt
        const validationError = validatePrompt(prompt);
        if (validationError) {
            console.log(themeManager.color('error')(`✗ ${validationError}`));
            setTerminalTitle('KleoSr PE2-CLI - Interactive Mode');
            return;
        }

        // Get agentic context
        const context = conversationMemory.getContext();
        const strategy = strategySelector.selectStrategy(context);
        
        console.log(themeManager.color('info')(`\n⚡ Processing your prompt (Session ${sessionId})...`));
        console.log(themeManager.color('muted')(`Length: ${prompt.length} characters`));
        console.log(themeManager.color('muted')(`Domain: ${context.domain} | Strategy: ${strategy.focus}\n`));
        
        // Analyze prompt complexity with context awareness
        const { difficulty, iterations: baseIterations, score: complexityScore } = analyzePromptComplexity(prompt);
        
        // Use strategy-based iterations instead of base iterations
        const recommendedIterations = strategy.iterations || baseIterations;
        
        console.log(themeManager.color('info')('📊 Adaptive Analysis:'));
        console.log(`   Domain: ${context.domain}`);
        console.log(`   Difficulty: ${DIFFICULTY_INDICATORS[difficulty]} ${difficulty}`);
        console.log(`   Score: ${complexityScore}/20`);
        console.log(`   Iterations: ${recommendedIterations} (adapted for ${context.domain})`);
        if (strategy.adaptiveFeatures.length > 0) {
            console.log(`   Features: ${strategy.adaptiveFeatures.join(', ')}`);
        }
        console.log();
        
        // Create progress bar only for actual processing
        progressBar = createProgressBar();
        progressBar.start(100, 0, { task: 'Initializing agentic processing...' });
            
            const refinementHistory = [];
            
        // Initial Prompt Generation with context
        if (progressBar) {
            progressBar.update(30, { task: `Generating ${context.domain}-optimized PE² prompt...` });
        }
        const { prompt: currentPrompt, edits: initialEdits } = await generateInitialPrompt(client, prompt, config.model);
        
            if (!currentPrompt) {
            if (progressBar) {
                progressBar.stop();
                progressBar = null;
            }
            console.log(themeManager.color('error')("✗ Failed to generate initial prompt."));
                return;
            }

            refinementHistory.push({ iteration: 1, edits: initialEdits });
            let workingPrompt = currentPrompt;
        if (progressBar) {
            progressBar.update(50, { task: 'Initial prompt generated' });
        }

        // Adaptive Iterative Refinement
        const progressPerIteration = 40 / recommendedIterations;
            for (let i = 0; i < recommendedIterations; i++) {
                const iterationNum = i + 2;
            if (progressBar) {
                progressBar.update(50 + (i * progressPerIteration), { 
                    task: `Adaptive refinement (${iterationNum}/${recommendedIterations + 1}) for ${context.domain}...` 
                });
            }
            
                const currentPromptJson = JSON.stringify(workingPrompt, null, 2);
                const { prompt: refinedPrompt, edits } = await refinePrompt(
                    client, currentPromptJson, refinementHistory, config.model, iterationNum
                );

                if (!refinedPrompt) {
                console.log(themeManager.color('warning')(`\nRefinement ${iterationNum} failed, using previous version.`));
                    break;
                }

                workingPrompt = refinedPrompt;
                refinementHistory.push({ iteration: iterationNum, edits });
            }

        if (progressBar) {
            progressBar.update(90, { task: 'Finalizing agentic output...' });
        }

        // Multi-agent evaluation
        const evaluation = await multiAgentEvaluator.evaluate(workingPrompt, context);
        
        // Performance metrics with context awareness
            const performanceMetrics = {
            accuracy_gain: `Estimated ${20 + (complexityScore * 5)}% improvement based on ${difficulty} complexity and ${context.domain} domain optimization`,
            adaptive_features: strategy.adaptiveFeatures.join(', ') || 'standard optimization',
            domain_focus: strategy.focus,
            quality_scores: evaluation.scores,
            overall_quality: `${evaluation.overallScore.toFixed(1)}/10`
        };

        // Add to conversation memory
        conversationMemory.addEntry(prompt, workingPrompt, {
            complexityScore,
            difficulty,
            domain: context.domain,
            iterations: recommendedIterations
        });

            // Generate output filename in pe2-prompts folder
        if (!fs.existsSync(PROMPTS_DIR)) {
            fs.mkdirSync(PROMPTS_DIR, { recursive: true });
        }
        const outputFileName = `pe2-session-${sessionId}.md`;
        const outputFile = path.join(PROMPTS_DIR, outputFileName);
            
        // Generate markdown output
        const finalOutput = formatMarkdownOutput(
                workingPrompt, refinementHistory, performanceMetrics, difficulty, complexityScore
            );

        // Save to file
        fs.writeFileSync(outputFile, finalOutput, 'utf-8');
        
        // Save to session
        sessionManager.addPrompt(prompt, workingPrompt, complexityScore);
        
        // Track statistics
        statsTracker.track(config.model, complexityScore);
        
        // Store last result for copy command
        lastResult = typeof finalOutput === 'string' ? finalOutput : JSON.stringify(workingPrompt, null, 2);
        
        // Complete and stop progress bar
        if (progressBar) {
            progressBar.update(100, { task: 'Complete!' });
            progressBar.stop();
            progressBar = null;
        }
        
        console.log(themeManager.color('success')(`\n✓ PE²-optimized prompt saved to ${outputFile}`));
        console.log(themeManager.color('info')(`📊 ${context.domain} domain | ${difficulty} complexity | ${refinementHistory.length} iterations | ${complexityScore}/20 score`));
        console.log(themeManager.color('info')(`🎯 Strategy: ${strategy.focus} optimization\n`));
        
        // Show suggestion to copy
        console.log(themeManager.color('muted')('Tip: Use /copy to copy the result to clipboard'));
        
        // Reset title
        setTerminalTitle('KleoSr PE²-CLI - Interactive Mode');
        isProcessingPrompt = false;
        
    } catch (error) {
        // Ensure progress bar is stopped on error
        if (progressBar) {
            progressBar.stop();
            progressBar = null;
        }
        console.log(themeManager.color('error')(`✗ Error: ${error.message}\n`));
        setTerminalTitle('KleoSr PE²-CLI - Interactive Mode');
        isProcessingPrompt = false;
    }
}

async function main() {
    setTerminalTitle('KleoSr PE2-CLI');
    const program = new Command();
    program
        .name('pe2-cli')
        .description('🚀 KleoSr PE2-CLI: Convert raw prompts to PE2-optimized prompts using adaptive intelligence.')
        .version('3.3.7')
        .argument('[input]', 'Text prompt or path to file (optional - if not provided, starts interactive mode)')
        .option('--model <model>', 'OpenRouter model name (overrides config)')
        .option('--iterations <number>', 'Number of PE2 refinement rounds (auto-detected if not specified)', parseInt)
        .option('--output-file <file>', 'Path to the output markdown file', 'output.md')
        .option('--auto-difficulty', 'Show complexity analysis and exit without processing')
        .option('-i, --interactive', 'Start in interactive mode')
        .option('--config', 'Configure API key and model settings')
        .option('--text', 'Force input to be treated as text (not file path)')
        .option('--file', 'Force input to be treated as file path')
        .option('--provider <provider>', 'Override provider for this run (openai|anthropic|google|openrouter|ollama)')
        .configureHelp({
            afterAll: `
Examples:
  npx @kleosr/pe2-cli                              # Start interactive mode (auto-config)
  npx @kleosr/pe2-cli --config                     # Configure API key and model
  npx @kleosr/pe2-cli --interactive                # Start interactive mode
  npx @kleosr/pe2-cli "Write a Python function"    # Process text directly
  npx @kleosr/pe2-cli input.txt                    # Process file with saved config
  npx @kleosr/pe2-cli input.txt --model openai/gpt-4o  # Override model for this run
  npx @kleosr/pe2-cli "Complex prompt" --iterations 3  # Direct text with specific iterations
  npx @kleosr/pe2-cli "Test prompt" --auto-difficulty  # Show complexity analysis for text
  npx @kleosr/pe2-cli "Complex prompt" --provider ollama --model llama3  # Override provider for this run

Configuration:
  First run will prompt for API key and model selection.
  Settings are saved to ~/.kleosr-pe2/config.json
  Use --config to reconfigure anytime.

Input Methods:
  1. Direct text: npx @kleosr/pe2-cli "Your prompt here"
  2. File path: npx @kleosr/pe2-cli input.txt
  3. Interactive: npx @kleosr/pe2-cli (no arguments)
  4. Force text: --text flag treats input as text even if it looks like a file
  5. Force file: --file flag treats input as file path
            `
        });

    program.parse();
    const options = program.opts();
    const input = program.args[0];

    // Check if we should configure
    if (options.config) {
        setTerminalTitle('KleoSr PE2-CLI - Configuration');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        displayBanner();
        console.log(chalk.hex('#50E3C2')(`🔧 Configuration Mode | v3.3.7 | ${new Date().toLocaleString()}`));
        console.log(chalk.hex('#4A90E2')('='.repeat(78)));
        
        await promptForConfig(rl);
        rl.close();
        return;
    }

    // Always interactive: banner is rendered inside interactiveMode
    await interactiveMode(input, options);
    return;
}

// Map provider -> env var for automatic key resolution
const PROVIDER_ENV_VARS = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    ollama: 'OLLAMA_BASE_URL'
};

function resolveApiKey(provider, configApiKey) {
    if (configApiKey && configApiKey.trim()) return configApiKey;
    if (provider === 'ollama') {
        return process.env[PROVIDER_ENV_VARS.ollama] || null;
    }
    const envVar = PROVIDER_ENV_VARS[provider] || 'OPENROUTER_API_KEY';
    return process.env[envVar] || null;
}

main().catch(error => {
    console.error(chalk.red(`❌ Unexpected error: ${error.message}`));
    process.exit(1);
});