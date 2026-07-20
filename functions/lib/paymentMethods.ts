// src/lib/paymentMethods.ts의 기본 결제 방법 목록과 항상 동일하게 유지할 것 —
// functions/는 src/를 import하지 않는 컨벤션이라 자체 복제(functions/lib/categories.ts와 동일 패턴)
export const DEFAULT_PAYMENT_METHODS: Record<'expense' | 'income', string[]> = {
  expense: ['현금', '계좌이체'],
  income: ['현금', '계좌이체'],
}
