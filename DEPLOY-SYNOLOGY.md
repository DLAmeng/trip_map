# Synology Docker 部署说明

推荐目录：

- `/volume1/docker/japan-trip`

## 推荐方式

长期更适合用：

- GitHub 存源码
- GitHub Actions 自动构建 GHCR 镜像
- 群晖 `Container Manager` 拉 GHCR 镜像部署

群晖目录里建议至少放这些：

- `docker-compose.ghcr.yml`
- `.env`
- `itinerary.json`
- `data/`

## 在群晖上的部署步骤

1. 安装 `Container Manager`
2. 在 GitHub 上确认镜像已经发布到 GHCR
3. 在群晖创建目录：
   - `/volume1/docker/japan-trip`
4. 复制这些文件进去：
   - `docker-compose.ghcr.yml`
   - `itinerary.json`
   - `.env`
5. 创建数据目录：
   - `/volume1/docker/japan-trip/data`
6. 打开 `Container Manager`
7. 进入 `项目`
8. 新建项目
9. 项目路径选择：
   - `/volume1/docker/japan-trip`
10. Compose 文件选择：
   - `/volume1/docker/japan-trip/docker-compose.ghcr.yml`
11. 启动项目

`.env` 示例：

```env
JAPAN_TRIP_IMAGE=ghcr.io/你的-github-用户名/japan-trip:latest
GOOGLE_MAPS_API_KEY=你的_GOOGLE_MAPS_KEY
```

## 启动后访问

- 前台地图：`http://你的群晖IP:8080/`
- 后台编辑：`http://你的群晖IP:8080/admin`

## 更新项目

1. 本地改代码并 push 到 GitHub
2. 等 GitHub Actions 发布新镜像
3. 在 `Container Manager -> 项目` 里对项目执行重新部署或重新拉取镜像

## 数据保存位置

- SQLite 数据库：`/volume1/docker/japan-trip/data/`
- 行程 JSON：`/volume1/docker/japan-trip/itinerary.json`

## 说明

- 后台编辑页保存后会更新数据库
- 点“保存并写回 itinerary.json”时，也会同步修改宿主机上的 `itinerary.json`
- Google Maps key 不要写进仓库，推荐只放 `.env`
- 如果用了 Google Maps API key，记得把群晖访问地址加入允许来源
