# Group Chat Intent

Group chat makes a room feel like a shared work scene. A room has collaborators,
conversation lanes, turn-taking behavior, generated artifacts, and settings that
shape how participants respond to each other.

The product goal is to make multi-collaborator AI work understandable. The user
should see who is present, who is replying, which room the work belongs to, and
which artifacts came from the room. The model should receive a room-shaped
request instead of a flat transcript.

## Product Principles

### Rooms are the primary object

The room owns membership, messages, cards, images, settings, and active lane
state. Collaborators participate through the room rather than floating as
separate reply generators.

Implementation evidence:

- `src/ui/worlds/GroupWorld.tsx`
- `src/ui/worlds/group/GroupRoom.tsx`
- `src/app/group/useGroupWorldController.ts`
- `src/app/group/groupConversationModel.ts`
- `src/app/group/groupTypes.ts`

### Reuse follows semantics, not screens

Group chat can reuse lower-level UI pieces only when the user expectation,
participant relationship, message rhythm, and model request semantics match the
room. A shared room is a different product object from a single-collaborator
conversation.

Room-shaped interaction owns membership, per-member lanes, room artifacts, room
settings, and group reply behavior. Components should follow those semantics
instead of carrying single-chat assumptions into a shared scene.

Implementation evidence:

- `src/ui/worlds/group/`
- `src/app/group/useGroupWorldController.ts`
- `src/app/group/useGroupLaneController.ts`
- `src/app/group/groupRequestModel.ts`
- `src/app/group/groupLaneModel.ts`

### Private process lanes protect shared rhythm

The room timeline shows shared messages and shared artifacts. A collaborator's
private process lane can hold that member's reasoning view, tool events, memory
evidence, and lane-specific context without turning the public room into a wall
of process.

The user can inspect a member lane when it matters. Other collaborators keep
working from the room result and the room context, so private process and shared
collaboration stay separate product surfaces.

Implementation evidence:

- `src/app/group/groupLaneModel.ts`
- `src/app/group/useGroupLaneController.ts`
- `src/ui/worlds/group/GroupLaneSheet.tsx`
- `src/ui/worlds/group/GroupAvatar.tsx`

### Group artifacts carry attribution

Cards, images, files, and other room traces should make authorship legible.
The model should be able to tell which collaborator produced a thing, and the
user should be able to read the same authorship without a long explanation.

Attribution is part of the room environment. It keeps collaboration from
collapsing into an anonymous pile of outputs, especially when a room is used as
a multi-collaborator workspace.

Implementation evidence:

- `src/app/group/groupTypes.ts`
- `src/app/group/useGroupWorldController.ts`
- `src/ui/worlds/group/GroupCardsTab.tsx`
- `src/ui/worlds/group/GroupImagesTab.tsx`

### Turn-taking is explicit

Polaris models which collaborator should speak, whether a mention targets a
participant, and how room activity changes reply behavior. This gives the user a
readable room rhythm.

Implementation evidence:

- `src/app/group/groupTurnTaking.ts`
- `src/app/group/groupMentions.ts`
- `src/app/group/useGroupReplyController.ts`
- `src/app/group/groupActivity.ts`
- `src/ui/worlds/group/GroupTimeline.tsx`

### Room outputs stay attached to the room

Group-generated cards and images appear in room tabs and can move into the
collection. This keeps artifacts connected to the collaboration that produced
them.

Implementation evidence:

- `src/ui/worlds/group/GroupCardsTab.tsx`
- `src/ui/worlds/group/GroupImagesTab.tsx`
- `src/ui/worlds/group/GroupImagePreview.tsx`
- `src/app/group/groupMessageCode.ts`
- `src/app/collection/useCodeCollectionChatBridge.ts`

## Adjacent Responsibilities

- Collaborator settings own each participant's identity, model, memory, and tool
  controls.
- Collection owns saved artifacts after they become collection objects.
- Context governance owns the final request assembly for a model reply.
- Provider runtime owns model transport after the room request is prepared.
