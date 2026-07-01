# Tools

## Purpose

Tool protocol 让模型可见工具在 prompt、parser、executor、UI evidence 和下一轮 request replay 中保持可靠。

## Owns

- Tool schemas 和 prompt catalog visibility。
- Parser/canonicalizer behavior。
- Execution result semantics。
- Tool result evidence 和 replay projection。
- Tool visibility 与 user toggles/runtime capability 的一致性。

## Does Not Own

- Feature-specific layout。
- Unrelated provider limits。
- Hidden side effects。
- 用户已经关闭的工具组。

## Main Entrypoints

- `src/engines/tool-protocol/`
- Tool executor code。
- Tool UI surfaces。

## Contract

一个工具只有在这条链闭合时才算完成：

- 模型能看见它
- 模型知道什么时候该用
- parser 能解析成正确 action
- executor 能执行真实动作
- UI 能显示发生了什么
- 下一轮 request 能回放必要证据
- 测试能证明链路没断

少一环都不是完整工具。

## Failure States

- Prompt 说有工具，但 native/runtime 不暴露。
- Native/runtime 有工具，但 prompt 没说明清楚。
- 执行成功只显示在 UI，不留下模型下一轮可用证据。
- 工具失败把 malformed payload 或 raw parser snippet 投进后续上下文。
