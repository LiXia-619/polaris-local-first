# Import And Export

## Purpose

Import/export 通过显式、可验证边界，把用户控制的 package 移入或移出当前数据模型。

## Owns

- Package import。
- Package export。
- Import diagnostics。
- Migration checks。
- Data validation。
- Rollback safety。

## Does Not Own

- Ordinary startup truth。
- Ordinary save paths。
- Placeholder replacement data。
- Old-user in-place upgrade promises。

## Contract

导入不是普通启动的一部分。旧数据进入当前系统必须经过：

1. 读取 package。
2. 验证结构和完整性。
3. 迁移到当前 domain rows。
4. 报告诊断和失败状态。
5. 通过当前 repository path 重新读出。

Export 只导出当前事实，不复活退休 store。

## Failure States

- Package body 缺失或不完整。
- Owner/link/reference 对不上。
- Asset metadata 和 blob payload 缺一边。
- Migration 成功写入但 readback 不能证明。
- 导入边界污染 ordinary startup。
