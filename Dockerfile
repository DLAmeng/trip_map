# Multi-stage build:
#   Stage 1 (frontend-build):安装前端 devDeps + 跑 vite build,产出 frontend/dist
#   Stage 2 (runtime):只装后端 prod deps + 复制 dist + 启动 node 服务
#
# 之前单 stage 漏了 frontend build,导致 image 里没 frontend/dist,
# express.static 静态目录为空 → 用户看到"老版"或空白(取决于浏览器/镜像缓存)。

FROM node:25-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:25-bookworm-slim
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# 后端 prod deps
COPY package*.json ./
RUN npm ci --omit=dev

# 后端源码 + 数据
COPY . .

# 把 stage 1 build 的 dist 拷到运行时镜像
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 8080

CMD ["node", "server.js"]
