const CJK_RECALL_STOPWORDS = new Set([
  '我',
  '你',
  '他',
  '她',
  '它',
  '们',
  '咱',
  '我们',
  '你们',
  '他们',
  '她们',
  '它们',
  '我的',
  '你的',
  '他的',
  '她的',
  '它的',
  '这',
  '那',
  '这个',
  '那个',
  '这些',
  '那些',
  '这里',
  '那里',
  '哪',
  '哪个',
  '哪里',
  '谁',
  '啥',
  '么',
  '个',
  '的',
  '了',
  '呢',
  '吗',
  '吧',
  '啊',
  '呀',
  '哦',
  '哈',
  '和',
  '与',
  '及',
  '或',
  '在',
  '是',
  '有',
  '就',
  '都',
  '也',
  '还',
  '很',
  '更',
  '最',
  '要',
  '会',
  '能',
  '把',
  '被',
  '让',
  '给',
  '对',
  '从',
  '到',
  '上',
  '下',
  '里'
]);

const ASCII_RECALL_STOPWORDS = new Set([
  'i',
  'me',
  'my',
  'mine',
  'you',
  'your',
  'yours',
  'he',
  'him',
  'his',
  'she',
  'her',
  'hers',
  'it',
  'its',
  'we',
  'us',
  'our',
  'ours',
  'they',
  'them',
  'their',
  'theirs',
  'this',
  'that',
  'these',
  'those',
  'what',
  'which',
  'who',
  'and',
  'or',
  'but',
  'the',
  'a',
  'an',
  'to',
  'of',
  'in',
  'on',
  'for',
  'with',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been'
]);

export function normalizeMemoryRecallTerm(term: string) {
  return term.trim().normalize('NFKC').toLowerCase();
}

export function isMemoryRecallStopword(term: string) {
  const normalized = normalizeMemoryRecallTerm(term);
  if (!normalized) return true;
  if (CJK_RECALL_STOPWORDS.has(normalized)) return true;
  return ASCII_RECALL_STOPWORDS.has(normalized);
}

export function cjkMemoryRecallNgrams(text: string): string[] {
  const sequences = text.match(/[\u3400-\u9fff]+/g) ?? [];
  const terms: string[] = [];

  for (const sequence of sequences) {
    for (let size = 2; size <= Math.min(4, sequence.length); size += 1) {
      for (let index = 0; index <= sequence.length - size; index += 1) {
        const term = sequence.slice(index, index + size);
        if ([...term].some((char) => isMemoryRecallStopword(char))) continue;
        terms.push(term);
      }
    }
  }

  return terms;
}

export function tokenizeMemoryRecallTerms(text: string) {
  const normalized = text.normalize('NFKC').toLowerCase();
  const asciiTerms = normalized.match(/[a-z0-9_][a-z0-9_.-]{1,}/g) ?? [];
  return Array.from(new Set(filterMemoryRecallTerms([...asciiTerms, ...cjkMemoryRecallNgrams(normalized)])));
}

export function filterMemoryRecallTerms(terms: string[]) {
  return terms.filter((term) => !isMemoryRecallStopword(term));
}
