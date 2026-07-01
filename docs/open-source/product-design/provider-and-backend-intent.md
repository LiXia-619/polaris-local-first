# Provider And Backend Intent

Provider and backend surfaces connect Polaris to model APIs and optional
deployment services. They define how model routes are configured, tested, and
used by chat, image, audio, embedding, and tool-capable requests.

The product goal is to let the user choose where model capability comes from
while keeping the rest of the AI environment stable. A collaborator, room, or
request can rely on provider settings without each product surface becoming a
provider configuration screen.

## Product Principles

### Provider routes are user-configured runtime facts

Provider profiles, route cards, model discovery, connection checks, and runtime
settings live in runtime/provider surfaces.

Implementation evidence:

- `src/stores/runtimeStoreProviders.ts`
- `src/ui/shell/ApiProviderSheet.tsx`
- `src/ui/shell/ApiProviderRouteCardSection.tsx`
- `src/app/shell/providerBatchConnectionTest.ts`
- `src/engines/providerModelDiscovery.ts`

### Provider runtime normalizes model transports

The provider runtime adapts OpenAI-compatible, Anthropic, Gemini, and Responses
API-style transports into shared request and stream events.

Implementation evidence:

- `src/engines/provider-runtime/`
- `src/engines/chat-api/chatApiRequestBuilder.ts`
- `src/engines/chat-api/providerRelay.ts`
- `src/engines/providerProtocol.ts`
- `src/engines/providerErrorHandling.ts`

### Backend services remain optional product infrastructure

Self-host and server surfaces support deployment, relay, and rate-limit
behavior. They provide infrastructure around the local-first app rather than
owning the core workspace model.

Implementation evidence:

- `docs/open-source/backend-and-selfhost-intent.md`
- `docs/open-source/modules/server-selfhost.md`
- `src/engines/server/freeProviderRateLimit.ts`
- `src/engines/chat-api/providerRelayShared.ts`
- `workers/polaris-api/`

## Adjacent Responsibilities

- Collaborators and rooms decide which configured route they prefer.
- Context governance assembles request content before provider transport.
- Tool contracts own tool-call visibility and result projection.
- LocalData owns persistence of runtime settings.
