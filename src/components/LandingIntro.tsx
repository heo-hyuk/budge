interface Feature {
  title: string
  description: string
}

const FEATURES: Feature[] = [
  {
    title: '수입/지출 기록',
    description: '카테고리별로 빠르게 기록하고, 일간/주간/월간/연간 정산을 한눈에 확인해요.',
  },
  {
    title: '카드 혜택 자동 적용',
    description: '결제 카드와 금액만 입력하면 등록해둔 할인/적립 혜택을 자동으로 찾아 적용해요.',
  },
  {
    title: '카드 정산 자동 추적',
    description: '청구 마감일이 지나면 그 기간 사용액을 요약해 알림으로 알려드려요.',
  },
  {
    title: '예산 관리',
    description: '카테고리별로 월 예산을 정해두면 초과할 것 같을 때 미리 경고해줘요.',
  },
  {
    title: '1인 사업자 세금 계산기',
    description: '부가세·종합소득세 예상액과 세금 예비비를 추정해드려요(참고용 추정치).',
  },
]

const SCREENSHOTS: { src: string; alt: string }[] = [
  { src: '/screenshots/home.png', alt: '홈 화면 — 이번 달 잔액/수입/지출 요약' },
  { src: '/screenshots/cards.png', alt: '카드 관리 화면 — 등록한 카드와 혜택' },
  { src: '/screenshots/tax.png', alt: '세금 계산기 화면 — 부가세/종합소득세 추정' },
]

function LandingIntro() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-10 text-center sm:pt-16">
      <img src="/logo.svg" alt="텅~ 장" className="mx-auto h-16 w-auto sm:h-20" />

      <h1 className="mt-4 text-2xl font-bold text-neutral-900 dark:text-neutral-100 sm:text-3xl">
        가계부, 카드 혜택, 세금까지 — 한 곳에서
      </h1>
      <p className="mx-auto mt-3 max-w-md text-base text-neutral-500 dark:text-neutral-400">
        수입/지출 기록부터 카드 혜택 자동 적용, 예산 관리, 1인 사업자 세금
        계산까지. 나만의 가계부 서비스, 텅~ 장이에요.
      </p>

      <a
        href="#signup"
        className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-coral-400 px-8 text-base font-bold text-white transition-colors hover:bg-coral-600 active:bg-coral-800"
      >
        무료로 시작하기
      </a>

      {/* 기능 요약 */}
      <div className="mt-14 grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm"
          >
            <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">{f.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">{f.description}</p>
          </div>
        ))}
      </div>

      {/* 실제 화면 스크린샷 */}
      <div className="mt-14">
        <p className="mb-4 text-sm font-semibold text-neutral-500 dark:text-neutral-400">실제 화면이에요</p>
        <div className="flex snap-x gap-4 overflow-x-auto pb-2">
          {SCREENSHOTS.map((s) => (
            <img
              key={s.src}
              src={s.src}
              alt={s.alt}
              className="h-auto w-52 shrink-0 snap-center rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-md sm:w-64"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default LandingIntro
