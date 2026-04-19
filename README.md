# trip_map

一个面向桌面和手机的旅行地图项目。早期只服务于一次 14 天日本行程,现已升级为支持多条行程并存、可创建 / 复制 / 编辑 / 删除的原型产品。

- 行程总览页(Dashboard): `/dashboard`
- 前台地图(单条行程): `/trip?id=<tripId>` 或兼容旧链接 `/`
- 后台编辑页: `/admin?id=<tripId>` 或兼容旧链接 `/admin`
- 后端 API: `/api/*`

默认内置的日本行程(`id = current`)仍然有效,所有历史链接保持兼容。

## 功能总览

### Dashboard(`/dashboard`)

- 按卡片展示所有行程,含名称、目的地、更新时间、景点 / 路线 / 天数
- 顶部操作区:「新建行程」、「复制默认行程」
- 工具栏:搜索(名称 / 目的地 / 描述)+ 排序(最近更新 / 名称 / 景点数 / 创建时间)
- 卡片动作:查看 / 编辑 / 复制 / 删除
- 两种空态:无任何行程时提供 CTA 引导;搜索无匹配时提示换关键字
- 错误态:加载失败时提供重试按钮

### 新建行程

- 模态对话框(原生 `<dialog>` + `::backdrop`),含名称、目的地、描述、起止日期
- 模板选项:「空白」或「基于默认行程」(保留地图配置,景点和路线清空)
- 提交后自动跳转到编辑页

### 复制行程

- 从 Dashboard 卡片、或顶部「复制默认行程」一键复制
- 自动命名为「xxx 副本」、「xxx 副本 2」、「xxx 副本 3」...
- 复制出的副本独立保存,可自由编辑

### 前台地图(`/trip?id=<tripId>`)

- Google Maps 优先,无 Key 时回退 Leaflet + OpenStreetMap
- 景点、路线、每天颜色带完全由行程数据驱动
- PWA: 注册 Service Worker,安装到主屏后可离线继续看行程
- 在线 / 离线状态提示、离线命中缓存提示
- 景点弹窗「下一段路线」快捷跳转

### 后台编辑页(`/admin?id=<tripId>`)

- 可编辑 Meta(标题 / 描述)、景点字段、路线字段、顺序
- Google Places 搜索自动填充(名称、坐标、评分、电话、营业时间)
- GPX / KML 文件批量导入景点
- Google Maps 链接批量粘贴导入
- 照片上传(服务器存储 `/photos/*`,失败自动降级为 base64 内联)
- 操作按钮:保存 / 重新载入 / 用本地 `itinerary.json` 覆盖数据库 / 保存并写回 `itinerary.json`
- 未保存修改时离开页面会有浏览器确认

## 技术栈

- 前端:原生 HTML / CSS / JavaScript(无构建工具、无框架)
- 地图:Google Maps + Leaflet / OpenStreetMap 回退
- 后端:Express 5
- 数据:SQLite(通过 `better-sqlite3` 的内置 driver 间接使用,或在本仓库里用 Node 自带方式持久化 JSON payload)
- 离线:Service Worker + Web Manifest
- 部署:Docker / GHCR / Synology Container Manager

## 项目结构

```text
trip_map/
├── .github/workflows/docker-publish.yml
│
├── server.js                # Express 入口,挂载 /api/* 和静态资源
├── trip-repository.js       # SQLite 仓储层(init / upsert / find / list / delete)
├── trip-service.js          # 业务层(校验、模板、seed、duplicate、summary)
├── trip-template.js         # 空白 payload 模板 + slug 生成
│
├── dashboard.html           # 行程总览页
├── dashboard.css
├── dashboard.js             # Dashboard 交互(列表 / 搜索 / 排序 / 新建 / 复制 / 删除)
│
├── index.html               # 前台地图页
├── styles.css
├── app.js                   # 前台地图逻辑 + Service Worker 注册
├── sw.js                    # Service Worker(静态资源 + 行程 JSON 缓存)
├── manifest.webmanifest     # PWA manifest
│
├── admin.html               # 后台编辑页
├── admin.css
├── admin.js                 # 编辑器交互 + 批量导入 + 照片 + Places
│
├── trip-api.js              # 前端统一 trip API 客户端(dashboard.js / admin.js 共用)
│
├── itinerary.json           # 默认日本行程,作为首次启动 seed 源
├── data/
│   ├── travel-plans.sqlite  # 运行时生成
│   └── photos/              # 景点照片上传目录
│
├── Dockerfile
├── docker-compose.yml
├── docker-compose.ghcr.yml
├── package.json
└── README.md
```

## 本地运行

```bash
cd /path/to/trip_map
npm install
npm start
```

打开:

- `http://127.0.0.1:8080/dashboard`(推荐入口)
- `http://127.0.0.1:8080/` 默认跳到前台地图,打开默认日本行程
- `http://127.0.0.1:8080/admin?id=current` 编辑默认行程

首次启动会自动用 `itinerary.json` seed 出 `id = current` 的默认行程。

## 环境变量

建议本地创建 `.env`:

```env
GOOGLE_MAPS_API_KEY=
GOOGLE_PLACES_API_KEY=
TRIP_MAP_IMAGE=ghcr.io/your-github-name/trip_map:latest
```

