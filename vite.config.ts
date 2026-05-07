import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { vitePrerenderPlugin } from 'vite-prerender-plugin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      vitePrerenderPlugin({
        // prerender.tsx의 export async function prerender() 를 참조
        prerenderScript: './src/prerender.tsx',
        renderTarget: '#root',
        // 프리렌더링할 페이지 경로 목록
        // 업무용/인증 필요 페이지는 제외 (SEO 불필요 + Supabase 호출로 무한 대기 방지)
        additionalPrerenderRoutes: [
          '/',
          '/tires',
          '/battery',
          '/export',
          '/finance',
          '/cargo-finance',
          '/tire-rental',
          '/tires-shop',
          '/battery-shop',
          '/export-shop',
        ],
      }),
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});