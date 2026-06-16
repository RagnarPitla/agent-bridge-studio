# GitHub CLI and Host-Aware GitHub Design

## Problem

Many apps hardcode `https://api.github.com`. That works for GitHub.com but fails or becomes awkward for GitHub Enterprise hosts such as `microsoft.ghe.com`.

## Principle

Use `gh` as the source of truth for authentication and GitHub host configuration.

## Project config

Recommended project-level config:

```env
GITHUB_HOST=github.com
GITHUB_REPO=owner/repo
GITHUB_REMOTE=origin
```

For GitHub Enterprise:

```env
GITHUB_HOST=microsoft.ghe.com
GITHUB_REPO=org/repo
GITHUB_REMOTE=origin
```

## Command patterns

```bash
gh auth status --hostname "$GITHUB_HOST"
gh auth token --hostname "$GITHUB_HOST"
gh api --hostname "$GITHUB_HOST" repos/$GITHUB_REPO
gh pr view 123 --repo "$GITHUB_REPO"
```

For GitHub Enterprise, always include `--hostname` on `gh api` calls.

## API wrapper recommendation

Create one GitHub client module:

```ts
interface GitHubContext {
  host: string;
  repo: string;
}

interface GitHubClient {
  api<T>(ctx: GitHubContext, path: string, options?: ApiOptions): Promise<T>;
  prCreate(ctx: GitHubContext, request: PrCreateRequest): Promise<PrResult>;
}
```

Internally it may call `gh api` or direct REST, but direct REST must derive base URL from host.

## Avoid

- Storing long-lived PATs in project `.env` when `gh` can supply tokens.
- Assuming one active GitHub account globally.
- Assuming all repos live on GitHub.com.
