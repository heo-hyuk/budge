import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // publicDir:false라 플러그인이 public/에서 매니페스트·아이콘을 자동으로 못 읽어옴
      // (아래 publicDir 주석 참고) — manifest.json은 직접 작성해 public/에 두고
      // package.json build 스크립트의 cp 단계로 복사, 여기서는 서비스워커 생성만 담당
      manifest: false,
      injectRegister: 'auto',
      workbox: {
        // JS/CSS/HTML(+아이콘류) 정적 자산만 프리캐시 — 오프라인 시 마지막 로드 화면 유지용.
        // functions/api/*는 거래 데이터라 실시간성이 중요해 절대 캐시하면 안 됨
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  // WSL2 DrvFs(/mnt/c) 위에서 Node의 fs.copyFileSync가 EPERM으로 실패해
  // (copy_file_range 미지원) public/ 자동 복사가 깨짐 — 직접 끄고
  // package.json build 스크립트에서 셸 cp로 대신 복사함
  publicDir: false,
})
