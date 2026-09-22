# web/ — r20 展示层（portfolio frontend）
TypeScript + React/Vite 展示层。内核（`app/src/**`）零改动、只读复用——外壳 = `app/src/main.js` 承载的一切在 `web/src/engine/**` 用 TS 重写（边界与映射表见 [轮次计划 §2](../curriculum/r20-portfolio-frontend/portfolio-frontend-plan.md)）。
## 运行（待用户执行）
```powershell
cd projects/webgl-path-tracer/web
npm install
npm run typecheck   # tsc --noEmit（strict）
npm run dev         # http://localhost:5174（--strictPort；旧入口 app/ = 5173）
npm run build       # dist/（base: './' 相对路径）
```
- 资产不复制：`vite.config.ts` 的 `publicDir` 指向 `../app/public`（82MB Sponza / 样例模型单一来源）；跨目录导入内核 = alias `@core` → `../app/src` + `server.fs.allow`；GLSL 同源 = `?raw` 导入指向 `app/src/shaders/**` 原文件（不存在两份 shader 漂移）。
## 冒烟自检（每次改动后 30 秒）
```powershell
cd projects/webgl-path-tracer/web
npm run typecheck          # 期望：无输出、退出码 0
npm run dev                # 期望：VITE ready，http://localhost:5174
```
打开 `http://localhost:5174/`，**四件事**对一遍（当前为学习仓档位）。面板文案**中英双语**：场景面板标题行切换（`中文 / English`，localStorage 记忆；默认语言 = 产品档案 `defaultLocale`，学习仓 zh）——下表按中文档对照，英文档为短标签等价文案。

| # | 看什么 | 期望 | 不符时先查 |
|---|---|---|---|
| 1 | 首帧 | **直接出现 cornell 正常渲染**（2026-09-22 起 cornell 为首加载场景）；**不应出现 sponza 的加载等待**（sponza 现在按需加载，启动时不解析） | 默认场景是否被改动 ⇒ `product-profile.ts` 的 `defaultScene` 应为 `'cornell'`；黑屏不出图 ⇒ F-O 的 `loop.paused` 是否走到 `applyScene` 后的 `loop.start()` |
| 2 | 控制台（启动日志） | `[BUG-012] GPU 能力: … maxArrayTextureLayers=2048`；`[r12] scene 'cornell'` 与 `'spheres'` 两条；**`[diag] auto-applied scene 'cornell' debug=0`**。**不应出现 `[r15] scene 'sponza' …`**——它按需加载，首次点它时才构建（那时才该出现该行） | 启动就出现 sponza 构建行 ⇒ `lazyScenes` 少了 `'sponza'`；没有 `[diag]` 行 ⇒ 默认场景没应用 |
| 3 | 场景下拉 | 列出**全部 9 项**：cornell / spheres / sponza / box / duck / damagedhelmet / avocado / lantern / boombox；其中 **sponza 标"（按需加载）"**（2026-09-22 起；英文档 `(on demand)`），其余就绪 | 项数不足 ⇒ `productProfile` 被改成了 `publicProfile`（学习仓必须是 `localProfile`）；sponza 没标按需加载 ⇒ `lazyScenes` 被清空 |
| 4 | 地址栏加 `?gltf=gltf/Box/glTF/Box.gltf` | 加载 Box 模型并切到 `gltf` 场景；控制台 `[r15] gltf 'gltf/Box/glTF/Box.gltf': 12 triangles …` | 提示"已禁用" ⇒ `allowGltf` 被置 false（学习仓应 `true`） |
> 第 3、4 条是**产品档案档位**的判定：学习仓跑 `localProfile`（全场景 / **默认 cornell** / **sponza 按需加载** / 允许 `?gltf=`），公网版跑 `publicProfile`（只留 cornell+sponza / 默认 cornell / sponza 按需 + 空闲预取 / 禁 `?gltf=`）。**2026-09-22 修订**：学习仓默认场景由 sponza 改为 **cornell**（展示门面），并把 sponza 改为按需加载、不预取——打开即出图，录制/演示期间无后台解析。更完整的六条兼容契约自检见下一节「兼容契约自检（C1–C6）」；渲染路径改动后的画面回归见「对拍」一节。
## 产品档案（product profile）
`src/engine/product-profile.ts` 是**产品版与学习仓的全部行为差异收敛点**（r20 决策：产品仓放子目录 `web/`，转移时覆盖本文件）：

