import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Enhanced Google Gemini client wrapper with complete API support
 * Supports proper conversation handling, safety settings, and all Gemini parameters
 */
export function createGoogleClient(apiKey, customOptions = {}) {
    // Validate API key
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        throw new Error('Google API key is required and must be a non-empty string');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    return {
        chat: {
            completions: {
                /**
                 * Enhanced create method with full Gemini API support
                 * @param {{model:string, messages:Array<{role:string,content:string}>, max_tokens?:number, temperature?:number, top_p?:number, top_k?:number, stop_sequences?:Array<string>, safety_settings?:Array}} opts
                 */
                async create(opts) {
                    // Validate required parameters
                    if (!opts.model || typeof opts.model !== 'string') {
                        throw new Error('Google model parameter is required and must be a string');
                    }

                    if (!opts.messages || !Array.isArray(opts.messages) || opts.messages.length === 0) {
                        throw new Error('Google messages parameter is required and must be a non-empty array');
                    }

                    // Validate message format
                    for (const message of opts.messages) {
                        if (!message.role || !['system', 'user', 'assistant'].includes(message.role)) {
                            throw new Error(`Invalid message role: ${message.role}. Must be 'system', 'user', or 'assistant'`);
                        }
                        if (!message.content || typeof message.content !== 'string') {
                            throw new Error('Message content is required and must be a string');
                        }
                    }

                    // Separate system messages and conversation messages
                    const systemMessages = opts.messages.filter(m => m.role === 'system');
                    const conversationMessages = opts.messages.filter(m => m.role !== 'system');

                    // Convert to Gemini format - system instructions + chat history
                    let systemInstruction = null;
                    if (systemMessages.length > 0) {
                        systemInstruction = systemMessages.map(m => m.content).join('\n\n');
                    }

                    // Convert conversation to Gemini chat format
                    const history = [];
                    const contents = [];

                    for (let i = 0; i < conversationMessages.length; i++) {
                        const message = conversationMessages[i];
                        const role = message.role === 'assistant' ? 'model' : 'user';
                        
                        if (i === conversationMessages.length - 1) {
                            // Last message becomes the current input
                            contents.push({
                                role: role,
                                parts: [{ text: message.content }]
                            });
                        } else {
                            // Previous messages become history
                            history.push({
                                role: role,
                                parts: [{ text: message.content }]
                            });
                        }
                    }

                    // Set up generation config with validation
                    const generationConfig = {
                        maxOutputTokens: opts.max_tokens || 2048,
                        ...(opts.temperature !== undefined && { 
                            temperature: Math.max(0, Math.min(2, opts.temperature)) 
                        }),
                        ...(opts.top_p !== undefined && { 
                            topP: Math.max(0, Math.min(1, opts.top_p)) 
                        }),
                        ...(opts.top_k !== undefined && { 
                            topK: Math.max(1, Math.min(100, opts.top_k)) 
                        }),
                        ...(opts.stop_sequences && Array.isArray(opts.stop_sequences) && { 
                            stopSequences: opts.stop_sequences.slice(0, 5) // Max 5 stop sequences
                        })
                    };

                    // Default safety settings (can be overridden)
                    const defaultSafetySettings = [
                        {
                            category: 'HARM_CATEGORY_HARASSMENT',
                            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                        },
                        {
                            category: 'HARM_CATEGORY_HATE_SPEECH',
                            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                        },
                        {
                            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                        },
                        {
                            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                        }
                    ];

                    const safetySettings = opts.safety_settings || defaultSafetySettings;

                    try {
                        // Create model with configuration
                        const modelConfig = {
                            model: opts.model,
                            generationConfig,
                            safetySettings,
                            ...(systemInstruction && { systemInstruction })
                        };

                        const genModel = genAI.getGenerativeModel(modelConfig);

                        let result;
                        if (history.length > 0) {
                            // Use chat session for multi-turn conversations
                            const chat = genModel.startChat({ history });
                            result = await chat.sendMessage(contents[0].parts[0].text);
                        } else {
                            // Single turn generation
                            result = await genModel.generateContent(contents[0].parts[0].text);
                        }

                        // Extract text from response with proper error handling
                        let text = '';
                        let finishReason = 'stop';
                        
                        if (result?.response) {
                            const response = result.response;
                            
                            // Check for safety blocking
                            if (response.promptFeedback?.blockReason) {
                                throw new Error(`Google content blocked: ${response.promptFeedback.blockReason}`);
                            }

                            // Extract text content
                            if (typeof response.text === 'function') {
                                try {
                                    text = response.text();
                                } catch (error) {
                                    if (error.message.includes('SAFETY')) {
                                        throw new Error('Google content blocked due to safety filters');
                                    }
                                    throw error;
                                }
                            } else if (response.candidates?.length > 0) {
                                const candidate = response.candidates[0];
                                
                                if (candidate.finishReason === 'SAFETY') {
                                    throw new Error('Google content blocked due to safety filters');
                                }
                                
                                finishReason = candidate.finishReason?.toLowerCase() || 'stop';
                                
                                if (candidate.content?.parts) {
                                    text = candidate.content.parts
                                        .filter(part => part.text)
                                        .map(part => part.text)
                                        .join('');
                                }
                            }
                        }

                        return {
                            choices: [{
                                message: { 
                                    content: text,
                                    role: 'assistant'
                                },
                                finish_reason: finishReason
                            }],
                            usage: {
                                prompt_tokens: result?.response?.usageMetadata?.promptTokenCount || 0,
                                completion_tokens: result?.response?.usageMetadata?.candidatesTokenCount || 0,
                                total_tokens: result?.response?.usageMetadata?.totalTokenCount || 0
                            },
                            model: opts.model
                        };
                    } catch (error) {
                        // Enhanced error handling for Google-specific errors
                        if (error.message?.includes('API_KEY_INVALID')) {
                            throw new Error('Google authentication failed. Please check your API key.');
                        } else if (error.message?.includes('QUOTA_EXCEEDED')) {
                            throw new Error('Google quota exceeded. Please try again later.');
                        } else if (error.message?.includes('MODEL_NOT_FOUND')) {
                            throw new Error(`Google model not found: ${opts.model}. Please check the model name.`);
                        } else if (error.message?.includes('SAFETY') || error.message?.includes('blocked')) {
                            throw new Error('Google content blocked due to safety filters. Please modify your prompt.');
                        } else if (error.message?.includes('RATE_LIMIT')) {
                            throw new Error('Google rate limit exceeded. Please try again later.');
                        } else if (error.message?.includes('INVALID_ARGUMENT')) {
                            throw new Error(`Google invalid request: ${error.message}`);
                        } else if (error.status === 400) {
                            throw new Error(`Google request error: ${error.message || 'Invalid request parameters'}`);
                        } else if (error.status === 401) {
                            throw new Error('Google authentication failed. Please check your API key.');
                        } else if (error.status === 403) {
                            throw new Error('Google access denied. Please check your API key permissions.');
                        } else if (error.status === 429) {
                            throw new Error('Google rate limit exceeded. Please try again later.');
                        } else if (error.status >= 500) {
                            throw new Error('Google server error. Please try again later.');
                        } else {
                            throw new Error(`Google API error: ${error.message || 'Unknown error occurred'}`);
                        }
                    }
                }
            }
        }
    };
} 