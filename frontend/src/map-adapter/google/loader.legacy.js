import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
let isOptionsSet = false;
/**
 * 迁移至 @googlemaps/js-api-loader v2+ 的函数式 API。
 */
export async function loadGoogleMapsLibrary(config) {
    if (!config.apiKey) {
        throw new Error('Missing Google Maps API key');
    }
    if (!isOptionsSet) {
        setOptions({
            key: config.apiKey, // v2 使用 key 属性
            v: 'weekly',
            language: config.language || 'zh-CN',
            region: config.region || 'JP',
        });
        isOptionsSet = true;
    }
    // 返回核心 maps 库
    return importLibrary('maps');
}
export { importLibrary };
