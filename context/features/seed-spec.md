# Seed Data Specification

## Overview

Create a seed script (`prisma/seed.ts`) to populate the database with sample data for development and demos.

## Requirements

### User

- **Email:** demo@codstash.io
- **Name:** Demo User
- **Password:** 12345678 (hash with bcryptjs, 12 rounds)
- **isPro:** false
- **emailVerified:** current date

### System Item Types


Read @context/features/item-type-card-color-handler.md 
> for configs that are not adapted to the project just adapt them o ignore them if nort necessary


Icons are Lucide React component names. All types have `isSystem: true`.

### Collections & Items

#### React Patterns

_Description: Reusable React patterns and hooks_

3 snippets (TypeScript):

- Custom hooks (useDebounce, useLocalStorage, etc.)
- Component patterns (Context providers, compound components)
- Utility functions

#### AI Workflows

_Description: AI prompts and workflow automations_

3 prompts:

- Code review prompts
- Documentation generation
- Refactoring assistance

#### DevOps

_Description: Infrastructure and deployment resources_

- 1 snippet (Docker, CI/CD config)
- 1 command (deployment scripts)
- 2 links (documentation URLs - use real URLs)

#### Terminal Commands

_Description: Useful shell commands for everyday development_

4 commands:

- Git operations
- Docker commands
- Process management
- Package manager utilities

#### Design Resources

_Description: UI/UX resources and references_

4 links (use real URLs):

- CSS/Tailwind references
- Component libraries
- Design systems
- Icon libraries
