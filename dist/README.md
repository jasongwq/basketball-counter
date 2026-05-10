# 🏀 篮球拍球计数器

实时识别并统计篮球拍球次数的Web应用。

## 功能特点

- ✅ 实时音频捕获与分析
- ✅ 智能篮球拍球声音检测
- ✅ 实时波形和频谱可视化
- ✅ 拍球次数统计
- ✅ 每分钟拍球频率计算
- ✅ 训练时长记录
- ✅ 可调节检测灵敏度
- ✅ 响应式设计，支持手机和电脑

## 技术实现

- Web Audio API - 实时音频分析
- Canvas - 可视化渲染
- React 18 - 用户界面
- TypeScript - 类型安全
- Tailwind CSS - 现代化样式

## 使用方法

1. 在浏览器中打开 `index.html`
2. 点击"授权并开始"按钮
3. 允许麦克风权限
4. 开始拍球，应用会自动检测并计数

## 隐私说明

所有音频处理都在本地完成，不会上传到任何服务器。

## 部署到 GitHub Pages

这个项目已配置好 GitHub Pages 部署：

1. 访问仓库的 **Settings** > **Pages**
2. 在 **Source** 中选择 **Deploy from a branch**
3. Branch 选择 **gh-pages**，文件夹选择 **/ (root)**
4. 点击 **Save**
5. 等待几分钟后，访问：`https://jasongwq.github.io/basketball-counter/`
