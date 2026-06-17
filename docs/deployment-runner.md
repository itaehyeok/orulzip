# Production Deployment Runner

This project deploys production from:

```text
/home/th/docker/custom/orulzip/production
```

Human inspection or temporary work should happen in:

```text
/home/th/docker/custom/orulzip/workspace
```

## Flow

1. Push or merge to `main` on GitHub.
2. GitHub Actions starts `.github/workflows/deploy-production.yml`.
3. A self-hosted runner on this Ubuntu server runs the job.
4. The job updates `/home/th/docker/custom/orulzip/production` to `origin/main`.
5. The job rebuilds and restarts Docker Compose with project name `orulzip`.

## Runner Requirements

Create the runner from the GitHub repository UI:

```text
Settings -> Actions -> Runners -> New self-hosted runner
```

Use a runner outside this repository, for example:

```text
/home/th/actions-runner/orulzip
```

Add this custom label when configuring the runner:

```text
orulzip-production
```

The workflow uses:

```yaml
runs-on: [self-hosted, linux, orulzip-production]
```

## Server Requirements

The runner user must be able to run Docker Compose. If the runner runs as `th`,
make sure `th` is in the `docker` group and restart the runner service after
changing group membership:

```bash
sudo usermod -aG docker th
```

The production folder must keep its server-only `.env` file:

```text
/home/th/docker/custom/orulzip/production/.env
```

The deploy script intentionally does not run `git clean`, so untracked `.env`
is preserved.

## Manual Deploy

After the runner is installed, production can also be updated manually with:

```bash
cd /home/th/docker/custom/orulzip/workspace
GITHUB_TOKEN=... GITHUB_REPOSITORY=itaehyeok/orulzip ./scripts/deploy-production.sh
```

Without `GITHUB_TOKEN`, the production checkout must have separate GitHub read
access, such as a deploy key.
