/**
 * 자주 쓰는 카드 상품의 혜택 룰을 자동 등록하기 위한 프리셋 데이터.
 * 실제 카드사 약관과 다를 수 있어 각 혜택에 확인 안내 문구를 기본 포함한다.
 */

export const AI_NOTICE = 'AI가 조사한 정보이니 실제 카드 약관과 다를 수 있어 확인 필요'

function withNotice(memo?: string): string {
  return memo ? `${memo} · ${AI_NOTICE}` : AI_NOTICE
}

export interface PresetBenefit {
  name: string
  category?: string
  merchant_pattern?: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  monthly_cap?: number
  min_spend?: number
  memo?: string
  benefit_type: 'discount' | 'cashback'
  groupName?: string  // preset.groups[].name 참조 — 지정 시 개별 monthly_cap 대신 그룹 공유 한도 사용
}

export interface PresetGroup {
  name: string
  monthly_cap: number
}

export interface CardPreset {
  id: string
  label: string           // 드롭다운에 보여줄 이름
  requiresPackageChoice: boolean  // true면 "패키지 중 택1" 안내 + 활성 토글 UI 노출
  groups: PresetGroup[]
  benefits: PresetBenefit[]
}

export const CARD_BENEFIT_PRESETS: CardPreset[] = [
  {
    id: 'samsung-taptap-o',
    label: '삼성카드 taptap O',
    requiresPackageChoice: true,
    groups: [],
    benefits: [
      {
        name: '통신비 10% 할인',
        category: '통신비',
        discount_type: 'percent',
        discount_value: 10,
        monthly_cap: 5000,
        benefit_type: 'discount',
        memo: withNotice(),
      },
      {
        name: '대중교통 10% 할인',
        category: '교통',
        discount_type: 'percent',
        discount_value: 10,
        monthly_cap: 5000,
        benefit_type: 'discount',
        memo: withNotice(),
      },
      {
        name: '영화 5,000원 정액 할인',
        category: '문화비',
        discount_type: 'fixed',
        discount_value: 5000,
        benefit_type: 'discount',
        memo: withNotice(),
      },
      {
        name: '스타벅스 50% 할인',
        merchant_pattern: '스타벅스',
        discount_type: 'percent',
        discount_value: 50,
        benefit_type: 'discount',
        memo: withNotice(),
      },
      {
        name: '커피전문점 30% 할인',
        category: '카페',
        discount_type: 'percent',
        discount_value: 30,
        benefit_type: 'discount',
        memo: withNotice(),
      },
    ],
  },
  {
    id: 'kb-coupang-wow',
    label: 'KB국민 쿠팡 와우카드',
    requiresPackageChoice: false,
    groups: [],
    benefits: [
      {
        name: '쿠팡/쿠팡이츠/쿠팡플레이 2% 적립',
        merchant_pattern: '쿠팡',
        discount_type: 'percent',
        discount_value: 2,
        monthly_cap: 20000,
        benefit_type: 'cashback',
        memo: withNotice(),
      },
      {
        name: '전체 가맹점 0.2% 적립',
        discount_type: 'percent',
        discount_value: 0.2,
        monthly_cap: 2000,
        benefit_type: 'cashback',
        memo: withNotice(),
      },
    ],
  },
  {
    id: 'lotte-loca-likit',
    label: '롯데카드 LOCA LIKIT',
    requiresPackageChoice: false,
    groups: [
      { name: 'LOCA LIKIT 통합한도', monthly_cap: 13000 },
    ],
    benefits: [
      {
        name: '스타벅스 50% 할인',
        merchant_pattern: '스타벅스',
        discount_type: 'percent',
        discount_value: 50,
        benefit_type: 'discount',
        groupName: 'LOCA LIKIT 통합한도',
        memo: withNotice('전월실적 40만원 이상'),
      },
      {
        name: '영화관 50% 할인',
        category: '문화비',
        discount_type: 'percent',
        discount_value: 50,
        benefit_type: 'discount',
        groupName: 'LOCA LIKIT 통합한도',
        memo: withNotice('전월실적 40만원 이상'),
      },
      {
        name: '대중교통 10% 할인',
        category: '교통',
        discount_type: 'percent',
        discount_value: 10,
        benefit_type: 'discount',
        groupName: 'LOCA LIKIT 통합한도',
        memo: withNotice('전월실적 40만원 이상'),
      },
      {
        name: '통신비 10% 할인',
        category: '통신비',
        discount_type: 'percent',
        discount_value: 10,
        benefit_type: 'discount',
        groupName: 'LOCA LIKIT 통합한도',
        memo: withNotice('전월실적 40만원 이상'),
      },
      {
        name: '배달앱 5% 할인',
        merchant_pattern: '배달',
        discount_type: 'percent',
        discount_value: 5,
        benefit_type: 'discount',
        groupName: 'LOCA LIKIT 통합한도',
        memo: withNotice('전월실적 40만원 이상'),
      },
    ],
  },
]
