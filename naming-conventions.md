# Naming Conventions

## Projects — `lowercase-kebab-case`

**Format:** All lowercase letters, words separated by hyphens.

Examples:

- `my-project`
- `api-gateway`
- `user-auth-service`

---

## Markdown Files (`.md`)

### Important Root-Level Files — `UPPER_SNAKE_CASE`

Reserved for high-visibility project meta files that live in the repository root. These follow the Unix convention of uppercasing important files so they stand out in directory listings.

**Format:** All uppercase letters, words separated by underscores.

Examples:

- `README.md`
- `CHANGELOG.md`
- `LICENSE.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY_POLICY.md`
- `PULL_REQUEST_TEMPLATE.md`

### All Other `.md` Files — `lowercase-kebab-case`

All documentation, guides, and content files use lowercase letters with hyphens as word separators. This keeps filenames URL-friendly, readable, and consistent across operating systems.

**Format:** All lowercase letters, words separated by hyphens. No spaces, no underscores, no camelCase.

Examples:

- `getting-started.md`
- `api-reference.md`
- `release-notes.md`
- `deployment-guide.md`
- `troubleshooting.md`

## Branches

**Format:** `<type>/<description>` — type prefix followed by a slash, then a short lowercase kebab-case description.

Examples:

- `feature/add-login-page`
- `fix/change-button-color`

### Types

- **`feature/`** — new functionality being added to the project.
- **`fix/`** — a bug fix or correction to existing behavior.

> Branch types are limited to `feature/` and `fix/`. Other commit types (`chore`, `docs`, `refactor`) apply at the commit level only — they describe individual changes made within a branch, not the branch itself.

---

## Commits

**Format:** `<type>: <short description>` — type prefix followed by a colon and space, then a concise message in imperative tense ("add" not "added", "fix" not "fixed").

Examples:

- `feature: add login page`
- `fix: change button color`
- `docs: update README setup steps`
- `refactor: extract auth logic into helper`
- `chore: bump lodash to 4.18`

### Types

- **`feature:`** — introduces new functionality to the project.
- **`fix:`** — corrects a bug or unintended behavior.
- **`docs:`** — changes to documentation only, no code logic affected.
- **`refactor:`** — restructures existing code without changing its behavior or adding features.
- **`chore:`** — maintenance tasks that don't affect code logic or documentation, such as updating dependencies, config changes, or tooling setup.

---

## Environment Variables — `UPPER_SNAKE_CASE`

**Format:** All uppercase letters, words separated by underscores.

Examples:

- `DATABASE_URL`
- `API_SECRET_KEY`
- `PORT`
- `NODE_ENV`

---

## Folder Names

### General Folders — `lowercase-kebab-case`

All folders use lowercase letters with hyphens as word separators, consistent with the general `.md` file rule.

**Format:** All lowercase letters, words separated by hyphens. No spaces, no underscores, no camelCase.

Examples:

- `api-reference/`
- `getting-started/`
- `release-notes/`
- `user-guides/`

### Established Top-Level Folders

Some top-level folders have widely adopted single-word names — keep these as-is:

- `src/`
- `docs/`
- `tests/`
- `public/`
- `assets/`
- `config/`
- `scripts/`

---

## Script Files

### JavaScript / TypeScript — `camelCase`

**Format:** First word lowercase, each subsequent word capitalized. No separators.

Examples:

- `apiClient.ts`
- `formatDate.js`
- `useAuthStore.ts`

**Test files:** Mirror the source file name with a `.test` suffix.

- `apiClient.test.ts`
- `formatDate.test.js`

**Entry points:** Use conventional names as-is.

- `index.ts`
- `app.ts`

---

### Python — `lowercase_snake_case`

**Format:** All lowercase, words separated by underscores. Hyphens are invalid in Python module names and will break imports.

Examples:

- `api_client.py`
- `format_date.py`
- `data_pipeline.py`

**Test files:** Mirror the source file name with a suffix.

- `api_client_test.py`
- `format_date_test.py`

**Entry points:** Use conventional names as-is.

- `main.py`
- `app.py`

**Reserved language constructs:** Dunder files are Python language conventions — leave them as-is.

- `__init__.py`
- `__main__.py`

---

### Shell — `lowercase-kebab-case`

**Format:** All lowercase, words separated by hyphens.

Examples:

- `deploy-prod.sh`
- `seed-db.sh`
- `setup-env.sh`

---

### Config & Tool Files

Config files follow their tool's own convention — do not rename them.

Examples:

- `jest.config.ts`
- `vite.config.ts`
- `.env.example`
- `docker-compose.yml`

### Tool/Config Folders

Hidden and tool-managed folders follow their own tool's convention and should not be renamed:

- `.github/`
- `.husky/`
- `.vscode/`
