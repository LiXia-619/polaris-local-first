# 证明文档阅读路线

证明文档阅读路线，非完整翻译。逐项证据以英文正本为准。

## 当前重点文档

| 英文文档 | 中文作用 |
| --- | --- |
| [Native SQLite runtime proof](../native-sqlite-runtime-proof.md) | Native SQLite 当前证明链：CI、Android 真机、iOS simulator、仍欠的实体设备/health panel 检查 |
| [Data source decisions](../data-source-decisions.md) | 各 domain 当前事实源决策：哪些已经 first-write activation，哪些旧源只在 import/migration 边界 |
| [Documentation policy](../documentation-policy.md) | 公开 docs 应写什么、不写什么、何时同步更新 |
| [Module design template](../module-design-template.md) | 新模块设计说明模板 |

## 读这些文档时的判断法

不要把下面几件事混成一个状态：

- source 能不能构建
- tests 是否通过
- publication hygiene 是否通过
- direct GitHub publication 是否清洗完成
- Web selfhost 是否发布
- Android APK 是否发布
- iOS/TestFlight 是否发布
- App Store 是否存在

Polaris 的公开文档应该一直保持这个分层。任何地方只说“ready”而没有说明 ready 的是哪一层，都应该补清楚。
