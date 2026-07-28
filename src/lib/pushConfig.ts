// VAPID 공개키 — 비공개키와 쌍을 이루는 값이지만 그 자체는 비밀정보가 아님(구독 생성
// 시 서버 신원 확인용, 표준적으로 프론트엔드 소스에 그대로 포함해 사용)
// 비공개키는 workers/card-settlement-notifier에 wrangler secret으로만 저장됨
export const VAPID_PUBLIC_KEY =
  'BAYaCkdYCPduSmypoCI0Wt4YL9rz6wiNo8EJdbpMZovN28TsIgr-BuYjBgNIHpHu1Ulj2L5gRkF_zFO3wAkc3U8'
