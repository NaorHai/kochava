# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow these steps:

### 1. **Do Not** Open a Public Issue

Please do not publicly disclose the vulnerability until it has been addressed.

### 2. Report Privately

Email security concerns to: [Your email or create a private security advisory on GitHub]

Or use GitHub's private vulnerability reporting:
1. Go to the Security tab
2. Click "Report a vulnerability"
3. Fill in the details

### 3. Include Details

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### 4. Response Timeline

- **24 hours**: Initial acknowledgment
- **72 hours**: Initial assessment
- **7 days**: Fix or mitigation plan
- **30 days**: Public disclosure (after fix is released)

## Security Best Practices

### API Keys

- Never commit API keys to the repository
- Use `.env` files (already in `.gitignore`)
- Rotate keys regularly
- Use environment variables in production

### Local Models

- Kochava runs models locally via Ollama
- No code is sent to external servers for local tasks
- Only complex tasks use Claude API (if configured)

### Docker Security

- Official base images only
- Containers run as non-root users (where possible)
- Volumes are properly scoped
- Network isolation via docker-compose networks

### Dependencies

- Regular dependency updates via Dependabot
- Automated security scanning via GitHub Actions
- Only trusted npm packages used

## Disclosure Policy

When we receive a security report:

1. Confirm the issue
2. Determine severity
3. Develop and test a fix
4. Release a patch version
5. Publish a security advisory
6. Credit the reporter (if desired)

## Security Features

### Data Privacy

- **Local-First**: 60-80% of requests never leave your machine
- **No Telemetry**: Kochava does not collect usage data
- **Offline Capable**: Works without internet for local tasks

### Sandboxing

- Models run in isolated Ollama processes
- Docker containers provide additional isolation
- No file system access beyond designated directories

### Safe Defaults

- Claude API key optional (works with local-only mode)
- Token budgets prevent runaway costs
- Automatic fallback to local models on errors

## Questions?

For non-security questions, please open a regular GitHub issue.

For security concerns, follow the reporting process above.

Thank you for helping keep Kochava secure! 🔒
