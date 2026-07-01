import { buildMemorySegmentLines, buildWeightedMemoryLines } from '../memoryEngine';
import type { PersonaMemorySettings } from '../../types/domain';
import { estimateTextTokens } from './requestTokenEstimation';

export type AssistantMemoryLineDecision = {
  text: string;
  estimatedTokens: number;
  status: 'kept' | 'dropped_budget';
};

export type AssistantRequestMemoryPlan = {
  selectedLines: string[];
  estimatedTokens: number;
  maxTokens: number | null;
  status: 'empty' | 'within_budget' | 'trimmed_budget';
  entries: AssistantMemoryLineDecision[];
};

export type InheritedMemorySource = {
  id: string;
  memory: PersonaMemorySettings;
};

function estimateMemorySegmentTokens(lines: string[]) {
  if (!lines.length) return 0;
  return estimateTextTokens([
    '以下是当前协作者可调用的长期记忆线索。',
    '只在相关时自然使用，不要逐条复述，也不要把它们说成系统说明。',
    ...buildMemorySegmentLines(lines)
  ].join('\n'));
}

export function resolveRequestMemoryPlan(args: {
  memory?: PersonaMemorySettings;
  inheritedMemorySources?: InheritedMemorySource[];
  maxTokens: number | null;
}): AssistantRequestMemoryPlan {
  const inheritedLines = args.memory?.inheritGlobal === false
    ? []
    : (args.inheritedMemorySources ?? [])
        .filter((source) => !args.memory?.excludedGlobalIds.includes(source.id))
        .filter((source) => source.memory.excludeFromGlobal !== true)
        .flatMap((source) => source.memory.personalMemories);
  const weightedLines = buildWeightedMemoryLines([
    ...(args.memory?.personalMemories ?? []),
    ...inheritedLines
  ].map((line) => line.trim()).filter(Boolean));
  if (!weightedLines.length) {
    return {
      selectedLines: [],
      estimatedTokens: 0,
      maxTokens: args.maxTokens,
      status: 'empty',
      entries: []
    };
  }

  if (args.maxTokens === null) {
    return {
      selectedLines: weightedLines,
      estimatedTokens: estimateMemorySegmentTokens(weightedLines),
      maxTokens: null,
      status: 'within_budget',
      entries: weightedLines.map((text) => ({
        text,
        estimatedTokens: estimateTextTokens(text),
        status: 'kept'
      }))
    };
  }

  const selectedLines: string[] = [];
  const entries: AssistantMemoryLineDecision[] = [];

  for (const line of weightedLines) {
    const nextLines = [...selectedLines, line];
    const nextTokens = estimateMemorySegmentTokens(nextLines);
    if (selectedLines.length > 0 && nextTokens > args.maxTokens) {
      entries.push({
        text: line,
        estimatedTokens: estimateTextTokens(line),
        status: 'dropped_budget'
      });
      continue;
    }

    selectedLines.push(line);
    entries.push({
      text: line,
      estimatedTokens: estimateTextTokens(line),
      status: 'kept'
    });
  }

  return {
    selectedLines,
    estimatedTokens: estimateMemorySegmentTokens(selectedLines),
    maxTokens: args.maxTokens,
    status: entries.some((entry) => entry.status === 'dropped_budget') ? 'trimmed_budget' : 'within_budget',
    entries
  };
}
