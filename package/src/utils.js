import chalk from 'chalk';
import cliProgress from 'cli-progress';
import clipboardy from 'clipboardy';
import Table from 'cli-table3';
import { highlight } from 'cli-highlight';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Session management
export class SessionManager {
    constructor() {
        this.sessionDir = path.join(os.homedir(), '.kleosr-pe2', 'sessions');
        this.currentSession = {
            id: Date.now(),
            prompts: [],
            timestamp: new Date(),
            model: null,
            provider: null,
            totalTokens: 0
        };
        this.ensureSessionDir();
    }

    ensureSessionDir() {
        if (!fs.existsSync(this.sessionDir)) {
            fs.mkdirSync(this.sessionDir, { recursive: true });
        }
    }

    addPrompt(prompt, result, complexity) {
        this.currentSession.prompts.push({
            timestamp: new Date(),
            prompt,
            result,
            complexity
        });
        this.save();
    }

    save() {
        const filename = `session-${this.currentSession.id}.json`;
        const filepath = path.join(this.sessionDir, filename);
        fs.writeFileSync(filepath, JSON.stringify(this.currentSession, null, 2));
    }

    loadHistory() {
        const files = fs.readdirSync(this.sessionDir);
        return files
            .filter(f => f.endsWith('.json'))
            .map(f => {
                const content = fs.readFileSync(path.join(this.sessionDir, f), 'utf-8');
                return JSON.parse(content);
            })
            .sort((a, b) => b.timestamp - a.timestamp);
    }
}

// Progress bar utility
export function createProgressBar() {
    return new cliProgress.SingleBar({
        format: ' {bar} | {percentage}% | {task}',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
        clearOnComplete: true,
        stopOnComplete: true,
        barsize: 30,
        forceRedraw: true,
        linewrap: null,
        fps: 10
    });
}

// Status bar
export function displayStatusBar(config) {
    const width = process.stdout.columns || 80;
    const status = config.apiKey ? '✓ Connected' : '✗ Not Connected';
    const provider = config.provider || 'Not Set';
    const model = config.model || 'Not Set';
    
    const statusText = ` Provider: ${provider} | Model: ${model} | Status: ${status} `;
    const padding = Math.max(0, width - statusText.length - 2);
    
    console.log(chalk.gray('┌' + '─'.repeat(width - 2) + '┐'));
    console.log(chalk.gray('│') + statusText + ' '.repeat(padding) + chalk.gray('│'));
    console.log(chalk.gray('└' + '─'.repeat(width - 2) + '┘'));
}

// Command suggestions
export const COMMANDS = {
    '/settings': 'Configure API provider, model, and key',
    '/config': 'View current settings',
    '/model': 'Quick model switch',
    '/clear': 'Clear screen',
    '/history': 'View recent prompts',
    '/export': 'Export session history',
    '/import': 'Import prompts from file',
    '/theme': 'Toggle between light/dark themes',
    '/help': 'Show all commands',
    '/batch': 'Process multiple prompts from file',
    '/copy': 'Copy last result to clipboard',
    '/clearall': 'Clear all saved prompts'
};

// Auto-complete for commands
export function getCommandSuggestions(input) {
    if (!input.startsWith('/')) return [];
    
    const partial = input.toLowerCase();
    return Object.keys(COMMANDS)
        .filter(cmd => cmd.startsWith(partial))
        .map(cmd => ({
            command: cmd,
            description: COMMANDS[cmd]
        }));
}

// Validate prompt
export function validatePrompt(prompt) {
    if (!prompt || prompt.trim().length === 0) {
        return 'Please enter a prompt';
    }
    if (prompt.length < 10) {
        return 'Prompt too short. Please provide more detail.';
    }
    if (prompt.length > 10000) {
        return 'Prompt too long. Consider breaking it down.';
    }
    return null;
}

