export function assertHttpHeaderValue(value: string, label: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code > 0xff || code === 0x7f || code < 0x20) {
      throw new Error(`${label} 里包含 HTTP 请求头不能发送的字符。请重新复制纯文本 API Key，去掉中文、全角符号、emoji、零宽空格或备注。`);
    }
  }
}
