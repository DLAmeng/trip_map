# Synology 部署清单

推荐目录：

- `/volume1/docker/trip_map`

## 推荐方式

- GitHub 存源码
- GitHub Actions 发布 GHCR 镜像
- 群晖 `Container Manager` 拉 `trip_map` 镜像部署

## 群晖目录里需要的文件

- `docker-compose.ghcr.yml`
- `.env`
- `itinerary.json`
- `data/`

## `.env` 示例

```env
TRIP_MAP_IMAGE=ghcr.io/<你的 GitHub 用户名>/trip_map:latest
GOOGLE_MAPS_API_KEY=你的_GOOGLE_MAPS_KEY
```

## 部署步骤

1. 安装 `Container Manager`
2. 创建目录：
   - `/volume1/docker/trip_map`
   - `/volume1/docker/trip_map/data`
3. 把 `docker-compose.ghcr.yml`、`.env`、`itinerary.json` 放进 `/volume1/docker/trip_map`
4. 打开 `Container Manager -> 项目`
5. 新建项目
6. 项目目录选择：
   - `/volume1/docker/trip_map`
7. Compose 文件选择：
   - `/volume1/docker/trip_map/docker-compose.ghcr.yml`
8. 启动

## 启动后访问

- 前台：`http://你的群晖IP:8080/`
- 后台：`http://你的群晖IP:8080/admin`

## 更新方式

1. 本地改代码并 push 到 GitHub
2. 等 GitHub Actions 发布新镜像
3. 在群晖 `Container Manager -> 项目` 里重新部署 / 重新拉取镜像

## 数据位置

- SQLite：`/volume1/docker/trip_map/data/`
- 行程文件：`/volume1/docker/trip_map/itinerary.json`

## 说明

- 后台编辑页保存后会更新数据库
- 点“保存并写回 itinerary.json”时，也会同步修改宿主机上的 `itinerary.json`
- Google Maps key 不要写进仓库，推荐只放 `.env`
