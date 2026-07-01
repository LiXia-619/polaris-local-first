# Memory And Group Chat Intent

Memory and group chat are two expressions of the same Polaris principle:
context should be shaped as a readable environment for the model, with lanes,
rooms, tools, and facts kept in named positions. The proof is the responsibility boundary in the code:
which module owns which context lane, room behavior, tool surface, and persisted
evidence.

## Why These Systems Exist Together

Polaris places the model back into a living workspace with clear evidence,
clear authority, and clear room boundaries.

Memory and group chat share the same underlying idea:

- context is assembled as named lanes
- the app should show the model where each piece of context came from
- stable facts, recent wording, summaries, documents, tools, and room events
  keep distinct authority
- collaborators keep their own identity while entering shared spaces
- the system creates the right environment through structure, state, and tools

The product goal is continuity that feels natural to the user and remains
inspectable in code. The model should know enough to continue, and it should
also know what is a confirmed fact, what is prior wording, what is a summary,
what is only a candidate, and what is merely a directory entry it can expand.

## Intent-To-Implementation Map

| Product intent | Implementation shape | Why this matters |
| --- | --- | --- |
| Memory is a layered context compiler | `requestPreparation.ts` assembles memory, summaries, recall, history, tools, and conversation messages as separate inputs | The request path remains inspectable |
| Confirmed facts and retrieved clues need different authority | `requestMemoryPlan.ts`, `requestSemanticRecallPlan.ts`, and `requestContextContent.ts` render distinct memory and recall segments | A vector hit cannot masquerade as a rule or a confirmed user fact |
| Long reference material should stay expandable | Memory/reference docs enter as directories and are read through tools when needed | Large material stays available without flooding every request |
| Summary pipelines should not be confused with request visibility | `memoryReleaseGates.ts` can allow storage/UI while controlling normal request injection | Generated data can exist without silently affecting every reply |
| Group chat is a room surface | `src/app/group/` owns turn-taking, group request shaping, private lanes, tabs, settings, and room artifacts | Group behavior comes from room structure |
| Collaborators stay themselves inside the group | Group requests preserve member identity and optional memory recall while narrowing room-level tools | The same collaborator can bring personal continuity into a shared space |
| Shared outputs need clear room and author ownership | Group artifact selectors collect room-lineage cards, files, and images with member ownership where relevant | Collaboration remains understandable to both users and models |

## Memory Contract

The implementation separates "cross-conversation memory" from "vector memory"
and from long-term reference documents. Those pieces belong to one memory
family, but they are not the same thing.

The baseline memory system stands on direct continuity material:

- recent original wording from prior conversations can help the model recover
  tone, concern, and continuity
- confirmed memory entries can carry stable user or project facts
- long reference documents can stay as readable documents instead of being
  stuffed into every request

Optional model-assisted memory adds generated material:

- profile-like summaries about thinking style, recurring concerns, expression
  habits, and interaction pattern
- recent-topic summaries with time limits
- semantic text used for vector retrieval

The foundation is current raw tail, collaborator identity, confirmed memory,
recent wording, and readable reference documents. Generated summaries add
structure when available.

## Memory Is Context Compiler Fuel

The memory architecture is about cognitive terrain, not token optimization.
Before adding memory to a request, Polaris has to know what every request piece
is responsible for:

- hard rules are rules
- persona defaults describe interaction posture
- active task context tells the model what table it is standing at
- confirmed memory is reusable background
- semantic recall is candidate continuity material
- summaries are lossy interpretations
- reference documents are expandable sources
- raw recent history is the strongest evidence for what just happened
- the latest user message remains the highest-priority live input

Memory enters the current request path as separate lanes:

