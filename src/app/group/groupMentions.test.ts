import { describe, expect, it } from 'vitest';
import { extractMentions } from './groupMentions';

const MEMBERS = [
  { id: 'pm', name: '北辰' },
  { id: 'fe', name: '小助' },
  { id: 'be', name: '小助手' }
];

describe('extractMentions', () => {
  it('returns empty when nothing is mentioned', () => {
    expect(extractMentions('今天先对一下接口', MEMBERS)).toEqual([]);
  });

  it('finds a single mention', () => {
    expect(extractMentions('@北辰 需求文档发一下', MEMBERS).map((m) => m.id)).toEqual(['pm']);
  });

  it('finds multiple mentions in one message', () => {
    const hits = extractMentions('@北辰 拆完任务后 @小助手 先定接口', MEMBERS).map((m) => m.id);
    expect(hits).toEqual(['pm', 'be']);
  });

  it('returns mentions in the order they appear in the message', () => {
    const hits = extractMentions('@小助手 先看接口，@北辰 等下补目标', MEMBERS).map((m) => m.id);
    expect(hits).toEqual(['be', 'pm']);
  });

  it('prefers the longest name when one name prefixes another', () => {
    // @小助手 不应该同时命中「小助」
    expect(extractMentions('这块 @小助手 来接', MEMBERS).map((m) => m.id)).toEqual(['be']);
  });

  it('still matches the shorter name on its own', () => {
    expect(extractMentions('@小助 页面那边你看下', MEMBERS).map((m) => m.id)).toEqual(['fe']);
  });

  it('excludes the speaker themselves', () => {
    expect(extractMentions('我 @小助手 自己再确认一遍', MEMBERS, 'be')).toEqual([]);
  });

  it('handles repeated mentions without duplicates', () => {
    expect(extractMentions('@北辰 @北辰 在吗', MEMBERS).map((m) => m.id)).toEqual(['pm']);
  });
});