// Format output based on user preference
export function formatOutput(data, format = 'markdown') {
    switch (format) {
        case 'json':
            return JSON.stringify(data, null, 2);
        case 'yaml':
            // Simple YAML formatter
            return Object.entries(data)
                .map(([key, value]) => `${key}: ${typeof value === 'object' ? '\n  ' + JSON.stringify(value, null, 2).replace(/\n/g, '\n  ') : value}`)
                .join('\n');
        case 'plain':
            return Object.entries(data)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n');
        default:
            return data; // Return as-is for markdown
    }
}

// Copy to clipboard with feedback
export async function copyToClipboard(text) {
    try {
        await clipboardy.write(text);
        console.log(chalk.green('✓ Copied to clipboard! Press Ctrl+V to paste.'));
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(chalk.red('✗ Clipboard utility not found on your system.'));
            console.log(chalk.yellow('  • Linux: install xclip or xsel  |  macOS: pbcopy/pbpaste are built-in  |  Windows: ensure clip.exe is accessible'));
        } else {
            console.log(chalk.red(`✗ Failed to copy to clipboard: ${error.message}`));
        }
        return false;
    }
}

// Display table
export function createTable(headers, rows) {
    const table = new Table({
        head: headers,
        style: {
            head: ['cyan'],
            border: ['gray']
        }
    });
    
    rows.forEach(row => table.push(row));
    return table.toString();
}

// Syntax highlighting for code blocks
export function highlightCode(code, language = 'javascript') {
    try {
        return highlight(code, { language });
    } catch (error) {
        return code; // Return unhighlighted if error
    }
}

// Theme management
export class ThemeManager {
    constructor() {
        this.themes = {
            dark: {
                primary: '#5BA3F5',
                secondary: '#FFD93D',
                success: '#50E3C2',
                error: '#FF6B6B',
                warning: '#FFD93D',
                info: '#B19CD9',
                text: '#FFFFFF',
                muted: '#808080'
            },
            light: {
                primary: '#0066CC',
                secondary: '#FF9500',
                success: '#00C853',
                error: '#D32F2F',
                warning: '#FF9500',
                info: '#7B68EE',
                text: '#000000',
                muted: '#666666'
            }
        };
        this.currentTheme = 'dark';
    }

    setTheme(theme) {
        if (this.themes[theme]) {
            this.currentTheme = theme;
            return true;
        }
        return false;
    }

    get colors() {
        return this.themes[this.currentTheme];
    }

    color(type) {
        return chalk.hex(this.colors[type]);
    }
}

// Statistics tracker
export class StatsTracker {
    constructor() {
        this.statsFile = path.join(os.homedir(), '.kleosr-pe2', 'stats.json');
        this.stats = this.load();
    }

    load() {
        if (fs.existsSync(this.statsFile)) {
            return JSON.parse(fs.readFileSync(this.statsFile, 'utf-8'));
        }
        return {
            totalPrompts: 0,
            totalTokens: 0,
            averageComplexity: 0,
            modelUsage: {},
            dailyUsage: {}
        };
    }

    save() {
        fs.writeFileSync(this.statsFile, JSON.stringify(this.stats, null, 2));
    }

    track(model, complexity, tokens = 0) {
        this.stats.totalPrompts++;
        this.stats.totalTokens += tokens;
        this.stats.averageComplexity = 
            (this.stats.averageComplexity * (this.stats.totalPrompts - 1) + complexity) / 
            this.stats.totalPrompts;
        
        // Track model usage
        this.stats.modelUsage[model] = (this.stats.modelUsage[model] || 0) + 1;
        
        // Track daily usage
        const today = new Date().toISOString().split('T')[0];
        this.stats.dailyUsage[today] = (this.stats.dailyUsage[today] || 0) + 1;
        
        this.save();
    }

    getStats() {
        return this.stats;
    }

    displayStats() {
        const table = new Table({
            head: ['Metric', 'Value'],
            colWidths: [30, 30]
        });

        table.push(
            ['Total Prompts', this.stats.totalPrompts],
            ['Total Tokens', this.stats.totalTokens],
            ['Average Complexity', this.stats.averageComplexity.toFixed(2)],
            ['Most Used Model', Object.entries(this.stats.modelUsage)
                .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A']
        );

        return table.toString();
    }
}

// Export all utilities
export default {
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
}; 