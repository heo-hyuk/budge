// VAPID 공개키 — 비공개키와 쌍을 이루는 값이지만 그 자체는 비밀정보가 아님(구독 생성
// 시 서버 신원 확인용, 표준적으로 프론트엔드 소스에 그대로 포함해 사용)
// 비공개키는 workers/card-settlement-notifier에 wrangler secret으로만 저장됨
export const VAPID_PUBLIC_KEY =
  'BNVF3ffHdd83A3kTySza582XejgDV6xRmg4h9O3uRQ9JFFusdy6UqmpS6w1l4jf9pLG51VTBdiNGxSbmE1Gz4Nc'
