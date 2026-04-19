// 与后端 trip-service.js / trip-template.js 的 payload 对齐的类型。
// Phase 3 收紧了 config / spots / routeSegments(之前是 Record<string, unknown>),
// 让 Trip 页、Phase 4 Admin 编辑器以及 map-adapter 都能吃到严格类型。
export {};
