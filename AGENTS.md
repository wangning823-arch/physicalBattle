# AGENTS.md

## GitHub / 网络

- 本机访问 GitHub 需走本地 SOCKS5 代理，仓库 git 配置已固定：
  - `git config http.proxy socks5h://127.0.0.1:10808`（已写入 `.git/config`，仅本仓库生效）
- 远程仓库：`origin` = `https://github.com/wangning823-arch/physicalBattle.git`
- 凭据已保存在 `.git/credentials`（credential helper 为 `store --file=.git/credentials`），clone/fetch/push 无需再手动提供用户名或 token。
- 若新会话中 `git fetch` / `git push` 失败，先确认代理端口 `10808` 是否仍在监听（v2ray 等客户端可能未开机自启）；不要改回直连。

## 常用操作

```powershell
git fetch origin
git pull
git push   # 使用已保存凭据，经代理推送
```
