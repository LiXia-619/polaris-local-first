import { describe, expect, it } from 'vitest';
import { buildAssistantToolPromptSections } from './assistantToolProtocolPrompt';
import { resolveAssistantToolRequestTools } from './assistantToolProtocolRequestTools';
import type { AssistantToolContext } from './assistantToolProtocolTypes';
import { resolveToolCapabilityReceipt } from './toolCapabilityReceipt';
import { resolveAvailablePolarisToolNames } from './toolRegistry';

function workspaceSnapshot() {
  return {
    id: 'workspace-mini-phone',
    title: 'Mini Phone',
    slug: 'mini-phone',
    tags: [],
    source: 'chat-generated' as const,
    fileCount: 1,
    files: [],
    entryFileId: 'file-1',
    entryFilePath: 'index.html'
  };
}

function catalogToolNames(context: AssistantToolContext) {
  const catalog = buildAssistantToolPromptSections(context)
    .find((section) => section.name === 'tool_catalog_capability')?.content ?? '';
  return [...catalog.matchAll(/`([^`]+)`：/g)].map((match) => match[1]);
}

function nativeRequestToolNames(context: AssistantToolContext) {
  return resolveAssistantToolRequestTools(context).tools.map((tool) => tool.function.name);
}

function sorted(names: string[]) {
  return [...names].sort();
}

function expectNoDuplicateToolNames(names: string[]) {
  expect(new Set(names).size).toBe(names.length);
}

describe('tool capability receipt contract', () => {
  it.each([
    {
      label: 'ordinary room chat',
      context: {
        themeToolMode: 'stable',
        themeContextMode: 'none',
        toolEnforcementMode: 'normal',
        themePreviewActive: false,
        enabledToolGroups: {
          room: true,
          project: true,
          theme: true,
          attachment: false,
          generation: false,
          archive: false,
          web: false,
          memory: false
        },
        activeCard: null,
        visibleCards: []
      }
    },
    {
      label: 'workspace chat',
      context: {
        themeToolMode: 'stable',
        themeContextMode: 'none',
        toolEnforcementMode: 'normal',
        themePreviewActive: false,
        enabledToolGroups: {
          room: true,
          project: true,
          theme: true,
          attachment: false,
          generation: false,
          archive: false,
          web: false,
          memory: false
        },
        activeCard: null,
        visibleCards: [],
        activeProject: workspaceSnapshot()
      }
    },
    {
      label: 'seed creative theme chat',
      context: {
        taskMode: 'seed',
        themeToolMode: 'creative',
        themeContextMode: 'none',
        toolEnforcementMode: 'normal',
        themePreviewActive: false,
        enabledToolGroups: {
          room: true,
          project: false,
          theme: true,
          attachment: false,
          generation: true,
          archive: false,
          web: false,
          memory: false
        },
        activeCard: null,
        visibleCards: []
      }
    },
    {
      label: 'forced stable theme-only turn',
      context: {
        themeToolMode: 'stable',
        themeContextMode: 'focused',
        toolEnforcementMode: 'force',
        toolEnforcementScope: 'theme-only',
        themePreviewActive: true,
        enabledToolGroups: {
          room: true,
          project: true,
          theme: true,
          attachment: true,
          generation: true,
          archive: true,
          web: true,
          memory: true
        },
        activeCard: null,
        visibleCards: []
      }
    },
    {
      label: 'zip attachment and archive turn',
      context: {
        themeToolMode: 'stable',
        themeContextMode: 'none',
        toolEnforcementMode: 'normal',
        themePreviewActive: false,
        enabledToolGroups: {
          room: false,
          project: false,
          theme: false,
          attachment: true,
          generation: false,
          archive: true,
          web: false,
          memory: false
        },
        attachmentSnapshot: {
          latest: [{
            id: 'attachment-zip',
            kind: 'file',
            name: 'materials.zip',
            mimeType: 'application/zip'
          }],
          available: [{
            id: 'attachment-zip',
            kind: 'file',
            name: 'materials.zip',
            mimeType: 'application/zip'
          }]
        },
        activeCard: null,
        visibleCards: []
      }
    }
  ] satisfies Array<{ label: string; context: AssistantToolContext }>)(
    'uses one visible native tool set across request, prompt, and runtime names for $label',
    ({ context }) => {
      const receipt = resolveToolCapabilityReceipt(context);
      const receiptNativeNames = receipt.nativeTools.map((tool) => tool.name);
      const receiptGroupedNames = Object.values(receipt.nativeToolsByGroup).flatMap((tools) => (
        tools ?? []
      ).map((tool) => tool.name));
      const requestNames = nativeRequestToolNames(context);
      const promptCatalogNames = catalogToolNames(context);
      const availableToolNames = resolveAvailablePolarisToolNames(context);

      expectNoDuplicateToolNames(receiptNativeNames);
      expectNoDuplicateToolNames(requestNames);
      expectNoDuplicateToolNames(promptCatalogNames);
      expect(sorted(requestNames)).toEqual(sorted(receiptNativeNames));
      expect(sorted(promptCatalogNames)).toEqual(sorted(receiptNativeNames));
      expect(sorted(receiptGroupedNames)).toEqual(sorted(receiptNativeNames));
      for (const toolName of receiptNativeNames) {
        expect(availableToolNames.has(toolName)).toBe(true);
      }
    }
  );
});
