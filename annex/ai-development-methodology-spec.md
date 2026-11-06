# AI Coding Agent Prompt — Build and Maintain an AI Development Methodology

## Objective

Throughout this project, you are responsible for maintaining a living document that captures **the methodology** behind how we build software with AI.

This document is **not** a project journal, a changelog, or course notes.

Its purpose is to reverse-engineer the workflow, decision-making process, prompting strategy, and engineering principles that emerge while we build this project.

By the end of the project, the document should describe a reusable methodology that can be applied to build **any serious software project with AI**, regardless of the technology stack or business domain.

## Core Principle

Always think at two levels:

### Level 1 — The Project

Document what we are currently building.

### Level 2 — The Method

Extract the general principle that would still be true if we were building a completely different application.

The second level is far more important than the first.

## Living Document

Treat this as a permanent document that evolves during the project.

After every meaningful milestone, review whether the methodology should be updated.

Do not merely append information.

Instead:

- reorganize sections when needed,
- improve explanations,
- merge duplicated ideas,
- refine principles,
- rewrite earlier sections if a better understanding emerges,
- remove ideas that later prove incorrect,
- keep the document coherent as if it had been written at the end of the journey.

The document should become progressively better, not merely longer.

## What To Capture

Whenever we complete a significant task, determine whether it teaches something about the development process.

If yes, document:

### What happened?

Describe the activity objectively.

### Why did we do it this way?

Explain the reasoning behind the decision.

### What general principle does this reveal?

Extract the reusable engineering principle.

### Can this be generalized?

Describe how the same idea would apply to other projects.

### Are there alternatives?

Mention other possible approaches and why this one was chosen.

### What should future me remember?

Capture concise rules, heuristics, or lessons learned.

## Focus Areas

Continuously document topics such as:

- Project discovery
- Requirement gathering
- Clarifying ambiguous ideas
- Planning
- Scope definition
- Vertical slices
- Architecture
- Domain modeling
- Data modeling
- Prompt engineering
- AI collaboration techniques
- Context management
- Memory management
- Documentation strategy
- Task decomposition
- Implementation workflow
- Testing strategy
- Debugging workflow
- Refactoring strategy
- Review process
- Decision making
- Trade-offs
- AI limitations
- Human responsibilities
- Common mistakes
- Best practices
- Reusable prompt patterns
- Reusable workflows

If new categories emerge naturally, create them.

## Prompt Analysis

Whenever a prompt leads to an especially good outcome, analyze it.

Instead of only storing the prompt, explain:

- Why it worked.
- Which information made it effective.
- Which parts were unnecessary.
- How it could become a reusable template.
- When it should be reused.
- When it should NOT be reused.

Build a library of prompt patterns rather than isolated prompts.

## Decision Log

Whenever we make an important decision, capture:

- The context.
- The available options.
- The trade-offs.
- The chosen solution.
- Why it was selected.
- Whether the decision is project-specific or generally applicable.

## Extract Frameworks

As patterns emerge, convert them into reusable frameworks.

For example:

- Starting a new AI project
- Planning an MVP
- Designing an architecture
- Working feature by feature
- Debugging with AI
- Reviewing AI-generated code
- Introducing a new technology
- Refactoring safely
- Managing technical debt
- Keeping AI context effective

The goal is to transform isolated experiences into repeatable processes.

## Prefer Principles Over Examples

Avoid documenting technology-specific details unless they illustrate a broader principle.

Instead of:

“We used PostgreSQL.”

Prefer:

“Choose infrastructure only after validating the domain model.”

Examples should support principles, never replace them.

## Keep It Opinionated

Do not simply record events.

Continuously infer:

- what works,
- what doesn’t,
- what scales,
- what creates unnecessary complexity,
- what should become a standard practice.

When evidence changes, update earlier conclusions.

## Be Critical

Do not assume that every step in the course is optimal.

If a better approach becomes evident, record both:

- the approach followed,
- the improved approach,
- why the improvement is preferable.

The objective is to build the best possible methodology, not merely reproduce the course.

## End Goal

By the end of this project, this document should read like a practical handbook titled:

**“A Methodology for Building Serious Software Projects with AI”**

Someone unfamiliar with this project should be able to follow the methodology to build their own production-quality software using AI as a development partner.

Whenever we finish a meaningful task, first ask yourself:

“Did we just discover a reusable principle?”

If the answer is yes, improve the methodology before moving on.

### Note
I created an empty file named "ai-methology-recipe.md". in the "docs" folder whichone is the root folder. 