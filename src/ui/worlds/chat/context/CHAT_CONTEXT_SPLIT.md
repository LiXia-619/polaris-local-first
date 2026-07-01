# Chat Context Split Map

这份表不是设计讨论，是当前 `ChatContext` 的手术地图。后面如果继续拆成多个 context，字段只能沿着这里的职责边界移动，不能再回到“大对象临时总线”。

## Stable Payload

- `conversation`
  当前激活对话本身。
- `messages`
  当前对话消息流。
- `persona`
  当前对话实际使用的协作者。

## `presentation`

这一组只回答“chat 应该怎么被呈现”，不持有可变本地草稿，不执行动作。

- `assistantName`
- `fallbackAssistantName`
- `personaColor`
- `conversationTitle`
- `isActiveWorld`
- `recentConversations`
- `activeConversationId`
- `activeCollaboratorId`
- `showChatAvatars`
- `personas`
- `startupReady`
- `interactionLocked`
- `hasUnsupportedPendingImages`
- `timelineDensity`

## `composer`

这一组只负责输入区和工具偏好的当前值，是“正在编辑什么”的账本。

- `inputDraft`
- `dragActive`
- `pendingCardReference`
- `availableCards`
- `toolPromptPreferences`
- `taskModeEnabled`
- `themeToolMode`
- `canReviveTheme`

## `ui`

这一组是纯界面临时态和只给渲染层看的派生 UI 信号。

- `commandStatus`
- `editing`
- `streaming`
- `focusedMessageId`
- `showThinking`
- `showLiveThinking`
- `showEmptyState`
- `sending`
- `collapsedThinkingMessageIds`
- `expandedCodeMessageIds`
- `latestRetryableAssistantId`
- `activePreviewMessage`
- `thinkingSummaryMessageId`
- `codeCardActionModeByMessageId`
- `codeCardProgressByMessageId`

## `attachments`

这一组只负责 pending attachment 队列及其增删清动作。

- `pending`
- `add`
- `remove`
- `clear`

## `actions`

这一组只放显式用户动作，不放展示值，不放派生结果。

- `submit`
- `stopGeneration`
- `retry`
- `editMessage`
- `updateEditingDraft`
- `removeEditingAttachment`
- `commitEdit`
- `cancelEdit`
- `toggleThinkingCollapsed`
- `openThinkingSummary`
- `toggleCodeExpanded`
- `applyToolPreview`
- `rollbackToolPreview`
- `saveImageAttachment`
- `codeCardAction`
- `setInputDraft`
- `setConversationDraft`
- `setPendingCardReference`
- `setDragActive`
- `setCommandStatus`
- `clearCommandStatus`
- `setToolPromptGroupEnabled`
- `setTaskModeEnabled`
- `setThemeToolMode`
- `reviveTheme`
- `restoreDefaultTheme`
- `openToolbox`
- `createConversation`
- `openConversation`
- `selectPersona`
- `deleteCollaborator`
- `closeThinkingSummary`

## Non-Goals

- 这轮不拆成多个 React context。
- 这轮不改 consumer API。
- 这轮不把 theme 或 tool 系统继续外移。

先把账本写清楚，再决定哪几组值得物理拆分。
