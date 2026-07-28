type LegalPageType = 'privacy' | 'terms'

interface Props {
  type: LegalPageType
}

const CONTACT_EMAIL = 'exgjgur4@gmail.com'
const EFFECTIVE_DATE = '2026년 7월 28일'

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-6 text-base font-bold text-neutral-800 dark:text-neutral-200 first:mt-0">{children}</h2>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{children}</p>
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{children}</ul>
}

function PrivacyContent() {
  return (
    <>
      <P>
        텅~ 장(이하 "서비스")은 이용자의 개인정보를 소중히 여기며, 아래와 같이
        개인정보를 처리합니다. 이 서비스는 사업자등록 없이 개인이 운영하는
        1인 프로젝트입니다.
      </P>

      <H2>1. 수집하는 개인정보 항목</H2>
      <P>회원가입 시 이메일, 비밀번호(암호화 저장), 이름, 닉네임을 수집합니다.</P>
      <P>서비스 이용 과정에서 이용자가 직접 입력하는 아래 정보가 저장됩니다.</P>
      <Ul>
        <li>수입/지출 거래 내역(금액, 분류, 메모, 구매처, 날짜 등)</li>
        <li>등록한 카드 정보(카드명, 색상, 결제/마감일 등 — 실제 카드번호는 수집하지 않습니다)</li>
        <li>메모 및 첨부 이미지</li>
        <li>예산, 고정 수입/지출, 사업자 세금 설정 등 이용자가 입력한 그 외 가계부 관련 정보</li>
        <li>Push 알림을 신청한 경우 브라우저 알림 구독 정보</li>
      </Ul>

      <H2>2. 개인정보의 수집 및 이용 목적</H2>
      <P>회원 식별 및 로그인 유지, 가계부 서비스 제공(거래 기록·정산·예산·세금 추정 등), 이용자가 신청한 경우의 알림(Push) 발송을 위해 사용합니다. 그 외 목적(광고, 마케팅 등)으로는 사용하지 않습니다.</P>

      <H2>3. 개인정보의 보유 및 이용 기간</H2>
      <P>회원 탈퇴 시 아래 4. 위탁 항목을 제외한 모든 개인정보를 즉시 파기합니다. 로그인 세션은 발급일로부터 최대 30일간 보관 후 자동 만료됩니다.</P>

      <H2>4. 개인정보의 제3자 제공 및 처리위탁</H2>
      <P>이용자의 개인정보를 외부에 판매하거나 제3자에게 제공하지 않습니다. 다만 서비스 운영을 위해 아래 인프라 제공업체에 데이터 처리를 위탁하고 있습니다.</P>
      <Ul>
        <li>Cloudflare, Inc. — 웹 호스팅, 데이터베이스, 이미지 저장소, 서버 인프라 제공</li>
      </Ul>

      <H2>5. 쿠키 사용</H2>
      <P>로그인 상태 유지를 위한 세션 쿠키만 사용하며, 광고나 방문 추적 목적의 쿠키는 사용하지 않습니다.</P>

      <H2>6. 이용자의 권리</H2>
      <P>이용자는 마이페이지에서 언제든지 닉네임/비밀번호를 직접 수정하거나, "회원 탈퇴" 기능으로 본인의 계정과 모든 데이터를 즉시 삭제할 수 있습니다. 그 외 개인정보 열람·정정 요청은 아래 연락처로 문의해주세요.</P>

      <H2>7. 안전성 확보 조치</H2>
      <P>비밀번호는 PBKDF2 방식으로 솔트와 함께 암호화되어 저장되며, 원문은 어디에도 저장되지 않습니다. 모든 통신은 HTTPS로 암호화되고, 로그인 세션 쿠키는 스크립트로 접근할 수 없는 HttpOnly 속성으로 발급됩니다.</P>

      <H2>8. 개인정보 관련 문의</H2>
      <P>개인정보 처리와 관련한 문의는 아래 이메일로 연락해주세요.</P>
      <P>{CONTACT_EMAIL}</P>

      <H2>9. 고지 의무</H2>
      <P>이 방침은 관련 법령이나 서비스 변경에 따라 개정될 수 있으며, 변경 시 서비스 내 공지를 통해 안내합니다.</P>

      <P>시행일: {EFFECTIVE_DATE}</P>
    </>
  )
}

