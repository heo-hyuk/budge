// 정산 표의 분류 필터에서 쓰는 헬퍼 — 선택된 분류 중 주어진 분류 목록(지출/수입
// 공통)에 속한 것만 걸러낸다. 수입도 지출과 동일하게 분류명 그대로 열로 표시하므로
// 그룹 매핑(예전의 소득/예금인출/기타)이 더 이상 필요 없음
export function filterSelectedCategories(selectedCategories: string[], categoryList: string[]): string[] {
  return categoryList.filter((c) => selectedCategories.includes(c))
}
