/**
 * LLM client interface definitions and utilities
 * Provides abstractions for all supported LLM providers
 */

/**
 * LLM error types
 */
export class LLMError extends Error {
    constructor(message, provider, statusCode, originalError) {
        super(message);
        this.name = 'LLMError';
        this.provider = provider;
        this.statusCode = statusCode;
        this.originalError = originalError;
    }
}

export class LLMAuthenticationError extends LLMError {
    constructor(provider, originalError) {
        super(`Authentication failed for ${provider}`, provider, 401, originalError);
        this.name = 'LLMAuthenticationError';
    }
}

export class LLMRateLimitError extends LLMError {
    constructor(provider, retryAfter, originalError) {
        super(`Rate limit exceeded for ${provider}${retryAfter ? `, retry after ${retryAfter}s` : ''}`, provider, 429, originalError);
        this.name = 'LLMRateLimitError';
    }
}

export class LLMModelNotFoundError extends LLMError {
    constructor(provider, model, originalError) {
        super(`Model '${model}' not found for ${provider}`, provider, 404, originalError);
        this.name = 'LLMModelNotFoundError';
    }
}

export class LLMValidationError extends LLMError {
    constructor(provider, validationMessage, originalError) {
        super(`Validation error for ${provider}: ${validationMessage}`, provider, 400, originalError);
        this.name = 'LLMValidationError';
    }
}

/**
 * Utility functions for LLM operations
 */
export class LLMUtils {
    /**
     * Validate message format
     */
    static validateMessages(messages) {
        if (!Array.isArray(messages) || messages.length === 0) {
            throw new Error('Messages must be a non-empty array');
        }

        for (const message of messages) {
            if (!message.role || !['system', 'user', 'assistant'].includes(message.role)) {
                throw new Error(`Invalid message role: ${message.role}`);
            }
            if (!message.content || typeof message.content !== 'string') {
                throw new Error('Message content must be a non-empty string');
            }
        }
    }

    /**
     * Sanitize completion options
     */
    static sanitizeOptions(options) {
        const sanitized = { ...options };

        // Clamp temperature
        if (sanitized.temperature !== undefined) {
            sanitized.temperature = Math.max(0, Math.min(2, sanitized.temperature));
        }

        // Clamp top_p
        if (sanitized.top_p !== undefined) {
            sanitized.top_p = Math.max(0, Math.min(1, sanitized.top_p));
        }

        // Clamp penalties
        if (sanitized.frequency_penalty !== undefined) {
            sanitized.frequency_penalty = Math.max(-2, Math.min(2, sanitized.frequency_penalty));
        }
        if (sanitized.presence_penalty !== undefined) {
            sanitized.presence_penalty = Math.max(-2, Math.min(2, sanitized.presence_penalty));
        }

        // Ensure max_tokens is positive
        if (sanitized.max_tokens !== undefined) {
            sanitized.max_tokens = Math.max(1, sanitized.max_tokens);
        }

        return sanitized;
    }

    /**
     * Count tokens (approximate)
     */
    static estimateTokens(text) {
        // Rough estimation: ~4 characters per token for English text
        return Math.ceil(text.length / 4);
    }

    /**
     * Format error message from provider error
     */
    static formatProviderError(error, provider) {
        if (error.status === 401) return 'Authentication failed';
        if (error.status === 429) return 'Rate limit exceeded';
        if (error.status === 404) return 'Model not found';
        if (error.status === 400) return 'Invalid request';
        if (error.status >= 500) return 'Server error';
        return error.message || 'Unknown error';
    }
} 