| Lane | Purpose | Current implementation |
| --- | --- | --- |
| Confirmed memory | Stable facts and preferences selected for the collaborator | `src/engines/request/requestMemoryPlan.ts` and `buildMemorySegment()` |
| Memory reference docs | Long materials exposed as a directory first, then readable by tool | `buildMemorySegment()` and memory-doc tool registry/executor paths |
| Conversation summaries | Profile or recent-topic summaries that are not quotes or rules | `src/engines/request/requestConversationSummaryPlan.ts` and `buildConversationSummarySegment()` |
| Semantic recall | Prior wording and retrieved continuity clues | `src/engines/request/requestSemanticRecallPlan.ts`, vector recall helpers, and `buildSemanticRecallSegment()` |
| History summary | Degradation material for dropped old history, not cross-chat memory | `src/engines/request/requestContextPlan.ts` |
| Raw tail | Recent true conversation events | request history assembly in `src/engines/request/` |

The app also keeps release gates for memory lanes in
`src/config/memoryReleaseGates.ts`. A memory artifact can exist in storage or UI
without necessarily entering every normal request. That distinction matters:
generation, persistence, visibility, and request injection are separate facts.

## Original Wording Carries Continuity

Original wording carries the user's expression, concern, pace, and previous
framing. The request copy should keep authority labels clear while still making
the material feel usable to the model.

The product intent is warmer and more direct: recalled original wording helps
the model recover how the user speaks, what they were concerned with, and how a
thread felt before it was interrupted. The implementation keeps both sides:

- `buildSemanticRecallSegment()` tells the model that recalled snippets are
  prior user wording and continuity material.
- The segment still marks the material as semantic recall rather than confirmed
  memory or a rule.
- Candidates keep source conversation/message identifiers for inspection.

This is the core balance: the model gets continuity, while the system keeps
authority labels.

## Composition Rules

Memory should keep answers focused when the same fact appears in several lanes:

- summaries defer to confirmed memory
- confirmed memory defers to current workspace/task state
- workspace/task state defers to the latest user message
- reference directories stay as directories until expanded
- semantic matches stay labeled as recall candidates

The implementation follows this by assembling request materials separately in
`src/engines/request/requestPreparation.ts`. That file is the proof point for
what can enter a request. `src/engines/request/requestContextContent.ts` is the
proof point for how those pieces are labeled once rendered.

## Group Chat Contract

Group chat is a complete product surface. The room has its own location, tabs,
settings, member list, background, tool permissions, artifacts, images, and
private member lanes.

The human model is simple:

- the group room is one shared public conversation
- each collaborator is still themself inside the room
- each collaborator can bring their own memory and identity
- group outputs belong to the group and should carry authorship
- private member lanes are allowed for per-collaborator context and process
- the room decides which shared tools exist inside it

The current code implements this as a group world under `src/app/group/`, with
group-specific request shaping, scheduler behavior, tabs, tool settings, lanes,
and artifact collection.

## Group Chat Room Order

A group reply runs through room order before the model speaks.

| Concern | Current implementation |
| --- | --- |
| Round order | `orderGroupRoundRespondents()` rotates after the last real speaker and moves explicitly mentioned members to the front |
| Random order | `planGroupRandomRespondents()` chooses a subset and gives staggered delays |
| Relay mentions | `insertRelayTargets()` and reply-controller logic add mentioned members back into the queue or follow-up plan |
| Running state | `useGroupReplyController()` tracks per-member generation keys, stop/retry state, timers, and active sessions |
| Silence | `GROUP_SILENCE_SENTINEL` can be allowed per group and is collected out of public messages after a silent completion |

The model still writes the actual message, but the app owns who gets a turn,
when they get it, and how an `@member` changes the next opportunity to speak.

## Group Request Shape

For each member turn, Polaris reshapes the request so the model sees the room
correctly:

- `buildGroupMemberSystemMessage()` tells the current collaborator they are in a
  public group room, not back in private chat.
- `labelRequestMessagesForMember()` labels other collaborators' public messages
  as named messages so the current speaker can distinguish who said what.
