# Contributing to MCP Apple Simulator

## Branching Strategy

We use **GitHub Flow** - a simple, effective branching model:

### Branches
- **`main`** - Always stable, production-ready code. Every commit should be deployable.
- **`feature/*`** - Feature branches for new functionality
- **`fix/*`** - Bug fix branches
- **`docs/*`** - Documentation updates

### Workflow

1. **Create a feature branch** from main:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and commit:
   ```bash
   git add .
   git commit -m "feat: add new simulator tool"
   ```

3. **Push and create a Pull Request**:
   ```bash
   git push origin feature/your-feature-name
   ```

4. **After review and CI passes**, merge to main

### Commit Message Convention

We use conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Test additions or changes
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

### Why No Develop Branch?

We intentionally don't use a `develop` branch because:
- **Simplicity** - Fewer branches to manage
- **No sync issues** - No divergence between develop and main
- **Continuous deployment** - Every merge to main is ready for users
- **Local tool** - Users update when they want, not on a release schedule

### Pull Request Guidelines

1. **All tests must pass** - Run `npm test` locally first
2. **Update documentation** - If adding features, update README
3. **Small, focused PRs** - Easier to review and less likely to conflict
4. **Clean commit history** - Squash commits if needed

### Testing

Before submitting a PR:
```bash
npm run build          # Build TypeScript
npm run test:unit      # Run unit tests
npm run test:coverage  # Check coverage (aim for >75%)
```

### Code Style

- TypeScript strict mode enabled
- No `any` types without good reason
- Follow existing patterns in the codebase
- Use dependency injection for testability

### Questions?

Open an issue for discussion before making large changes.