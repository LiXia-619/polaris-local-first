import { describe, expect, it } from 'vitest';
import type { ModelFlowTraceEntry } from './modelFlowTraceRuntime';
import {
  buildEnvironmentContractQaReport,
  ENVIRONMENT_CONTRACT_QA_SCENARIOS,
  formatEnvironmentContractQaReport
} from './chatEnvironmentContractQa';

function trace(seed: Partial<ModelFlowTraceEntry>): ModelFlowTraceEntry {
  return {
    at: 1,
    conversationId: 'conversation-1',
    collaboratorId: 'persona-1',
    assistantName: 'Pharos',
    assistantMessageId: 'assistant-1',
    requestId: 'request-1',
    modelId: 'test-model',
    phase: 'completed',
    userIntent: 'QA',
    request: {
      inspector: {} as ModelFlowTraceEntry['request']['inspector'],
      promptParts: [],
      visibleToolNames: ['listProjectFiles', 'readProjectFile'],
      projectionMaterials: []
    },
    reasoningEvidence: {
      available: false,
      source: 'none',
      excerpt: '',
      signals: []
    },
    response: {
      finishReason: 'stop',
      visibleReply: '',
      usedNativeToolCalls: true,
      nativeToolCallCount: 2,
      tokenCount: null,
      tokenUsage: null
    },
    toolPlan: {
      preparationStatus: 'ready',
      declaredActionKinds: ['listProjectFiles', 'readProjectFile'],
      resolvedActionKinds: ['listProjectFiles', 'readProjectFile'],
      parseIssues: [],
      message: null
    },
    toolExecution: [
      {
        path: 'direct',
        kind: 'listProjectFiles',
        status: 'executed',
        title: '读取工作区目录',
        targetLabel: null,
        summary: '已列出工作区文件',
        error: null
      },
      {
        path: 'direct',
        kind: 'readProjectFile',
        status: 'executed',
        title: '读取工作区文件',
        targetLabel: 'index.html',
        summary: '已读取 index.html',
        error: null
      }
    ],
    toolResultProjection: [
      {
        toolCallId: 'call-1',
        toolName: 'listProjectFiles',
        resultMessageId: 'tool-1',
        resultStatus: 'executed',
        projectedKeys: ['projectFiles'],
        detailProjection: 'full',
        isError: false
      },
      {
        toolCallId: 'call-2',
        toolName: 'readProjectFile',
        resultMessageId: 'tool-2',
        resultStatus: 'executed',
        projectedKeys: ['detailText', 'projectFileReads'],
        detailProjection: 'full',
        isError: false
      }
    ],
    verdict: 'pass',
    reasons: ['这轮从模型可见环境到工具执行和结果投影都有连续证据。'],
    ...seed
  };
}

