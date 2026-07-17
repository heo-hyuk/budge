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
      // push/notificationclick 핸들러(카드 정산 알림)를 넣으려면 커스텀 SW 소스가
      // 필요해 generateSW 대신 injectManifest로 전환 — 프리캐시/라우팅 규칙은
      // src/sw.ts에 직접 작성(이전 generateSW 설정과 동일한 동작 유지)
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
      },
    }),
  ],
  // WSL2 DrvFs(/mnt/c) 위에서 Node의 fs.copyFileSync가 EPERM으로 실패해
  // (copy_file_range 미지원) public/ 자동 복사가 깨짐 — 직접 끄고
  // package.json build 스크립트에서 셸 cp로 대신 복사함
  publicDir: false,
})