- `buildLaneDigestMessage()` brings that member's private lane into their turn
  when there are whisper entries.
- `buildGroupTurnAnchorMessage()` repeats the room/member identity close to the
  generation point, where it is harder for a long persona prompt to override.
- `useGroupWorldController()` disables unrelated single-chat state such as
  current task, active project, workspace reference docs, and theme tools when
  building group requests.

This matches the product intent: group behavior should come from the environment
and request shape, not from a giant repeated instruction that fights the model on
every turn.

## Memory Inside The Group

Collaborators should remain themselves in the group. That means memory is not
replaced by the room. A collaborator can still use their own identity and memory
while the room controls shared artifacts and shared tools.

Current implementation points:

- `groupMemoryRecallEnabled()` lets a group disable member memory recall without
  deleting the member's personal memory.
- `buildGroupToolPreferences()` keeps personal memory and memory recall
  available when enabled, while disabling unrelated tool groups such as task,
  project, desktop, theme, archive, knowledge, and proactive tools in the group
  request surface.
- `useGroupWorldController()` sets `activeWorld: 'group'`, narrows collection
  materials to the group lineage, turns theme tooling off, clears task/project
  context, and only exposes room-level cards/images/MCP when the group settings
  allow them.

This preserves the two boundaries at once: the collaborator is still a real
collaborator, and the room is still a real room.

## Private Lanes And Public Artifacts

Each collaborator can have a visible private lane: the user can step into a
member lane, see process context, and talk to one member without automatically
broadcasting everything to the group.

Current implementation keeps that split:

- `laneWhisperEntries()` reads per-member private lane entries from
  `conversation.group.privateLanes`.
- `buildLaneDigestMessage()` makes those entries available to the member on a
  later group turn.
- `buildGroupLaneTimeline()` combines private whispers with public-process
  evidence for that member: public excerpt, thinking text when available,
  code blocks, memory recall evidence, and tool events.
- `groupCards`, `groupArtifacts`, and `groupImages` in
  `useGroupWorldController()` collect room-lineage outputs and preserve owner
  names where relevant.

The room-file idea survives as scoped room context and group lineage rather than
as a literal "group chat file" abstraction. That is the more natural fit for the
current code: the room is a conversation family with member identity, private
lanes, public timeline, and owned artifacts.

## Design Summary

Memory is a layered context compiler, and group chat is a room surface with
per-member request shaping. The shared structure is direct: sources of truth stay
named, model context stays inspectable, and a collaborator in a group remains a
collaborator rather than a disposable bot instance.

## Code Map

| Intent | Code/doc proof |
| --- | --- |
| Context is assembled by responsibility | `src/engines/request/requestPreparation.ts`, `src/engines/request/requestContextContent.ts` |
| Chat originals remain stronger than summaries or vector hits | semantic recall source identifiers, request context source labels |
| Confirmed memory and semantic recall stay separate | `requestMemoryPlan.ts`, `requestSemanticRecallPlan.ts`, `requestContextContent.ts` |
| Long memory/reference docs are expandable | `buildMemorySegment()` and memory-doc tools |
| Conversation summaries are generated/stored/requested separately | `requestConversationSummaryPlan.ts`, `memoryReleaseGates.ts` |
| Group chat owns turn scheduling | `src/app/group/groupTurnTaking.ts`, `src/app/group/useGroupReplyController.ts` |
| Group members see room-shaped requests | `src/app/group/groupRequestModel.ts`, `useGroupWorldController()` request overrides |
| Group lanes separate private whispers from public output evidence | `src/app/group/groupLaneModel.ts`, `privateLanes` group state |
| Group artifacts preserve room lineage and member ownership | group artifact/image/card selectors in `src/app/group/useGroupWorldController.ts` |

## Source And Release Facts

This document describes intent and current source structure. Source state,
public repository state, web selfhost, Android APK, iOS TestFlight, and desktop
packaging remain separate release facts.
