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
  benefit_group_id: string | null
  benefit_type: 'discount' | 'cashback'
  active: number
  created_at: string
}

export interface BenefitMatch {
  benefit: CardBenefit
  score: number
  estimated_discount: number  // 이번 거래에 적용될 예상 할인액 (cashback이면 예상 적립액)
  monthly_used: number        // 이번 달 이미 사용된 할인액 (그룹 소속이면 그룹 전체 사용액)
  monthly_remaining: number   // 이번 달 남은 한도 (0 = 무제한, 그룹 소속이면 그룹 잔여 한도)
  benefit_type: 'discount' | 'cashback'
}

/** 혜택 규칙과 거래의 매칭 점수 계산 */
function calcScore(benefit: CardBenefit, merchant: string, category: string): number {
  const hasMerchant = benefit.merchant_pattern !== ''
  const hasCategory = benefit.category !== ''

  const merchantMatch = hasMerchant &&
    merchant.toLowerCase().includes(benefit.merchant_pattern.toLowerCase())
  const categoryMatch = hasCategory && category === benefit.category

  // 두 조건 모두 있는 경우
  // 구매처가 지정됐는데 불일치하면 분류가 맞아도 거절 (누수 방지)
  if (hasMerchant && hasCategory) {
    if (merchantMatch && categoryMatch) return 150  // 완전 일치
    if (merchantMatch) return 100                   // 구매처만 일치
    return -1                                       // 구매처 불일치 → 매칭 실패
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

  // 해당 카드의 활성 혜택 규칙만 조회 (비활성은 매칭 후보에서 제외)
  const { results: benefits } = await db
    .prepare('SELECT * FROM card_benefits WHERE card_id = ? AND user_id = ? AND active = 1 ORDER BY created_at ASC')
    .bind(cardId, userId)
    .all<CardBenefit>()

  if (!benefits || benefits.length === 0) return []

  // 이번 달 benefit_id별 사용액 집계 — discount_amount(할인)와 cashback_amount(적립)는
  // 거래 하나당 둘 중 하나만 채워지므로(혜택 유형이 배타적) 합산해도 이중 계산 안 됨
  const dateStart = `${month}-01`
  const dateEnd = `${month}-31`
  const { results: usedRows } = await db
    .prepare(`
      SELECT benefit_id, SUM(discount_amount + cashback_amount) AS total_used
      FROM transactions
      WHERE user_id = ? AND date >= ? AND date <= ?
        AND benefit_id != '' AND (discount_amount > 0 OR cashback_amount > 0)
      GROUP BY benefit_id
    `)
    .bind(userId, dateStart, dateEnd)
    .all<{ benefit_id: string; total_used: number }>()

  const usedMap = new Map<string, number>()
  for (const row of usedRows ?? []) {
    usedMap.set(row.benefit_id, row.total_used)
  }

  // 그룹 소속 혜택이 있으면 그룹별 월 한도 + 그룹 전체 사용액 조회
  const groupIds = [...new Set(benefits.map((b) => b.benefit_group_id).filter((id): id is string => !!id))]
  const groupCapMap = new Map<string, number>()   // group_id -> monthly_cap
  const groupUsedMap = new Map<string, number>()  // group_id -> 그룹 전체 이번달 사용액
  if (groupIds.length > 0) {
    const placeholders = groupIds.map(() => '?').join(',')
    const { results: groups } = await db
      .prepare(`SELECT id, monthly_cap FROM benefit_groups WHERE id IN (${placeholders})`)
      .bind(...groupIds)
      .all<{ id: string; monthly_cap: number }>()
    for (const g of groups ?? []) groupCapMap.set(g.id, g.monthly_cap)

    // 그룹에 속한 모든 benefit_id(활성/비활성 무관 — 과거 비활성화 전에 쌓인 사용액도 한도에 반영)
    const { results: groupBenefits } = await db
      .prepare(`SELECT id, benefit_group_id FROM card_benefits WHERE benefit_group_id IN (${placeholders})`)
      .bind(...groupIds)
      .all<{ id: string; benefit_group_id: string }>()
    for (const gb of groupBenefits ?? []) {
      const used = usedMap.get(gb.id) ?? 0
      groupUsedMap.set(gb.benefit_group_id, (groupUsedMap.get(gb.benefit_group_id) ?? 0) + used)
    }
  }

  const matches: BenefitMatch[] = []

  for (const benefit of benefits) {
    const score = calcScore(benefit, merchant, category)
    if (score < 0) continue

    // 최소 결제 금액 조건
    if (benefit.min_spend > 0 && amount < benefit.min_spend) continue

    // 예상 할인액(또는 예상 적립액) 계산
    let estimated: number
    if (benefit.discount_type === 'percent') {
      estimated = Math.floor(amount * benefit.discount_value / 100)
    } else {
      estimated = Math.floor(benefit.discount_value)
    }
    if (estimated <= 0) continue

    // 월 한도 확인 — 그룹 소속이면 그룹 공유 한도, 아니면 개별 한도
    let monthlyUsed: number
    let cap: number
    if (benefit.benefit_group_id) {
      cap = groupCapMap.get(benefit.benefit_group_id) ?? 0
      monthlyUsed = groupUsedMap.get(benefit.benefit_group_id) ?? 0
    } else {
      cap = benefit.monthly_cap
      monthlyUsed = usedMap.get(benefit.id) ?? 0
    }
    if (cap > 0) {
      const remaining = cap - monthlyUsed
      if (remaining <= 0) continue  // 한도 소진
      if (estimated > remaining) estimated = remaining
    }

    matches.push({
      benefit,
      score,
      estimated_discount: estimated,
      monthly_used: monthlyUsed,
      monthly_remaining: cap > 0 ? cap - monthlyUsed : 0,
      benefit_type: benefit.benefit_type,
    })
  }

  // 점수 내림차순 정렬 후 최고 점수 그룹만 반환
  matches.sort((a, b) => b.score - a.score)
  if (matches.length === 0) return []
  const topScore = matches[0].score
  return matches.filter((m) => m.score === topScore)
}
