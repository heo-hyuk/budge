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
  {
    id: 'nh-zgm-the-pay',
    label: 'NH농협카드 zgm.the pay',
    requiresPackageChoice: false,
    groups: [
      { name: 'zgm.the pay 통합한도', monthly_cap: 100000 },
    ],
    benefits: [
      // 아래 3개 혜택은 실제로는 "어떤 결제 방식으로 냈는지"에 따라 하나만 적용되지만,
      // 지금 거래 데이터 모델은 카드 결제라는 것만 기록하고 그 카드가 어느 앱(NH페이/
      // 삼성페이 등)으로 결제됐는지는 추적하지 않음 — category/merchant_pattern을 전부
      // 비워 셋 다 calcScore가 동일하게 10점(전체 적용 규칙)을 받도록 해서 자동으로
      // 하나를 우선시키지 않고 매칭 후보로 셋 다 띄운 뒤 사용자가 실제 결제수단에 맞는
      // 걸 직접 고르게 함
      {
        name: '전 가맹점 기본 1% 할인',
        discount_type: 'percent',
        discount_value: 1,
        benefit_type: 'discount',
        groupName: 'zgm.the pay 통합한도',
        memo: withNotice('전월실적 조건 없음'),
      },
      {
        name: 'NH페이 온라인 결제 1.7% 할인',
        discount_type: 'percent',
        discount_value: 1.7,
        benefit_type: 'discount',
        groupName: 'zgm.the pay 통합한도',
        memo: withNotice('NH페이 앱 결제 시에만 적용, 수기 확인 필요 · 전월실적 조건 없음'),
      },
      {
        name: '기타 간편결제 1.2% 할인',
        discount_type: 'percent',
        discount_value: 1.2,
        benefit_type: 'discount',
        groupName: 'zgm.the pay 통합한도',
        memo: withNotice('삼성페이·네이버페이 등 간편결제 이용 시 해당, 실제 결제수단 확인 필요 · 전월실적 조건 없음'),
      },
    ],
  },
]
