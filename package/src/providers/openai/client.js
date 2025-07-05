import OpenAI from 'openai';

/**
 * Enhanced OpenAI client wrapper with complete API support
 * Supports all chat completion parameters and proper error handling
 */
export function createOpenAIClient(apiKey, baseURL = 'https://api.openai.com/v1', customHeaders = {}) {
    const defaultHeaders = {
        'HTTP-Referer': 'https://pe2-cli-tool.local',
        'X-Title': 'KleoSr PE2-CLI Tool',
        ...customHeaders
    };

    const client = new OpenAI({
        apiKey,
        baseURL,
        defaultHeaders
    });

    // Validate API key format
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        throw new Error('OpenAI API key is required and must be a non-empty string');
    }

    // Enhanced chat completions with full parameter support
    const originalCreate = client.chat.completions.create.bind(client.chat.completions);
    
    client.chat.completions.create = async function(params) {
        // Validate required parameters
        if (!params.model || typeof params.model !== 'string') {
            throw new Error('OpenAI model parameter is required and must be a string');
        }
        
        if (!params.messages || !Array.isArray(params.messages) || params.messages.length === 0) {
            throw new Error('OpenAI messages parameter is required and must be a non-empty array');
        }

        // Validate message format
        for (const message of params.messages) {
            if (!message.role || !['system', 'user', 'assistant'].includes(message.role)) {
                throw new Error(`Invalid message role: ${message.role}. Must be 'system', 'user', or 'assistant'`);
            }
            if (!message.content || typeof message.content !== 'string') {
                throw new Error('Message content is required and must be a string');
            }
        }

        // Set reasonable defaults for optional parameters
        const enhancedParams = {
            model: params.model,
            messages: params.messages,
            max_tokens: params.max_tokens || 2048,
            temperature: params.temperature !== undefined ? Math.max(0, Math.min(2, params.temperature)) : 0.7,
            top_p: params.top_p !== undefined ? Math.max(0, Math.min(1, params.top_p)) : 1,
            frequency_penalty: params.frequency_penalty !== undefined ? Math.max(-2, Math.min(2, params.frequency_penalty)) : 0,
            presence_penalty: params.presence_penalty !== undefined ? Math.max(-2, Math.min(2, params.presence_penalty)) : 0,
            stream: params.stream || false,
            stop: params.stop || null,
            user: params.user || null,
            ...params.headers && { headers: params.headers }
        };

        try {
            return await originalCreate(enhancedParams);
        } catch (error) {
            // Enhanced error handling with specific OpenAI error types
            if (error.status === 401) {
                throw new Error('OpenAI authentication failed. Please check your API key.');
            } else if (error.status === 429) {
                throw new Error('OpenAI rate limit exceeded. Please try again later.');
            } else if (error.status === 400) {
                throw new Error(`OpenAI request error: ${error.message || 'Invalid request parameters'}`);
            } else if (error.status === 404) {
                throw new Error(`OpenAI model not found: ${params.model}. Please check the model name.`);
            } else if (error.status >= 500) {
                throw new Error('OpenAI server error. Please try again later.');
            } else {
                throw new Error(`OpenAI API error: ${error.message || 'Unknown error occurred'}`);
            }
        }
    };

    return client;
} 