# OpenFloorPlan

一个本地优先、无需账号的 2D/3D 户型设计器。

OpenFloorPlan 让用户直接在浏览器中绘制墙体、房间、门窗和家具，并实时查看 3D 预览。项目不要求后端、不上传设计文件，适合快速规划房间布局、制作平面草图和分享可复现的 JSON 项目文件。

## 功能

- 2D 画布：墙体、房间、门、窗和尺寸标注
- 家具库：床、沙发、餐桌、衣柜、厨卫和常用家电
- 3D 实时预览，以及 2D/3D 分屏模式
- JSON 项目保存和载入
- SVG 平面图导出
- 键盘快捷键：`V` 选择、`W` 墙、`D` 门、`F` 窗、`R` 房间、`M` 标注、`Delete` 删除、`1/2/3` 切换视图

## 本地运行

需要 Python 3.10+。

```powershell
cd D:\codex\products\home-designer
python serve.py
```

然后打开 `http://localhost:8080/`。也可以使用任意静态文件服务器提供项目根目录。

项目当前通过 jsDelivr 加载 Three.js 0.160.0；如果需要完全离线部署，请将对应版本放入 `js/vendor/three.min.js`，并把 `index.html` 中的 CDN 引用替换为本地路径。

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

## 许可证

MIT，见 `LICENSE`。
