import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
// 迁移期:Vite dev server(5173)和 Express(8080)同时跑。
// 前端代码里所有 /api、/photos、/runtime-config.js 请求都直接走相对路径,
// 由 dev proxy 转发到 Express,避免写两套 URL。
// 生产期(Phase 5)会把 vite build 产物交给 Express 托管,到时无需 proxy。
export default defineConfig({
    plugins: [
        react(),
        // PWA:沿用当前 Trip 站点需要的缓存策略。
        // - App shell: precache(vite-plugin-pwa 自动生成)
        // - 地图瓦片(OSM) / 上传的 photos:cacheFirst + expiration
        // - 行程数据 /api/trips/:id/full:staleWhileRevalidate
        // - /admin、/api/admin、Google/Nominatim 都走网络,不缓存
        VitePWA({
            registerType: 'autoUpdate',
            // dev 模式明确关闭 SW 注册,避免开发时旧 build 注册的 SW 拦截 Vite 的
            // hot-served 模块(造成 "代码改了但浏览器看到旧版" 的假象)。
            devOptions: { enabled: false },
            manifest: {
                name: 'Trip Map',
                short_name: 'TripMap',
                description: 'Interactive Trip Planning Map',
                theme_color: '#236f7a',
                background_color: '#0f172a',
                display: 'standalone',
                start_url: '/dashboard',
                scope: '/',
                icons: [
                    {
                        src: 'icon.svg',
                        sizes: '192x192 512x512',
                        type: 'image/svg+xml',
                        purpose: 'any',
                    },
                ],
            },
            workbox: {
                // 路由级别:admin / api/admin / Google Maps / Nominatim 全部排除
                navigateFallback: '/index.html',
                navigateFallbackDenylist: [/^\/admin/, /^\/api\//],
                globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
                runtimeCaching: [
                    {
                        urlPattern: ({ url }) => url.hostname === 'tile.openstreetmap.org',
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'osm-tiles',
                            expiration: {
                                maxEntries: 200,
                                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 天
                            },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    {
                        // /photos/* 是 same-origin 的静态资源,pathname 唯一就足够
                        urlPattern: /\/photos\/.+/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'trip-photos',
                            expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 60 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    {
                        urlPattern: /\/api\/trips\/[^/]+\/full$/,
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'trip-data',
                            cacheableResponse: { statuses: [0, 200] },
                            expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 7 },
                        },
                    },
                    // Admin 相关接口、Google / Nominatim 一律不缓存(走 NetworkOnly)
                    {
                        urlPattern: /\/api\/admin/,
                        handler: 'NetworkOnly',
                    },
                    {
                        urlPattern: ({ url }) => ['maps.googleapis.com', 'maps.gstatic.com', 'places.googleapis.com',
                            'nominatim.openstreetmap.org'].includes(url.hostname),
                        handler: 'NetworkOnly',
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    server: {
        port: 5173,
        strictPort: false,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8080',
                changeOrigin: true,
            },
            '/photos': {
                target: 'http://127.0.0.1:8080',
                changeOrigin: true,
            },
            '/runtime-config.js': {
                target: 'http://127.0.0.1:8080',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
});
