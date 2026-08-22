# Secret Handling Rules

- Treat all bearer tokens, API keys, and credentials as secrets.
- Do not commit real credential configuration files (e.g., `.env`, service account keys, auth config).
- Do not read or print local configuration store files containing tokens unless explicitly instructed by the developer for security troubleshooting.
- Do not paste full JWTs, Authorization headers, refresh tokens, private keys, `.env` values, or decoded claims into chat summaries or code logs.
- Use placeholders such as `<TOKEN>`, `<TENANT_ID>`, and `<API_SERVER_URL>` in docs and examples.
- If a real token is found in a repository, replace it with a placeholder and inform the developer to rotate or refresh it immediately.
