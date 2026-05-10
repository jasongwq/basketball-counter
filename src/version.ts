export const BUILD_VERSION = '1.0.0';
const BUILD_TIME_RAW = new Date().toISOString();
const BUILD_TIME_DATE = new Date(BUILD_TIME_RAW.replace('Z', '+00:00'));
export const BUILD_TIME = BUILD_TIME_DATE.toLocaleString('zh-CN', { hour12: false, timeZoneName: 'short' });
