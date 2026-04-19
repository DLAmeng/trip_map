# trip_map

一个面向桌面和手机的旅行地图项目。现已全面迁移至 **React + TypeScript** 架构，提供更强大的行程管理、可视化编辑与分析能力。

## 核心页面入口

- **行程总览 (Dashboard)**: `/dashboard` (主入口)
- **旅行地图 (Trip Map)**: `/trip?id=<tripId>`
- **后台编辑 (Admin Editor)**: `/admin?id=<tripId>`
- **后端 API**: `/api/*`

## 技术架构

- **前端**: React 18 + TypeScript + Vite + React Router + TanStack Query
- **地图**: Leaflet + Google Maps (双引擎适配)
- **后端**: Node.js + Express
- **数据库**: SQLite (`node:sqlite` 同步模式)
- **容器化**: 支持 Docker / GHCR / Synology NAS 部署

## 快速开始

### 1. 安装依赖
```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd frontend && npm install && cd ..
```

### 2. 开发模式
建议开启两个终端窗口：
```bash
# 终端 1: 启动后端 API 服务 (端口 8080)
npm run dev:backend

# 终端 2: 启动前端 Vite 开发服务 (端口 5173, 自动代理 API)
npm run dev:frontend
```
访问：`http://localhost:5173`

### 3. 生产模式 (本地预览)
```bash
# 构建前端产物到 frontend/dist
npm run build:frontend

# 启动后端服务 (由后端统一托管静态资源)
npm start
```
访问：`http://localhost:8080`

## 目录结构
```text
trip_map/
├── frontend/             # React 前端源码
│   ├── src/              # 组件、Hooks、API 客户端
│   └── dist/             # 编译后的生产产物
├── data/                 # SQLite 数据库与用户照片
├── legacy/               # 归档的旧版原生前端文件 (V1)
├── server.js             # 后端 Express 入口
├── trip-service.js       # 核心业务逻辑
└── trip-repository.js    # 数据库访问层
```

## 环境变量
创建 `.env` 文件：
```env
GOOGLE_MAPS_API_KEY=你的Key
PORT=8080
```

## 迁移状态总结
目前项目已完成从原生 JS 到 React 的 100% 路由接管。所有核心编辑（CRUD）、地图渲染、行程分析均已迁移。原有的 `.html` 页面已停用并移入 `legacy` 目录。
