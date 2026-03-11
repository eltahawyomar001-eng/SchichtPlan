# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Redis-backed caching layer (`src/lib/cache.ts`)
- AES-256-GCM encryption for 2FA secrets
- Docker support (Dockerfile, docker-compose.yml)
- Staging environment deployment workflow
- Health check improvements (Stripe connectivity, Node version)
- OpenAPI 3.1 documentation (`docs/openapi.yaml`)
- Background jobs architecture documentation
- E2E test coverage for public pages
- Coverage thresholds in vitest (70% lines/functions/statements)

### Changed

- JWT role-refresh cache moved from in-memory Map to Redis
- Sentry server/edge configs enhanced with profiling and breadcrumb scrubbing
- CI pipeline uses real PostgreSQL service containers
- Security audit CI job no longer uses `continue-on-error`

### Fixed

- Notification model missing foreign key relations (multi-tenancy hardening)
- Database connection pool now configurable via `DATABASE_POOL_MAX` env var

### Security

- 2FA secrets encrypted at rest with AES-256-GCM
- CORS headers properly configured for API routes
