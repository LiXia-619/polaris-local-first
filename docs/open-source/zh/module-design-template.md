# 模块设计模板

新增模块说明时使用这个结构。写当前责任边界。

```md
# Module Name

## Purpose

这个模块为什么存在。

## Owns

- 它负责的产品行为。
- 它拥有的状态或边界。
- 它必须维护的用户/模型可见合同。

## Does Not Own

- 它不能负责的行为。
- 它不应该越界写入的存储或语义。
- 它不应该替别的模块做的决定。

## Main Entrypoints

- `src/...`
- `docs/...`

## Data It Reads

- 它读取哪些当前事实。
- 哪些材料只是 projection 或 directory。

## Data It Writes

- 它写哪些持久事实。
- 它产生哪些投影或证据。

## Important Failure States

- 缺失、未加载、不完整、超时、删除、权限不足等状态。
- 哪些失败必须被用户或模型看见。

## Tests And Verification

- 相关 npm script。
- 关键测试文件。
- 必要人工 gate。

## Known Cleanup Still Owed

- 当前已知责任混杂。
- 未来拆分方向。
```

## 原则

- 先写 owner，再写路径。
- 先写当前事实，不写愿望。
- 不用“临时兼容”包装已经退休的旧路径。
- Release-channel 状态单独说，不混进 source readiness。