| 字段 | 学习仓（默认） | 公网版（转移时覆盖） |
|---|---|---|
| `sceneWhitelist` | `null`（全部场景） | `['cornell','sponza']`（去掉样例模型场景） |
| `defaultScene` | `'cornell'`（2026-09-22 起，展示门面） | `'cornell'`（零资产秒开） |
| `lazyScenes` | `['sponza']`（2026-09-22 起：82 MB 不阻塞启动，下拉标"按需加载"） | `['sponza']`（启动不加载，点击才加载） |
| `prefetchOnIdle` | `null`（学习仓不预取；想让 Sponza 秒切可改回 `'sponza'`） | `'sponza'`（首帧后空闲预取） |
| `allowGltf` | `true` | `false`（禁用 `?gltf=` 诊断入口） |
| `defaultLocale` | `'zh'`（界面中文） | `'en'`（界面英文；用户选择存 localStorage，优先于默认） |
效果：**学习仓与公网版现在都是"打开即 cornell"**；差别只剩场景白名单（学习仓全 9 场景）、`?gltf=` 诊断入口（学习仓开）与空闲预取（公网版预取 sponza）。**其余代码零改动。**
## URL 参数
| 参数 | 作用 |
|---|---|
| （无） | 默认 **cornell** + 正常渲染（`uDebugMode=0`）——2026-09-22 起 cornell 为首加载场景：**打开即出图**，不等待任何资产；sponza 改为按需（点它或 `?scene=sponza` 时才加载并建树） |
| `?scene=<name>` | 指定场景；**不在当前产品档案可用列表里**的名字回退 cornell（该场景被按需加载时，选中即触发下载 → 加载态 → 就绪后自动应用） |
| `?debug=<0-5>` | 调试模式（与 `@core/debug/debug-modes.js` 同表） |
| `?ui=0` | 隐藏面板内容（`#pane-container` 容器保留——采集脚本兼容契约 C2） |
| `?tex=0` / `?tris=N` / `?noatlas=1` / `?gltf=<path>` | 诊断钩子（语义同旧壳 main.js；带 `?gltf=` 时默认 sponza 目标取消） |
## 目录
```
src/
├── main.tsx               入口: 引擎模块级创建（= main.js 模块级语义）+ React 挂载
├── App.tsx                面板容器（?ui=0 → null）
├── engine/                内核适配层（TS 窄接口；移植映射见 plan §2.2）
│   ├── PathTracerEngine.ts   窄接口: setScene/setParam/setCamera/getUiSnapshot/on/dispose
│   ├── scenes.ts             场景束注册表 + ?tris= 截断（main.js:63-158）
│   ├── bundle.ts             makeBundle（main.js:90-125）
│   ├── uniforms.ts           uniform 表 + 占位图集（main.js:160-203）
│   ├── passes.ts             pathtrace quad + 显示 pass（main.js:252-279）
│   ├── loop.ts               双 RT ping-pong + 2×2 分块 + 帧率上限（main.js:43-54/489-541）
│   └── compat.ts             window.__pt 等价面 + URL 参数（main.js:440-487）
├── dev/probe.ts           GPU 读回探针（main.js:281-360 等价，仅诊断）
├── panels/                React 面板（替换 Tweakpane；语义逐个对齐 main.js:380-428）
├── state/store.ts         useSyncExternalStore 轻量 store（零新依赖）
├── i18n/                  messages.ts（中英消息表）+ index.ts（useLocale/t——零依赖 i18n，U1）
└── types/                 kernel.d.ts（内核 JS 模块类型）+ pt.d.ts（window.__pt）
```
## 兼容契约自检（C1–C6，对拍前置）
六条兼容契约（plan §2.3）逐条「一条粘贴即判」。在 `http://localhost:5174/` 的 DevTools Console 粘贴——**注意两种取景口径**：无参数打开 ⇒ READY 后 `__pt.activeScene.name === 'cornell'`（C6 于 2026-09-22 修订）；若要按采集脚本的口径（sponza，`uTriCount ≥ 200000`）就带 `?scene=sponza` 打开：
```js
const pt = window.__pt, u = pt.uniforms, $ = (s) => document.querySelector(s);
console.log('C1', $('#canvas') != null);                                          // 期望 true
$('#pane-container').style.visibility = 'hidden';
console.log('C2a', $('#pane-container').style.visibility);                        // 期望 'hidden'（验完删除该内联样式恢复）
console.log('C2b', new URLSearchParams(location.search).get('ui'));               // 本页 → null；?ui=0 打开 → '0'（面板内容不渲染、容器保留）
console.log('C3', u.uSpp.value, u.uDebugMode.value, u.uTriCount.value,
  $('#canvas').width === u.uResolution.value.x);                                  // 期望 1 0 262267 true（canvas = uResolution = 视口）
console.log('C4', typeof pt.resetAccumulation, typeof pt.renderer.setAnimationLoop,
  pt.activeScene.name);                                                           // 期望 'function' 'function' 'cornell'（?scene=sponza 时为 'sponza'）
console.log('C5', u.uAccumCount.value * u.uSpp.value);                            // 期望 = 该像素已收样本数（2×2 分块一圈 +1，持续增长）
console.log('C6', pt.activeScene.name === 'cornell' && u.uDebugMode.value === 0); // 无参数直接打开 → 期望 true（2026-09-22：默认场景改 cornell，C6 随之修订）
```
- C2 两种隐藏方式都要能过：`visibility='hidden'`（上）与 `?ui=0`（新开 `http://localhost:5174/?ui=0` 验证面板内容不渲染）；C4 冻结验证（可选）= `pt.renderer.setAnimationLoop(null)` 后 `u.uAccumCount.value` 不再增长（验证后刷新恢复）；C5 与采集脚本互证 = `capture-convergence.mjs` 打印的实际 S 应与本式读数逐张一致。
## 对拍（采集协议见 plan §6）
```powershell
# 在 app/ 下执行（脚本复用 + PT_URL 切换目标壳）
$env:PT_URL='http://localhost:5174/?scene=sponza&debug=0&ui=0'; node scripts/capture-convergence.mjs R 1920 1080
node scripts/capture-convergence.mjs B 1920 1080   # 不传 PT_URL = 旧入口 5173（r18 行为零影响）
```
