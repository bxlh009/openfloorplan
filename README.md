# OpenFloorPlan

一个本地优先、无需账号的 2D/3D 户型设计器。

Current version: `0.2.0`

OpenFloorPlan 让用户直接在浏览器中绘制墙体、房间、门窗和家具，并实时查看 3D 预览。项目不要求后端、不上传设计文件，适合快速规划房间布局、制作平面草图和分享可复现的 JSON 项目文件。

## 功能

- 2D 画布：墙体、房间、门、窗和尺寸标注
- 家具库：床、沙发、餐桌、衣柜、厨卫和常用家电
- 3D 实时预览，以及 2D/3D 分屏模式
- JSON 项目保存和载入
- SVG 平面图导出
- 中文 / English 双语界面：点击右上角 `EN` / `中文` 切换，语言偏好保存在浏览器
- 键盘快捷键：`V` 选择、`W` 墙、`D` 门、`F` 窗、`R` 房间、`M` 标注、`Delete` 删除、`1/2/3` 切换视图

## 本地运行

需要 Python 3.10+。

```powershell
cd D:\codex\products\home-designer
python serve.py
```

然后打开 `http://localhost:8080/`。也可以使用任意静态文件服务器提供项目根目录。

项目将 Three.js 0.160.0 固定在 `js/vendor/three.min.js`，因此下载仓库后可以离线运行。许可信息见 `THIRD_PARTY_NOTICES.md`。

## 项目结构

```text
index.html       页面结构和工具栏
css/style.css    界面样式
js/state.js      项目状态和 JSON 序列化
js/draw2d.js     2D 画布渲染
js/view3d.js     Three.js 3D 预览
js/tools.js      鼠标和键盘交互
js/ui.js         属性面板、文件操作和视图切换
js/app.js        应用启动
js/i18n.js       中文 / English 界面文案与语言切换
js/vendor/       固定的第三方运行时依赖
serve.py         本地开发服务器
```

## 数据与隐私

设计数据只在浏览器内处理。保存和载入使用用户主动选择的 JSON 文件；项目没有账号系统、云端数据库或遥测服务。

## 开发与验证

提交前运行：

```powershell
python -m py_compile serve.py
node --check js/state.js
node --check js/draw2d.js
node --check js/view3d.js
node --check js/tools.js
node --check js/ui.js
node --check js/app.js
```

## 贡献

请阅读 `CONTRIBUTING.md`。不要提交真实住址、个人户型图或其他敏感资料。

## 示例项目

`examples/studio-apartment.json` 是一个可直接载入的示例户型。启动本地服务器后，点击“载入”选择该文件即可。

## 许可证

MIT，见 `LICENSE`。
