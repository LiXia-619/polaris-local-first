# Desktop And Companion

## Purpose

Desktop host 和 companion surfaces 暴露用户拥有的本地权限和可选 companion connectivity。

## Owns

- Desktop workspace sync。
- Companion relay connection。
- Local privileged actions。
- Desktop host 权限边界。

## Does Not Own

- Official public server dependency。
- Cloud account identity。
- Unrelated model behavior。
- Desktop layout selection by itself。

## Boundary

Desktop host 能力通过显式 host bridge 暴露；web、iOS 和 Android surface
继续使用各自的平台桥。
