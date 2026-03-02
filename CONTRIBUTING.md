# Contributing to Kochava

Thank you for your interest in contributing to Kochava! 🎉

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/kochava.git
   cd kochava
   ```
3. **Set up development environment**:
   ```bash
   ./setup.sh
   # Choose option 2 (Local installation)
   ```

## Development Workflow

### Making Changes

1. **Create a branch** for your feature/fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards

3. **Test your changes**:
   ```bash
   npm run build       # Compile TypeScript
   npm run test        # Run tests
   npm run lint        # Check types
   ```

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add awesome feature"
   ```

### Commit Message Format

We follow conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```
feat: add support for custom model configurations
fix: resolve routing decision for edge cases
docs: update installation instructions
```

### Pull Request Process

1. **Push your branch** to GitHub:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a Pull Request** on GitHub

3. **Describe your changes**:
   - What problem does it solve?
   - How did you test it?
   - Any breaking changes?

4. **Wait for review** - maintainers will review and provide feedback

## Code Standards

### TypeScript

- Use TypeScript strict mode
- Add proper type definitions
- Avoid `any` types when possible
- Document complex logic with comments

### File Organization

```
src/
├── core/          # Core routing logic
├── claude/        # Claude API integration
├── retrieval/     # Embeddings and search
├── interfaces/    # CLI, server, plugin
├── types/         # TypeScript types
└── utils/         # Utilities
```

### Naming Conventions

- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`

## Testing

### Running Tests

```bash
npm run test              # All tests
npm run test:build        # Type checking
npm run test:health       # Health checks
npm run test:integration  # Integration tests
```

### Writing Tests

Add tests in `test/` directory:
```javascript
// test/my-feature.test.js
test('should do something', () => {
  // Test implementation
});
```

## Documentation

- Update README.md for user-facing changes
- Add inline comments for complex logic
- Update CHANGELOG.md for notable changes

## Local Model Configuration

When adding new models:
1. Update `config/model.config.json`
2. Update `config/routing.config.json`
3. Document in README.md
4. Test with both local and Docker setups

## Docker Testing

Test Docker setup before submitting:
```bash
docker-compose build
docker-compose run --rm kochava "test query"
```

## Getting Help

- Open an issue for bugs or questions
- Join discussions in GitHub Discussions
- Check existing issues before creating new ones

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

Open an issue or reach out to maintainers. We're here to help! 💜
