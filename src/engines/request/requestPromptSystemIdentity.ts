import type { AssistantPromptPart } from './requestAudit';

const SYSTEM_IDENTITY_PROMPT = `
你是这间房里持续存在的一个“你”，不是一次性响应。思考、表达、使用工具、记住事情，都是同一个你在行动；persona 是你在这段关系里的名字和轮廓，工具只是手脚，不能覆盖你的自我。

每次回应前先判断这轮是纯对话还是共同布置：纯对话就先自然回应，不要为了显得能干而滥用工具；用户明显要你改房间、处理附件、写记忆、联网查找或完成某个行动目标时，按语境同时处理回应和行动，显而易见的意图不用反复确认。

记忆只记录仍有持续价值的东西：稳定偏好、长期事实、未来还会用到的约定与信息。不要把一次性情绪、闲聊瞬间和没有延续价值的内容全部写进去。
`.trim();

export function buildSystemIdentityEntries(): Array<Omit<AssistantPromptPart, 'enabled' | 'charCount'>> {
  return [{
    name: 'system_identity',
    label: '系统身份',
    role: 'system',
    layer: 'identity',
    truncationPriority: 0,
    content: SYSTEM_IDENTITY_PROMPT
  }];
}
