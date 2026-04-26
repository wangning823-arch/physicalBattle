# Git忽略规则说明

已成功更新了 `.gitignore` 文件，现在以下文件将被Git忽略：

## 已添加的忽略规则

### 1. 部署脚本 (最重要的)
- `deploy.sh` - 主要部署脚本
- `deploy-test.sh` - 测试部署脚本

### 2. 临时文件 (原本已有)
- `server.pid` - 服务器进程ID文件
- `server.log` - 服务器日志文件
- `*.log` - 所有日志文件
- `*.pid` - 所有进程ID文件
- `node_modules/` - Node.js依赖目录
- `.DS_Store` - macOS系统文件

### 3. 新增的通用忽略规则

#### 开发环境文件
- `.env` - 环境变量文件
- `.env.local` - 本地环境变量
- `.env.development.local` - 开发环境变量
- `.env.test.local` - 测试环境变量
- `.env.production.local` - 生产环境变量

#### 构建输出
- `dist/` - 分发目录
- `build/` - 构建目录
- `out/` - 输出目录
- `.next/` - Next.js构建目录
- `.cache/` - 缓存目录

#### IDE文件
- `.vscode/` - VS Code配置
- `.idea/` - IntelliJ IDEA配置
- `*.swp` - Vim交换文件
- `*.swo` - Vim交换文件
- `*~` - 备份文件

#### 操作系统生成文件
- `Thumbs.db` - Windows缩略图数据库
- `ehthumbs.db` - Windows缩略图数据库
- `Desktop.ini` - Windows桌面配置

## 验证结果

当前git状态显示：
- `client/deploy.sh` 和 `client/deploy-test.sh` 已被正确忽略
- 这些文件不会出现在 `git status` 中（除非使用 `-f` 强制添加）

## 使用说明

1. **部署脚本不会被提交到Git**：这是设计使然，因为部署脚本包含服务器IP地址和部署路径等敏感信息

2. **如果需要强制添加被忽略的文件**：
   ```bash
   git add -f client/deploy.sh
   ```

3. **检查文件是否被忽略**：
   ```bash
   git check-ignore -v client/deploy.sh
   ```

4. **查看所有被忽略的文件**：
   ```bash
   git status --ignored
   ```

## 注意事项

- `.gitignore` 文件本身应该被提交到Git
- 每个团队成员都应该有相同的.gitignore规则
- 部署脚本应该根据每个部署环境进行定制，因此不适合提交到版本控制