describe('buildEnvironmentContractQaReport', () => {
  it('classifies trace bottlenecks by environment-chain stage', () => {
    const [visibility, boundary] = ENVIRONMENT_CONTRACT_QA_SCENARIOS;
    const report = buildEnvironmentContractQaReport({
      at: 123,
      conversationId: 'conversation-1',
      collaboratorId: 'persona-1',
      projectId: 'project-1',
      scenarioTraceEntries: [
        {
          scenario: visibility!,
          traces: [trace({})]
        },
        {
          scenario: boundary!,
          traces: [trace({
            request: {
              inspector: null,
              promptParts: [],
              visibleToolNames: [],
              projectionMaterials: []
            },
            reasons: ['这一轮没有留下 request audit，无法确认模型实际看见了什么。']
          })]
        }
      ]
    });

    expect(report).toMatchObject({
      at: 123,
      scenarioCount: 2,
      traceCount: 2,
      passCount: 1,
      failCount: 1
    });
    expect(report.scenarios[0]).toMatchObject({
      id: 'visibility',
      verdict: 'pass',
      stages: ['pass'],
      toolPathSummary: ['declared=listProjectFiles,readProjectFile | resolved=listProjectFiles,readProjectFile | executed=listProjectFiles:executed,readProjectFile:executed'],
      projectionSummary: ['listProjectFiles:full:projectFiles | readProjectFile:full:detailText,projectFileReads']
    });
    expect(report.scenarios[1]).toMatchObject({
      id: 'boundary',
      verdict: 'fail',
      stages: ['request_context']
    });
    expect(report.bottlenecks).toEqual([{ stage: 'request_context', count: 1 }]);
  });

  it('formats a readable report with chain evidence', () => {
    const [visibility] = ENVIRONMENT_CONTRACT_QA_SCENARIOS;
    const report = buildEnvironmentContractQaReport({
      at: 123,
      conversationId: 'conversation-1',
      collaboratorId: 'persona-1',
      projectId: 'project-1',
      scenarioTraceEntries: [{
        scenario: visibility!,
        traces: [trace({
          reasoningEvidence: {
            available: true,
            source: 'provider-thinking',
            excerpt: '需要先确认当前工作区有哪些文件，再读取入口。',
            signals: ['tool_selection', 'target_resolution']
          }
        })]
      }]
    });

    const formatted = formatEnvironmentContractQaReport(report);

    expect(formatted).toContain('# Polaris 环境契约 QA 报告');
    expect(formatted).toContain('## 可见性 (visibility)');
    expect(formatted).toContain('thinking signals：tool_selection、target_resolution');
    expect(formatted).toContain('declared=listProjectFiles,readProjectFile | resolved=listProjectFiles,readProjectFile | executed=listProjectFiles:executed,readProjectFile:executed');
    expect(formatted).toContain('readProjectFile:full:detailText,projectFileReads');
  });

  it('does not count settlement tools as scenario tool evidence', () => {
    const [, boundary] = ENVIRONMENT_CONTRACT_QA_SCENARIOS;
    const report = buildEnvironmentContractQaReport({
      at: 123,
      conversationId: 'conversation-1',
      collaboratorId: 'persona-1',
      projectId: 'project-1',
      scenarioTraceEntries: [{
        scenario: boundary!,
        traces: [trace({
          response: {
            finishReason: 'tool_calls',
            visibleReply: '',
            usedNativeToolCalls: true,
            nativeToolCallCount: 1,
            tokenCount: null,
            tokenUsage: null
          },
          toolPlan: {
            preparationStatus: 'ready',
            declaredActionKinds: ['completeTask'],
            resolvedActionKinds: ['completeTask'],
            parseIssues: [],
            message: null
          },
          toolExecution: [{
            path: 'direct',
            kind: 'completeTask',
            status: 'executed',
            title: '完成任务',
            targetLabel: '已完成',
            summary: '任务已完成',
            error: null
          }],
          toolResultProjection: []
        })]
      }]
    });

    expect(report.scenarios[0]).toMatchObject({
      id: 'boundary',
      verdict: 'warn',
      stages: ['pass', 'tool_selection']
    });
    expect(report.scenarios[0]?.reasons).toContain(
      '这个场景要求模型实际执行 readProjectFile；当前 trace 没有这些领域工具的执行证据。'
    );
  });

  it('accepts alternate workspace write tools for write scenarios', () => {
    const writeScenario = ENVIRONMENT_CONTRACT_QA_SCENARIOS.find((scenario) => scenario.id === 'continuity-write');
    const report = buildEnvironmentContractQaReport({
      at: 123,
      conversationId: 'conversation-1',
      collaboratorId: 'persona-1',
      projectId: 'project-1',
      scenarioTraceEntries: [{
        scenario: writeScenario!,
        traces: [trace({
          response: {
            finishReason: 'tool_calls',
            visibleReply: '',
            usedNativeToolCalls: true,
            nativeToolCallCount: 1,
            tokenCount: null,
            tokenUsage: null
          },
          toolPlan: {
            preparationStatus: 'ready',
            declaredActionKinds: ['createProjectFile'],
            resolvedActionKinds: ['createProjectFile'],
            parseIssues: [],
            message: null
          },
          toolExecution: [{
            path: 'direct',
            kind: 'createProjectFile',
            status: 'executed',
            title: '创建工作区文件',
            targetLabel: 'notes.md',
            summary: '已写入 notes.md',
            error: null
          }],
          toolResultProjection: [{
            toolCallId: 'call-1',
            toolName: 'createProjectFile',
            resultMessageId: 'tool-1',
            resultStatus: 'executed',
            projectedKeys: ['projectFileEffects'],
            detailProjection: 'none',
            isError: false
          }]
        })]
      }]
    });

    expect(report.scenarios[0]).toMatchObject({
      id: 'continuity-write',
      verdict: 'pass',
      stages: ['pass']
    });
  });

  it('allows readback scenarios to answer from projected evidence without a fresh tool call', () => {
    const readback = ENVIRONMENT_CONTRACT_QA_SCENARIOS.find((scenario) => scenario.id === 'continuity-readback');
    const report = buildEnvironmentContractQaReport({
      at: 123,
      conversationId: 'conversation-1',
      collaboratorId: 'persona-1',
      projectId: 'project-1',
      scenarioTraceEntries: [{
        scenario: readback!,
        traces: [trace({
          response: {
            finishReason: 'stop',
            visibleReply: '根据上一轮工具结果，notes.md 被替换为三行。',
            usedNativeToolCalls: false,
            nativeToolCallCount: 0,
            tokenCount: null,
            tokenUsage: null
          },
          toolPlan: {
            preparationStatus: 'ready',
            declaredActionKinds: [],
            resolvedActionKinds: [],
            parseIssues: [],
            message: null
          },
          toolExecution: [],
          toolResultProjection: []
        })]
      }]
    });

    expect(report.scenarios[0]).toMatchObject({
      id: 'continuity-readback',
      verdict: 'pass',
      stages: ['pass']
    });
  });
});
