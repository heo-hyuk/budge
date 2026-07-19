// 정산 표의 분류 필터에서 쓰는 헬퍼 — 백엔드 functions/lib/settlement.ts의
// classifyIncomeGroup과 동일한 매핑을 클라이언트에도 복제해, 선택한 수입 분류를
// 표의 그룹 열(소득/예금인출/기타) 필터링에 사용한다.
export type IncomeGroup = '소득' | '예금인출' | '기타'

export function classifyIncomeGroup(category: string): IncomeGroup {
  if (category === '급여') return '소득'
  if (category === '예금인출') return '예금인출'
  return '기타'
}

/** 선택된 분류 중 수입 분류만 걸러 소속 그룹 집합으로 변환 */
export function selectedIncomeGroups(selectedCategories: string[], incomeCategories: string[]): Set<IncomeGroup> {
  const groups = new Set<IncomeGroup>()
  for (const c of selectedCategories) {
    if (incomeCategories.includes(c)) groups.add(classifyIncomeGroup(c))
  }
  return groups
}

/** 선택된 분류 중 지출 분류만 걸러낸 목록 */
export function selectedExpenseCategories(selectedCategories: string[], expenseCategories: string[]): string[] {
  return expenseCategories.filter((c) => selectedCategories.includes(c))
}
