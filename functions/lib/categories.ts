// src/lib/categories.ts의 기본 분류 목록과 항상 동일하게 유지할 것 —
// functions/는 src/를 import하지 않는 컨벤션이라 자체 복제(functions/lib/settlement.ts와 동일 패턴)
export const DEFAULT_CATEGORIES: Record<'expense' | 'income', string[]> = {
  expense: ['식비', '교통', '주거/공과금', '의료', '문화/여가', '쇼핑', '교육', '경조사', '기타'],
  income: ['급여', '용돈', '기타수입'],
}
