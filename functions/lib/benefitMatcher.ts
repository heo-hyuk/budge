/// <reference types="@cloudflare/workers-types" />

export interface CardBenefit {
  id: string
  user_id: string
  card_id: string
  name: string
  category: string
  merchant_pattern: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  monthly_cap: number
  min_spend: number
  memo: string
  created_at: string
}

export interface BenefitMatch {
  benefit: CardBenefit
  score: number
  estimated_discount: number  // 이번 거래에 적용될 예상 할인액
  monthly_used: number        // 이번 달 이미 사용된 할인액
  monthly_remaining: number   // 이번 달 남은 한도 (0 = 무제한)
}

/** 혜택 규칙과 거래의 매칭 점수 계산 */
function calcScore(benefit: CardBenefit, merchant: string, category: string): number {
  const hasMerchant = benefit.merchant_pattern !== ''
  const hasCategory = benefit.category !== ''

  const merchantMatch = hasMerchant &&
    merchant.toLowerCase().includes(benefit.merchant_pattern.toLowerCase())
  const categoryMatch = hasCategory && category === benefit.category

  // 두 조건 모두 있는 경우
  if (hasMerchant && hasCategory) {
    if (merchantMatch && categoryMatch) return 150  // 완전 일치
    if (merchantMatch) return 100                   // 구매처만 일치
    if (categoryMatch) return 50                    // 분류만 일치
    return -1                                       // 매칭 실패
  }

  if (hasMerchant) return merchantMatch ? 100 : -1
  if (hasCategory) return categoryMatch ? 50 : -1
  return 10 // 전체 적용 규칙
}

/**
 * 카드+거래 조건에 맞는 혜택 규칙 찾기
 * - 점수 기준 최고 그룹만 반환 (동점은 복수 반환)
 */
export async function findMatchingBenefits(
  db: D1Database,
  userId: string,
  cardId: string,
  merchant: string,
  category: string,
  amount: number,
  month: string,  // YYYY-MM
): Promise<BenefitMatch[]> {
  if (!cardId || cardId === '현금') return []

  // 해당 카드의 모든 혜택 규칙 조회
  const { results: benefits } = await db
    .prepare('SELECT * FROM card_benefits WHERE card_id = ? AND user_id = ? ORDER BY created_at ASC')
    .bind(cardId, userId)
    .all<CardBenefit>()

  if (!benefits || benefits.length === 0) return []

  // 이번 달 benefit_id별 사용 할인액 집계
  const dateStart = `${month}-01`
  const dateEnd = `${month}-31`
  const { results: usedRows } = await db
    .prepare(`
      SELECT benefit_id, SUM(discount_amount) AS total_used
      FROM transactions
      WHERE user_id = ? AND date >= ? AND date <= ?
        AND benefit_id != '' AND discount_amount > 0
      GROUP BY benefit_id
    `)
    .bind(userId, dateStart, dateEnd)
    .all<{ benefit_id: string; total_used: number }>()

  const usedMap = new Map<string, number>()
  for (const row of usedRows ?? []) {
    usedMap.set(row.benefit_id, row.total_used)
  }

  const matches: BenefitMatch[] = []

  for (const benefit of benefits) {
    const score = calcScore(benefit, merchant, category)
    if (score < 0) continue

    // 최소 결제 금액 조건
    if (benefit.min_spend > 0 && amount < benefit.min_spend) continue

    // 예상 할인액 계산
    let estimated: number
    if (benefit.discount_type === 'percent') {
      estimated = Math.floor(amount * benefit.discount_value / 100)
    } else {
      estimated = Math.floor(benefit.discount_value)
    }
    if (estimated <= 0) continue

    // 월 한도 확인
    const monthlyUsed = usedMap.get(benefit.id) ?? 0
    if (benefit.monthly_cap > 0) {
      const remaining = benefit.monthly_cap - monthlyUsed
      if (remaining <= 0) continue  // 한도 소진
      if (estimated > remaining) estimated = remaining
    }

    matches.push({
      benefit,
      score,
      estimated_discount: estimated,
      monthly_used: monthlyUsed,
      monthly_remaining: benefit.monthly_cap > 0 ? benefit.monthly_cap - monthlyUsed : 0,
    })
  }

  // 점수 내림차순 정렬 후 최고 점수 그룹만 반환
  matches.sort((a, b) => b.score - a.score)
  if (matches.length === 0) return []
  const topScore = matches[0].score
  return matches.filter((m) => m.score === topScore)
}
