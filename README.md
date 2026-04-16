# 日本最终行程表

一个面向桌面和手机的日本 14 天行程地图页，当前路线为：

东京 4 天 → 河口湖 / 富士山 2 天 1 夜 → 京都 4 天 → 大阪 3 晚 → KIX 回程

这版已经从“纯前端静态 JSON”升级成“后端优先、静态文件兜底”的结构：

- 前端优先请求 `/api/trips/current/full`
- 如果后端没启动，会自动回退到本地 [itinerary.json](/Users/ameng/.openclaw/workspace/japan-trip/itinerary.json)
- 后端会把完整行程存到 SQLite，后续可以直接改数据库里的行程 payload 来驱动页面

## 当前实现

- 地图优先使用 Google Maps JavaScript API
- 如果 Google Maps 不可用，会自动回退到 Leaflet + OpenStreetMap
- 路线目前采用示意图风格：
  - 城市间以直线连接
  - 城市内默认直线，必要时用轻微弧线避让重叠
- 支持桌面 / 手机双端布局

## 项目结构

```text
japan-trip/
├── app.js
├── index.html
├── itinerary.json
├── package.json
├── README.md
├── server.js
├── styles.css
└── data/
    └── travel-plans.sqlite
```

## 后端模式

### 技术栈

- Node.js
- Express
- SQLite（通过 Node 内置 `node:sqlite`）

### 数据库位置

- [data/travel-plans.sqlite](/Users/ameng/.openclaw/workspace/japan-trip/data/travel-plans.sqlite)

后端第一次启动时会自动读取 [itinerary.json](/Users/ameng/.openclaw/workspace/japan-trip/itinerary.json)，并把它写入 SQLite 作为当前行程。

## 本地运行

推荐直接跑后端：

```bash
cd /Users/ameng/.openclaw/workspace/japan-trip
npm install
npm start
```

然后打开：

