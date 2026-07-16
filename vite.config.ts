import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // WSL2 DrvFs(/mnt/c) 위에서 Node의 fs.copyFileSync가 EPERM으로 실패해
  // (copy_file_range 미지원) public/ 자동 복사가 깨짐 — 직접 끄고
  // package.json build 스크립트에서 셸 cp로 대신 복사함
  publicDir: false,
})
