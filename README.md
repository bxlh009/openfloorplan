# OpenFloorPlan

一个本地优先、无需账号的 2D/3D 户型设计器。

Current version: `0.5.0`

在线 Demo：由 GitHub Pages 从 `main` 分支自动部署；部署成功后访问 `https://bxlh009.github.io/openfloorplan/`。

OpenFloorPlan 让用户直接在浏览器中绘制墙体、房间、门窗和家具，并实时查看 3D 预览。项目不要求后端、不上传设计文件，适合快速规划房间布局、制作平面草图和分享可复现的 JSON 项目文件。

## 功能

- 2D 画布：墙体、房间、门、窗和尺寸标注
- 八步建房流程导航：项目、楼层、结构、通行采光、房间、材质、现代装修、检查输出
- 正式多楼层数据：新增、切换、复制楼层；构件按楼层隔离编辑，旧 JSON 自动迁移到 1F
- 直跑楼梯连接相邻楼层，在 2D/3D 同步表达并可调整宽度、长度、级数和方向
- 每层独立选择木地板、瓷砖或微水泥；现代等整屋风格继续联动家具、墙面和灯光
- 家具库：床、沙发、餐桌、衣柜、厨卫和常用家电
- 家具支持中英文搜索、空间分类和无结果提示
- 3D 实时预览，以及 2D/3D 分屏模式
- 3D 可在“整栋楼”和“当前层”之间切换；整栋模式按真实标高叠放所有楼层并自动取景
- JSON 项目保存和载入
- 修改后自动保存到当前浏览器，并在重新打开页面时恢复；JSON 导出仍用于备份和跨设备迁移
- 现代、北欧、日式、侘寂、工业、美式六套本地装修风格，联动墙面、地板、家具与灯光
- 门窗在 3D 墙体上生成真实开洞
- 3D 默认剖切近侧墙，可一键切回完整外观；门扇与 2D 开启方向一致
- 家具可在 2D 直接选择；3D 中双击家具选中，拖动已选家具会实时同步到 2D 并支持撤销
- 家具和楼梯在放置及 2D/3D 拖动时可吸附墙边、相邻物件边缘/中心线和附近网格，并显示参考线；可随时关闭自动吸附
- 标注工具提供起点、终点和实时长度预览；门窗可调整尺寸、离地高度和沿墙位置
- 室内风格与建筑构件风格独立：家具比例、门型、窗格、踢脚线和顶线会改变几何
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
js/project.js    JSON v3、楼层/楼梯、旧文件迁移、撤销事务和装修风格数据
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

设计数据只在浏览器内处理。修改后的项目会自动保存在当前浏览器的本地存储中，保存和载入 JSON 文件可用于备份与迁移；项目没有账号系统、云端数据库或遥测服务。清除浏览器站点数据会删除自动保存的草稿，因此重要项目仍应导出 JSON 备份。

本工具用于空间布局和装修概念设计，不执行结构计算、消防审查、当地建筑规范校验、报批或施工图设计。楼梯和楼层默认值必须由当地专业人员复核后才能用于施工。

## 开发与验证

提交前运行：

```powershell
node --test tests/*.test.js
node --check js/project.js
python -m py_compile serve.py
node --check js/state.js
node --check js/draw2d.js
node --check js/view3d.js
node --check js/tools.js
node --check js/ui.js
node --check js/app.js
node --check js/i18n.js
```

## 贡献

请阅读 `CONTRIBUTING.md`。不要提交真实住址、个人户型图或其他敏感资料。

## 示例项目

`examples/studio-apartment.json` 是一个可直接载入的示例户型。启动本地服务器后，点击“载入”选择该文件即可。

## 许可证

MIT，见 `LICENSE`。