- [http://127.0.0.1:8080](http://127.0.0.1:8080)

### 备用静态模式

如果你只想临时看页面，也可以继续用静态 server：

```bash
cd /Users/ameng/.openclaw/workspace/japan-trip
python3 -m http.server 8080
```

这时前端会因为 `/api/trips/current/full` 不存在而自动回退到本地 `itinerary.json`。

## Docker 部署

项目已经带上这些 Docker 文件：

- [Dockerfile](/Users/ameng/.openclaw/workspace/japan-trip/Dockerfile)
- [docker-compose.yml](/Users/ameng/.openclaw/workspace/japan-trip/docker-compose.yml)
- [docker-compose.ghcr.yml](/Users/ameng/.openclaw/workspace/japan-trip/docker-compose.ghcr.yml)
- [.dockerignore](/Users/ameng/.openclaw/workspace/japan-trip/.dockerignore)
- [.env.example](/Users/ameng/.openclaw/workspace/japan-trip/.env.example)

另外也已经带上 GitHub Actions 工作流：

- [.github/workflows/docker-publish.yml](/Users/ameng/.openclaw/workspace/japan-trip/.github/workflows/docker-publish.yml)

### 本机 Docker

如果你是在普通 Linux / macOS 机器上测试，可以直接：

```bash
cd /Users/ameng/.openclaw/workspace/japan-trip
cp .env.example .env
docker compose up -d --build
```

然后打开：

- [http://127.0.0.1:8080](http://127.0.0.1:8080)
- [http://127.0.0.1:8080/admin](http://127.0.0.1:8080/admin)

`.env` 里可以按需填写：

```env
GOOGLE_MAPS_API_KEY=你的_GOOGLE_MAPS_KEY
```

### GitHub + GHCR 自动发镜像

这套项目现在支持这条更新链路：

1. 代码推到 GitHub
2. GitHub Actions 自动构建 Docker 镜像
3. 镜像推到 `GHCR`
4. 群晖用 `docker-compose.ghcr.yml` 拉取最新镜像

默认工作流文件：

- [.github/workflows/docker-publish.yml](/Users/ameng/.openclaw/workspace/japan-trip/.github/workflows/docker-publish.yml)

触发条件：

- push 到 `main`
- 推送 `v*` tag
- 手动 `workflow_dispatch`

工作流会把镜像推到：

- `ghcr.io/<你的 GitHub 用户名>/japan-trip`

#### GitHub 上线前要做的事

1. 把仓库推到 GitHub
2. 确保默认分支是 `main`
3. 不要把 `.env` 提交上去
4. `itinerary.json` 里的 Google Maps key 现在已经清空，仓库默认不会泄露 key

### 群晖 Container Manager

群晖建议优先用 `GHCR` 拉镜像模式，而不是每次在 NAS 上本地 build。

推荐目录：

- `/volume1/docker/japan-trip`

在这个目录里至少准备：

- `docker-compose.ghcr.yml`
- `.env`
- `data/`
- `itinerary.json`

`.env` 示例：

```env
JAPAN_TRIP_IMAGE=ghcr.io/你的-github-用户名/japan-trip:latest
GOOGLE_MAPS_API_KEY=你的_GOOGLE_MAPS_KEY
```

#### 部署步骤

1. 在群晖 `套件中心` 安装 `Container Manager`
2. 在 GitHub 上完成首次镜像发布
3. 用 File Station 或 SMB 在群晖上创建目录：
   - `/volume1/docker/japan-trip`
4. 复制这三个内容进去：
   - `docker-compose.ghcr.yml`
   - `itinerary.json`
   - `.env`
5. 再建一个子目录：
   - `/volume1/docker/japan-trip/data`
6. 打开 `Container Manager`
7. 进入 `项目`
8. 选择 `新增` 或 `Create`
9. 项目目录选：
   - `/volume1/docker/japan-trip`
10. Compose 文件选：
   - `/volume1/docker/japan-trip/docker-compose.ghcr.yml`
11. 启动项目

启动后默认端口是：

- `8080`

所以访问地址通常是：

- `http://你的群晖局域网IP:8080/`
- `http://你的群晖局域网IP:8080/admin`

#### GHCR compose 做了什么

- 从 `GHCR` 拉取现成镜像
- 暴露 `8080`
- 挂载 `./data -> /app/data`
  - SQLite 数据库会持久化保存在 NAS 上
- 挂载 `./itinerary.json -> /app/itinerary.json`
  - 后台编辑页里“保存并写回 itinerary.json”会直接改宿主机文件
- 从环境变量读取 `GOOGLE_MAPS_API_KEY`
  - 不再把 key 明文写进仓库

#### 更新项目

以后你更新前端或后端代码后，推荐流程是：

1. 本地改代码
2. push 到 GitHub `main`
3. 等 GitHub Actions 构建并推送新镜像
4. 回到群晖 `Container Manager -> 项目`
5. 对 `japan-trip` 执行 `重新部署 / 重新拉取镜像`

#### 如果你用了 Google Maps API key

记得把群晖访问地址加入 Google Maps key 的 `Websites` 限制，例如：

- `http://你的群晖IP:8080/*`
- `http://你的NAS域名:8080/*`

否则本地电脑打开 `localhost` 能显示，换成群晖地址后 Google 地图可能会空白。

## API

### `GET /api/health`

检查服务状态。

返回示例：

```json
{
  "ok": true,
  "databasePath": "/Users/ameng/.openclaw/workspace/japan-trip/data/travel-plans.sqlite",
  "tripCount": 1
}
```

### `GET /api/trips`

返回当前数据库里的行程列表。

### `GET /api/trips/current/full`

返回前端当前使用的完整行程数据。

### `PUT /api/trips/current/full`

用新的完整 payload 覆盖当前行程。

最小要求：

- `config`
- `spots[]`
- `routeSegments[]`

### `POST /api/trips/current/import-local`

把本地 [itinerary.json](/Users/ameng/.openclaw/workspace/japan-trip/itinerary.json) 重新导入数据库，适合你手工改完 JSON 后一键同步回后端。

### `POST /api/trips/current/export-local`

把数据库里的当前行程写回 [itinerary.json](/Users/ameng/.openclaw/workspace/japan-trip/itinerary.json)，适合在后台编辑页保存后同步源码文件。

## 前端数据来源

[app.js](/Users/ameng/.openclaw/workspace/japan-trip/app.js) 当前按这个顺序取数据：

1. `/api/trips/current/full`
2. `itinerary.json`

也就是说，后面你有两种更新方式：

- 改数据库 / 调 API，让前端自动显示新行程
- 继续改 `itinerary.json`，然后调用 `POST /api/trips/current/import-local`

## 后台编辑页

启动后端后，可以直接打开：

- [http://127.0.0.1:8080/admin](http://127.0.0.1:8080/admin)

这页目前支持：

- 修改标题和描述
- 修改景点字段
- 修改路线字段
- 调整路线顺序
- 新增 / 删除景点
- 新增 / 删除路线
- 保存到数据库
- 保存到数据库并回写 `itinerary.json`
- 用本地 `itinerary.json` 重新覆盖数据库

### 目前的编辑逻辑

- 景点显示顺序最终由 `day + order` 决定
- 路线显示顺序按 `routeSegments[]` 数组顺序决定
- 如果你改的是 `path JSON`，需要填合法数组，例如：

```json
[
  [35.6896, 139.7006],
  [35.6918, 139.7039]
]
```

## Google Maps 配置

Google Maps key 不再建议写进仓库。

仓库里的 [itinerary.json](/Users/ameng/.openclaw/workspace/japan-trip/itinerary.json) 现在默认保持：

```json
{
  "config": {
    "mapProvider": "googleMaps",
    "googleMaps": {
      "apiKey": "",
      "mapId": "DEMO_MAP_ID",
      "language": "zh-CN",
      "region": "JP",
      "fallbackToLeaflet": true
    }
  }
}
```

真正运行时，推荐通过环境变量提供 key：

```env
GOOGLE_MAPS_API_KEY=你的_GOOGLE_MAPS_KEY
```

服务端会在运行时把这个 key 注入页面使用，但不会写回数据库或 `itinerary.json`。

至少需要启用：

- `Maps JavaScript API`
- `Routes API`

如果只开了地图、没开路由，页面仍然能显示 Google 地图，只是路线能力会退化。

## 行程数据字段

所有点位和路线核心字段都在 [itinerary.json](/Users/ameng/.openclaw/workspace/japan-trip/itinerary.json) 里，后端保存的也是同一份结构：

- `meta`
  - 页面标题、副标题等元信息
- `config`
  - 地图配置、配色、UI 配置
- `spots[]`
  - 景点、酒店、机场、交通锚点
- `routeSegments[]`
  - 地图上真正画出来的连线

### `routeSegments[]` 的常见类型

- `walk`
- `bus`
- `metro`
- `shinkansen`
- `jrrapid`
- `nankai`

## 下一步适合继续做的事

- 给后端补 `PATCH /spots/:id`、`PATCH /route-segments/:id`
- 增加一个简单的管理页来编辑行程
- 支持多版本行程，比如 `Nintendo Museum 有票 / 无票`
- 把当前 SQLite 结构再拆细，变成真正的 `trips / days / spots / segments` 表

## 参考

- [Load the Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/load-maps-js-api)
- [Get a route](https://developers.google.com/maps/documentation/javascript/routes/get-a-route)
- [Advanced markers overview](https://developers.google.com/maps/documentation/javascript/advanced-markers/overview)