- `GOOGLE_MAPS_API_KEY`:运行时注入给前端地图使用,不会写回数据库或 `itinerary.json`
- `GOOGLE_PLACES_API_KEY`:后端调用 Google Places Text Search / Details 时使用,未设置会回退到 `GOOGLE_MAPS_API_KEY`
- `TRIP_MAP_IMAGE`:群晖通过 GHCR 拉镜像时使用

## API 总览

| 方法    | 路径                                     | 说明                          |
| ------- | ---------------------------------------- | ----------------------------- |
| GET     | `/api/health`                            | 健康检查 + 行程数量            |
| GET     | `/api/trips`                             | 列出所有行程(含 summary)    |
| POST    | `/api/trips`                             | 新建行程(支持模板)         |
| GET     | `/api/trips/:id`                         | 行程摘要                       |
| GET     | `/api/trips/:id/full`                    | 行程完整 payload               |
| PUT     | `/api/trips/:id/full`                    | 覆盖保存整份 payload           |
| DELETE  | `/api/trips/:id`                         | 删除行程(默认行程不可删)   |
| POST    | `/api/trips/:id/duplicate`               | 复制行程(自动命名 + slug)  |
| POST    | `/api/trips/current/import-local`        | 用 `itinerary.json` 覆盖数据库 |
| POST    | `/api/trips/current/export-local`        | 把当前数据库行程写回 `itinerary.json` |
| POST    | `/api/places/search`                     | Google Places 文本搜索         |
| GET     | `/api/places/details/:placeId`           | Google Places 详情             |
| POST    | `/api/photos/upload`                     | 景点照片上传(二进制)       |

前端统一通过 `window.TripApi`(`trip-api.js`)调用 trip 相关 API,admin 页的 Places / 照片仍走本地 `fetchJson`。

### 创建行程请求示例

```http
POST /api/trips
Content-Type: application/json

{
  "name": "京都 5 日游",
  "destination": "日本关西",
  "description": "大学同学秋季旅行",
  "startDate": "2026-10-01",
  "endDate": "2026-10-05",
  "template": "empty"  // 或 "current",基于默认行程的配置但清空景点和路线
}
```

## 兼容性说明

- 默认日本行程的 `id` 固定是字符串 `current`,所有旧链接(`/`、`/admin`、`/api/trips/current/full`)全部保持兼容
- 新建行程使用 `crypto.randomUUID()` 作为 `id`,URL 形式 `/trip?id=<uuid>`、`/admin?id=<uuid>`
- `itinerary.json` 仍然作为默认行程的 seed 来源,启动时若数据库已有 `current` 会跳过写入
- `/api/trips/current/import-local` 和 `/api/trips/current/export-local` 仅作用于默认行程;其他行程的导入导出目前不支持(未来可扩展为泛 `:id`)

## 数据说明

- 数据库文件:`data/travel-plans.sqlite`(运行时生成,Docker 部署请挂载这个目录)
- 照片目录:`data/photos/`,静态挂载到 `/photos/*`
- 默认行程文件:`itinerary.json`(同时是 seed 源和「保存并导出」目标)

## Docker

### 本地构建

```bash
docker compose up -d --build
```

### GHCR 拉镜像

仓库提供 `docker-compose.ghcr.yml`,适合群晖直接拉:

```
ghcr.io/<你的 GitHub 用户名>/trip_map:latest
```

## GitHub Actions

工作流:`.github/workflows/docker-publish.yml`

触发条件:

- push 到 `main`
- 推送 `v*` tag
- 手动触发

执行后推送镜像到 `ghcr.io/<你的 GitHub 用户名>/trip_map`。

## 群晖部署

推荐目录:`/volume1/docker/trip_map`,至少保留:

- `docker-compose.ghcr.yml`
- `.env`
- `itinerary.json`
- `data/`

`.env` 示例:

```env
TRIP_MAP_IMAGE=ghcr.io/<你的 GitHub 用户名>/trip_map:latest
GOOGLE_MAPS_API_KEY=你的_GOOGLE_MAPS_KEY
GOOGLE_PLACES_API_KEY=你的_PLACES_KEY
```

在 `Container Manager -> 项目` 导入:

- 项目目录:`/volume1/docker/trip_map`
- Compose 文件:`/volume1/docker/trip_map/docker-compose.ghcr.yml`

启动后访问:

- `http://你的群晖IP:8080/dashboard`
- `http://你的群晖IP:8080/admin?id=current`

## 未来方向

- 行程共享 / 协作(账号、邀请链接)
- 行程导出 / 分享为只读网页或图片
- 更丰富的模板库(周末游、美食路线、亲子游等)
- 行程评论 / 打卡 / 实际到达时间记录
- Places 搜索范围国际化(目前默认 `regionCode: 'JP'`)
- 把 Places / 照片上传也纳入 `TripApi`,前端再也不需要直接写 `/api/*`
- 将 `escapeHtml` 这类前端通用工具抽到 `trip-utils.js` 供所有页面共享
- 行程维度的 `import-local` / `export-local`,允许非 `current` 也能和本地 JSON 互通

## 许可

本项目仅用于学习和个人用途,包含的 Google Maps / Places API 调用需遵循各自服务条款。
