import { describe, expect, it, vi } from 'vitest';
import {
  requestMiniMaxVoiceCatalog,
  requestMiniMaxVoiceDesign
} from './miniMaxVoiceManagementClient';

const voiceSettings = {
  enabled: true,
  providerType: 'minimax' as const,
  baseUrl: 'https://api.example.com/v1',
  path: '/t2a_v2',
  apiKey: 'sk-test',
  model: 'speech-2.8-turbo',
  voice: 'Chinese (Mandarin)_Warm_Girl',
  format: 'mp3' as const
};

describe('miniMaxVoiceManagementClient', () => {
  it('lists MiniMax account voices', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      system_voice: [{
        voice_id: 'Chinese (Mandarin)_Warm_Girl',
        description: ['warm girl']
      }],
      voice_generation: [{
        voice_id: 'ttv-voice-custom',
        description: ['gentle companion'],
        created_time: '2026-06-19'
      }],
      base_resp: {
        status_code: 0
      }
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }));

    const voices = await requestMiniMaxVoiceCatalog({
      settings: voiceSettings,
      fetchImpl: fetchMock as typeof fetch
    });

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/v1/get_voice', expect.objectContaining({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-test'
      }
    }));
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(requestInit?.body))).toEqual({ voice_type: 'all' });
    expect(voices).toEqual(expect.arrayContaining([
      expect.objectContaining({
        providerType: 'minimax',
        voice: 'Chinese (Mandarin)_Warm_Girl',
        source: 'minimax-system',
        label: 'warm girl'
      }),
      expect.objectContaining({
        providerType: 'minimax',
        voice: 'ttv-voice-custom',
        source: 'minimax-generation',
        label: 'gentle companion'
      })
    ]));
  });

  it('reports pasted non-header characters in the MiniMax API key before fetch', async () => {
    const fetchMock = vi.fn<typeof fetch>();

    await expect(requestMiniMaxVoiceCatalog({
      settings: {
        ...voiceSettings,
        apiKey: 'sk-test备注'
      },
      fetchImpl: fetchMock as typeof fetch
    })).rejects.toThrow('MiniMax API Key 里包含 HTTP 请求头不能发送的字符');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('designs a MiniMax voice and decodes the trial audio', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      voice_id: 'custom_voice',
      trial_audio: '70726576696577',
      base_resp: {
        status_code: 0
      }
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }));

    const result = await requestMiniMaxVoiceDesign({
      settings: voiceSettings,
      prompt: '温柔清亮的陪伴女声',
      previewText: '你好呀。',
      voiceId: 'custom_voice',
      fetchImpl: fetchMock as typeof fetch
    });

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/v1/voice_design', expect.objectContaining({
      method: 'POST'
    }));
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      prompt: '温柔清亮的陪伴女声',
      preview_text: '你好呀。',
      voice_id: 'custom_voice'
    });
    expect(result.voiceId).toBe('custom_voice');
    expect(result.mimeType).toBe('audio/mpeg');
    expect(await result.blob.text()).toBe('preview');
  });
});
