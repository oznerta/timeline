# AI Features & LLM Governance Rules

Applies whenever implementing runtime LLM calls, AI features, prompts, or agent behaviors in applications.

## 1. Safety & Prompt Injection Defense

- **Untrusted User Inputs**: Treat all user inputs passed into AI prompts as untrusted. Enclose inputs in clear system delimiters.
- **Sanitize Rendered Outputs**: Scrub and sanitize AI output before rendering in web HTML/JSX to prevent XSS.

## 2. Agent Human Confirmation Gates

- **Irreversible Actions**: AI features or agents must require explicit human confirmation before taking high-impact or destructive actions (e.g. deleting data, executing monetary transactions, broadcasting external emails).

## 3. Cost & Model Versioning Controls

- **Pin Model Parameters**: Explicitly define model provider, version, temperature, and max tokens.
- **Enforce Budgets**: Set per-request token limits and timeout ceilings to prevent infinite loop costs.
