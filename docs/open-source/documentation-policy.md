# Documentation Policy

This folder is the explanation layer for Polaris.

The rule is simple: docs should explain design intent and current boundaries in
present tense.

## What Belongs Here

Add documents here when they explain:

- product intent
- module responsibility
- data ownership
- backend/selfhost setup
- tool contract design
- native bridge boundaries
- source verification gates
- current availability and planned next work

The best public design note is short, direct, and close to the code it describes.

## Public Scope

When evidence comes from a local check, record command names, counts, invariant
names, and pass/fail status. Keep the document focused on facts a reader can use
to understand the source tree.

## How To Write A Module Design Note

Use [module design template](module-design-template.md).

Each module note should answer:

1. What is this module for?
2. What does it own?
3. What does it explicitly not own?
4. Which files are the main entrypoints?
5. Which data does it read or write?
6. Which failure states matter?
7. Which tests prove the boundary?
8. Which cleanup is still owed?

## How To Record Availability

Be direct and present-tense. Say what is currently available, what requires configuration, and what is planned next.

Good:

> Voice relay is planned as a backend capability. Public deployments should not advertise it until the handler is present.

Bad:

> Audio relay is generally supported.

Readers should never have to guess whether a capability is available in the public source, requires a deployer-owned backend, or is planned next.

## Relationship To Other Docs

The broader `docs/` directory can contain implementation records and detailed plans. Those documents are useful, but they are not automatically part of the introduction layer.

When another document contains a durable design decision, extract the current
decision into this folder instead of sending a new reader through the full
project record.
