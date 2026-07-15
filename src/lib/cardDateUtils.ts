/**
 * 결제일을 기준으로 마감일을 "제안"하는 함수 — 정확한 카드사 규칙이 아니라
 * 국내 카드사 다수가 따르는 "마감일 = 결제일 - 11일" 이라는 일반적인 패턴에
 * 기반한 제안값이다. 카드사마다 실제 규칙은 다를 수 있으니 사용자가 최종
 * 확인/수정해야 하는 값이며, 이 값을 정확한 규칙으로 취급해 다른 계산에
 * 그대로 재사용하면 안 된다.
 */
export function suggestClosingDay(billingDay: number): number {
  let closingDay = billingDay - 11
  while (closingDay < 1) closingDay += 31
  while (closingDay > 31) closingDay -= 31
  return closingDay
}
