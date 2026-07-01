import { describe, expect, it } from 'vitest';
import {
  buildMemoryRecallCorpusAnchorStats,
  extractMemoryRecallAnchors
} from './memoryRecallAnchors';

describe('extractMemoryRecallAnchors', () => {
  it('keeps preset relationship and model anchors', () => {
    expect(extractMemoryRecallAnchors('妈妈刚才提到 Claude 和 Polaris')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ term: '妈妈', source: 'preset' }),
        expect.objectContaining({ term: 'claude', source: 'preset' }),
        expect.objectContaining({ term: 'polaris', source: 'preset' })
      ])
    );
  });

  it('promotes repeated user-corpus terms into grown anchors', () => {
    const stats = buildMemoryRecallCorpusAnchorStats([
      { conversationId: 'a', text: '小饼干今天又出现了，小饼干要放进记忆。' },
      { conversationId: 'b', text: '小饼干和模型召回也聊过一次。' }
    ]);

    expect(extractMemoryRecallAnchors('小饼干怎么处理', stats)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ term: '小饼干', source: 'corpus' })
      ])
    );
  });
});
