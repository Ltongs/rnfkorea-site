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
        prerenderScript: path.resolve(__dirname, './src/prerender.tsx'),
        renderTarget: '#root',
        // 프리렌더링할 페이지 경로 목록 (SEO 대상 공개 페이지만)
        // 업무용/인증 필요 페이지, 데이터 fetch 의존 쇼핑몰 페이지는 제외
        additionalPrerenderRoutes: [
          '/',
          '/home',
          '/tires',
          '/battery',
          '/golfcart-battery',
          '/export',
          '/finance',
          '/cargo-finance',
          '/tire-rental',
          '/sitemap',
          // CSV/DB fetch로 인한 빈 콘텐츠 방지 — 쇼핑몰류 페이지는 prerender 제외
          // '/tires-shop',
          // '/battery-shop',
          // '/export-shop',
        ],
      }),
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-ui': ['lucide-react', 'react-helmet-async'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});