function TermsContent() {
  return (
    <>
      <H2>제1조 (목적)</H2>
      <P>이 약관은 텅~ 장(이하 "서비스")의 이용과 관련하여 서비스 제공자와 이용자 간의 권리, 의무 및 책임사항을 정하는 것을 목적으로 합니다.</P>

      <H2>제2조 (서비스 제공자 정보)</H2>
      <P>이 서비스는 사업자등록 없이 개인이 운영하는 1인 프로젝트이며, 문의는 아래 이메일로 받습니다.</P>
      <P>{CONTACT_EMAIL}</P>

      <H2>제3조 (약관의 효력 및 변경)</H2>
      <P>이 약관은 서비스 화면에 게시함으로써 효력이 발생합니다. 서비스 제공자는 필요한 경우 약관을 개정할 수 있으며, 개정 시 서비스 내 공지를 통해 사전 안내합니다.</P>

      <H2>제4조 (회원가입 및 계정 관리)</H2>
      <P>이용자는 정확한 정보로 회원가입을 신청해야 하며, 본인의 계정(이메일·비밀번호) 관리 책임은 이용자 본인에게 있습니다. 타인의 계정을 도용하거나 부정한 방법으로 이용해서는 안 됩니다.</P>

      <H2>제5조 (서비스의 제공 및 변경·중단)</H2>
      <P>서비스는 무료로 제공되며, 개인이 운영하는 프로젝트 특성상 사전 공지 없이 기능이 변경되거나 서비스가 일시 중단·종료될 수 있습니다. 중요한 변경이나 종료 시에는 가능한 범위 내에서 사전에 안내합니다.</P>

      <H2>제6조 (회원 탈퇴)</H2>
      <P>이용자는 마이페이지의 "회원 탈퇴" 기능을 통해 언제든지 계약을 해지할 수 있으며, 탈퇴 즉시 계정 및 모든 이용 데이터가 영구적으로 삭제되고 복구되지 않습니다.</P>

      <H2>제7조 (이용자의 의무)</H2>
      <Ul>
        <li>타인의 정보를 도용하거나 허위 정보를 등록하는 행위</li>
        <li>서비스의 정상적인 운영을 방해하는 행위</li>
        <li>법령 또는 공서양속에 반하는 목적으로 서비스를 이용하는 행위</li>
      </Ul>
      <P>위 행위가 확인될 경우 서비스 제공자는 사전 통지 없이 이용을 제한할 수 있습니다.</P>

      <H2>제8조 (면책 조항)</H2>
      <P>서비스에서 제공하는 예산·정산·세금 추정 등의 계산 결과는 참고용 정보이며, 실제 세무 신고나 재무적 의사결정을 대체하지 않습니다. 정확한 세금 신고는 세무사 또는 국세청 홈택스를 통해 확인해야 하며, 서비스 제공자는 이용자가 이 정보를 신뢰하여 발생한 손해에 대해 책임을 지지 않습니다. 서비스는 무료로 제공되며, 천재지변 등 불가항력이나 서비스 제공자의 고의·과실이 없는 사유로 인한 서비스 중단에 대해서도 책임을 지지 않습니다.</P>

      <H2>제9조 (저작권)</H2>
      <P>서비스에서 제공하는 콘텐츠 및 소스코드에 대한 저작권은 서비스 제공자에게 있으며, 이용자가 입력한 가계부 데이터의 소유권은 이용자 본인에게 있습니다.</P>

      <H2>제10조 (준거법 및 관할)</H2>
      <P>이 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련해 분쟁이 발생할 경우 민사소송법상의 관할 법원에 제소합니다.</P>

      <P>시행일: {EFFECTIVE_DATE}</P>
    </>
  )
}

function LegalPage({ type }: Props) {
  return (
    <div className="min-h-svh bg-neutral-50 dark:bg-neutral-950 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <img src="/logo.svg" alt="텅~ 장" className="h-8 w-auto" />
          <a href="/" className="text-sm font-semibold text-coral-600 dark:text-coral-200 hover:underline">
            홈으로
          </a>
        </div>
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-sm">
          <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            {type === 'privacy' ? '개인정보처리방침' : '이용약관'}
          </h1>
          {type === 'privacy' ? <PrivacyContent /> : <TermsContent />}
        </div>
      </div>
    </div>
  )
}

export default LegalPage
