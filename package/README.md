# KleoSr PE²-CLI — Adaptive Intelligence for Prompt Engineering

![PE2-CLI Screenshot](https://i.ibb.co/995W1820/image.png)

Transform raw prompts into **PE²-optimised** prompts that maximise LLM performance using adaptive intelligence and automated complexity analysis.

| Requirement | Version |
|-------------|---------|
| Node.js     | ≥ 18    |
| npm         | latest  |
| License     | MIT     |

---

## What is PE²?

**PE² (Prompt Engineering 2.0)** structures a prompt into five key sections:

1. **Context** — comprehensive problem description and scope  
2. **Role** — expert persona for the LLM to adopt  
3. **Task** — step-by-step breakdown of actions  
4. **Constraints** — rules and boundaries  
5. **Output** — expected format and structure

---

## Quick Start

```bash
# run once via npx (no install)
npx @kleosr/pe2-cli

# or install globally
npm install -g @kleosr/pe2-cli
pe2-cli
```

---

## Features

### 🧠 Adaptive Intelligence
* Detects prompt complexity automatically
* Adjusts iteration count based on difficulty
* Five-level scoring system (**NOVICE → MASTER**)

### 🎨 Beautiful Interface
* Clean, centred ASCII art banner
* Colour-coded difficulty indicators
* Interactive mode with arrow-key navigation

### 🔌 Multi-Provider Support
* **OpenAI** — direct API access
* **Anthropic** — Claude models
* **Google** — Gemini models
* **OpenRouter** — access to multiple providers

---

## Usage Examples

### Interactive (recommended)
```bash
pe2-cli    # then type your prompt and press Enter
```

### Direct text input
```bash
pe2-cli "Create a Python function to calculate fibonacci"
```

### File input
```bash
pe2-cli prompt.txt
```

### With options
```bash
pe2-cli "Your prompt" --iterations 3 --model gpt-4o
```

---

## Complexity Levels

| Level | Indicator | Score | Iterations |
|-------|-----------|-------|------------|
| NOVICE | 🟢 | 0-2  | 1 |
| INTERMEDIATE | 🟡 | 3-5  | 2 |
| ADVANCED | 🟠 | 6-8  | 3 |
| EXPERT | 🔴 | 9-12 | 4 |
| MASTER | 🟣 | 13-15 | 5 |

---

## Configuration Wizard

```bash
pe2-cli --config
```

Guided steps:
1. Select AI provider
2. Enter API key
3. Choose a model

Settings are stored in `~/.kleosr-pe2/config.json`.

---

## Command-line Options

```bash
pe2-cli [options] [input]

--model <model>        Override default model
--iterations <n>       Set iteration count (auto by default)
--output-file <file>   Output filename (default: output.md)
--auto-difficulty      Show complexity analysis only
--interactive          Start interactive mode
--config               Configure settings
--help                 Show help
```

---

## Getting API Keys

* **OpenAI:** <https://platform.openai.com>
* **Anthropic:** <https://console.anthropic.com>
* **Google:** <https://makersuite.google.com>
* **OpenRouter:** <https://openrouter.ai>

---

## Output Format

Each run produces a Markdown file containing:

* The optimised prompt sections (Context, Role, Task, Constraints, Output)
* Refinement history
* Performance metrics
* Complexity analysis

---

## Contributing

Pull requests are welcome! Please read the contributing guidelines first.

---

## License

MIT — see **LICENSE** for details.

---

Made with ❤️ by **KleoSr** 