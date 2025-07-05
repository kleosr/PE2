/**
 * OpenRouter client implementation
 * Provides access to multiple LLM providers through OpenRouter's unified API
 */

import type { LLMClient, LLMCompletionOptions, LLMResponse } from '../../lib/llm.js';

export interface OpenRouterClientOptions {
    apiKey: string;
    baseURL?: string;
    customHeaders?: Record<string, string>;
    httpReferer?: string;
    xTitle?: string;
}

/**
 * OpenRouter client that implements the LLMClient interface
 * Uses OpenAI-compatible API format
 */
export class OpenRouterClient implements LLMClient {
    private apiKey: string;
    private baseURL: string;
    private headers: Record<string, string>;

    constructor(options: OpenRouterClientOptions) {
        if (!options.apiKey || typeof options.apiKey !== 'string') {
            throw new Error('OpenRouter API key is required and must be a non-empty string');
        }

        this.apiKey = options.apiKey;
        this.baseURL = options.baseURL || 'https://openrouter.ai/api/v1';
        this.headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': options.httpReferer || 'https://pe2-cli-tool.local',
            'X-Title': options.xTitle || 'KleoSr PE2-CLI Tool',
            ...options.customHeaders
        };
    }

    public chat = {
        completions: {
            create: async (options: LLMCompletionOptions): Promise<LLMResponse> => {
                // Validate required parameters
                if (!options.model || typeof options.model !== 'string') {
                    throw new Error('OpenRouter model parameter is required and must be a string');
                }

                if (!options.messages || !Array.isArray(options.messages) || options.messages.length === 0) {
                    throw new Error('OpenRouter messages parameter is required and must be a non-empty array');
                }

                // Validate message format
                for (const message of options.messages) {
                    if (!message.role || !['system', 'user', 'assistant'].includes(message.role)) {
                        throw new Error(`Invalid message role: ${message.role}. Must be 'system', 'user', or 'assistant'`);
                    }
                    if (!message.content || typeof message.content !== 'string') {
                        throw new Error('Message content is required and must be a string');
                    }
                }

                // Prepare request body with OpenRouter-specific parameters
                const requestBody = {
                    model: options.model,
                    messages: options.messages,
                    max_tokens: options.max_tokens || 2048,
                    temperature: options.temperature !== undefined ? Math.max(0, Math.min(2, options.temperature)) : 0.7,
                    top_p: options.top_p !== undefined ? Math.max(0, Math.min(1, options.top_p)) : 1,
                    frequency_penalty: options.frequency_penalty !== undefined ? Math.max(-2, Math.min(2, options.frequency_penalty)) : 0,
                    presence_penalty: options.presence_penalty !== undefined ? Math.max(-2, Math.min(2, options.presence_penalty)) : 0,
                    stream: options.stream || false,
                    ...(options.stop && { stop: options.stop }),
                    ...(options.user && { user: options.user })
                };

                try {
                    const response = await fetch(`${this.baseURL}/chat/completions`, {
                        method: 'POST',
                        headers: this.headers,
                        body: JSON.stringify(requestBody)
                    });

                    if (!response.ok) {
                        await this.handleErrorResponse(response);
                    }

                    const data = await response.json();
                    
                    // Validate response format
                    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
                        throw new Error('Invalid response format from OpenRouter');
                    }

                    return {
                        choices: data.choices.map((choice: any) => ({
                            message: {
                                content: choice.message?.content || '',
                                role: 'assistant' as const
                            },
                            finish_reason: choice.finish_reason || 'stop'
                        })),
                        usage: data.usage || {
                            prompt_tokens: 0,
                            completion_tokens: 0,
                            total_tokens: 0
                        },
                        model: data.model || options.model,
                        id: data.id,
                        created: data.created
                    };
                } catch (error) {
                    if (error instanceof Error && error.message.includes('fetch')) {
                        throw new Error('OpenRouter network error. Please check your connection.');
                    }
                    throw error;
                }
            }
        }
    };

    /**
     * Handle error responses from OpenRouter API
     */
    private async handleErrorResponse(response: Response): Promise<never> {
        let errorMessage = 'OpenRouter API error';
        
        try {
            const errorData = await response.json();
            errorMessage = errorData.error?.message || errorData.message || errorMessage;
        } catch {
            // If we can't parse the error response, use the status text
            errorMessage = response.statusText || errorMessage;
        }

        switch (response.status) {
            case 401:
                throw new Error('OpenRouter authentication failed. Please check your API key.');
            case 429:
                const retryAfter = response.headers.get('retry-after');
                const rateLimitMessage = retryAfter 
                    ? `OpenRouter rate limit exceeded. Retry after ${retryAfter} seconds.`
                    : 'OpenRouter rate limit exceeded. Please try again later.';
                throw new Error(rateLimitMessage);
            case 400:
                throw new Error(`OpenRouter request error: ${errorMessage}`);
            case 404:
                throw new Error(`OpenRouter model not found. Please check the model name.`);
            case 402:
                throw new Error('OpenRouter insufficient credits. Please check your account balance.');
            case 403:
                throw new Error('OpenRouter access denied. Please check your API key permissions.');
            case 413:
                throw new Error('OpenRouter request too large. Please reduce the input size.');
            case 422:
                throw new Error(`OpenRouter validation error: ${errorMessage}`);
            case 500:
            case 502:
            case 503:
            case 504:
                throw new Error('OpenRouter server error. Please try again later.');
            default:
                throw new Error(`OpenRouter API error (${response.status}): ${errorMessage}`);
        }
    }

    /**
     * Get available models from OpenRouter
     */
    async getModels(): Promise<any[]> {
        try {
            const response = await fetch(`${this.baseURL}/models`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'HTTP-Referer': this.headers['HTTP-Referer'],
                    'X-Title': this.headers['X-Title']
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch models: ${response.statusText}`);
            }

            const data = await response.json();
            return data.data || [];
        } catch (error) {
            throw new Error(`Error fetching OpenRouter models: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get account information
     */
    async getAccount(): Promise<any> {
        try {
            const response = await fetch(`${this.baseURL}/auth/key`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'HTTP-Referer': this.headers['HTTP-Referer'],
                    'X-Title': this.headers['X-Title']
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch account info: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            throw new Error(`Error fetching OpenRouter account: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

/**
 * Factory function to create OpenRouter client
 */
export function createOpenRouterClient(options: OpenRouterClientOptions): OpenRouterClient {
    return new OpenRouterClient(options);
}

/**
 * Helper function for backward compatibility with existing code
 */
export function createOpenAICompatibleClient(apiKey: string, baseURL?: string): LLMClient {
    return new OpenRouterClient({
        apiKey,
        baseURL: baseURL || 'https://openrouter.ai/api/v1'
    });
}
