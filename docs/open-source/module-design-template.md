# Module Design Template

Copy this structure when adding a public design note for a module.

```md
# Module Name

## Purpose

What user or system need does this module serve?

## Owns

- Responsibility one
- Responsibility two
- Responsibility three

## Does Not Own

- Boundary it must not cross
- Boundary it must not cross

## Main Entrypoints

- `src/...`
- `src/...`

## Data It Reads

- Durable row or store
- External input
- Runtime state

## Data It Writes

- Durable row or store
- Runtime projection
- Tool result

## Important Failure States

- Missing data state
- Partial write state
- External dependency failure
- User-visible import failure or retry state

## Tests And Verification

- `npm run ...`
- focused test file
- manual verification if needed

## Known Cleanup Still Owed

- Unfinished boundary
- Legacy surface to retire
- Documentation to add after implementation
```
