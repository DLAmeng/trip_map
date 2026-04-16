# trip_map

一个面向桌面和手机的日本 14 天旅行地图项目。

- 前台地图：`/`
- 后台编辑页：`/admin`
- 后端 API：`/api/*`

当前路线：

东京 4 天 → 河口湖 / 富士山 2 天 1 夜 → 京都 4 天 → 大阪 3 晚 → KIX 回程

## 技术栈

- 前端：原生 HTML / CSS / JavaScript
- 地图：Google Maps + Leaflet 回退
- 后端：Express
- 数据：SQLite
- 部署：Docker / GHCR / Synology Container Manager

## 项目结构

```text
trip_map/
├── .github/workflows/docker-publish.yml
├── admin.css
├── admin.html
├── admin.js
├── app.js
├── data/
├── docker-compose.ghcr.yml
├── docker-compose.yml
├── Dockerfile
├── index.html
├── itinerary.json
├── package.json
├── server.js
└── styles.css
```

## 本地运行

```bash
cd /path/to/trip_map
npm install
npm start
```

打开：

- `http://127.0.0.1:8080`
- `http://127.0.0.1:8080/admin`

## 环境变量

建议在本地创建 `.env`，至少可选填：

```env
GOOGLE_MAPS_API_KEY=
TRIP_MAP_IMAGE=ghcr.io/your-github-name/trip_map:latest
```

说明：

- `GOOGLE_MAPS_API_KEY`
  - 运行时注入给前端地图使用
  - 不会写回数据库或 `itinerary.json`
- `TRIP_MAP_IMAGE`
  - 群晖通过 GHCR 拉镜像时使用

## Docker

### 本地构建

```bash
cd /path/to/trip_map
docker compose up -d --build
```

### GHCR 拉镜像

项目也提供：

- `docker-compose.ghcr.yml`

适合群晖直接拉：

- `ghcr.io/<你的 GitHub 用户名>/trip_map:latest`

## GitHub Actions

工作流文件：

- `.github/workflows/docker-publish.yml`

触发条件：

- push 到 `main`
- 推送 `v*` tag
- 手动触发

执行后会把镜像推到：

- `ghcr.io/<你的 GitHub 用户名>/trip_map`

## 群晖部署

推荐目录：

- `/volume1/docker/trip_map`

目录里至少保留：

- `docker-compose.ghcr.yml`
- `.env`
- `itinerary.json`
- `data/`

`.env` 示例：

```env
TRIP_MAP_IMAGE=ghcr.io/<你的 GitHub 用户名>/trip_map:latest
GOOGLE_MAPS_API_KEY=你的_GOOGLE_MAPS_KEY
```

然后在 `Container Manager -> 项目` 里导入：

- 项目目录：`/volume1/docker/trip_map`
- Compose 文件：`/volume1/docker/trip_map/docker-compose.ghcr.yml`

启动后访问：

- `http://你的群晖IP:8080/`
- `http://你的群晖IP:8080/admin`

## 数据说明

数据库文件：

- `data/travel-plans.sqlite`

默认行程文件：

- `itinerary.json`

后台编辑页支持：

- 改标题和描述
- 改景点字段
- 改路线字段
- 新增 / 删除景点
- 新增 / 删除路线
- 调整路线顺序
- 保存到数据库
- 保存并写回 `itinerary.json`

## API

- `GET /api/health`
- `GET /api/trips`
- `GET /api/trips/current/full`
- `PUT /api/trips/current/full`
- `POST /api/trips/current/import-local`
- `POST /api/trips/current/export-local`

## Google Maps

仓库里的 `itinerary.json` 默认不保存真实 key。

推荐只通过环境变量提供：

```env
GOOGLE_MAPS_API_KEY=你的_GOOGLE_MAPS_KEY
```

如果没有 key，页面会自动回退到 OpenStreetMap。
