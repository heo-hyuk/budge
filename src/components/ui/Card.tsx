import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  noPadding?: boolean  // true면 패딩 없음 (내부에서 직접 제어)
}

// 공통 카드 컴포넌트 — rounded-xl border + shadow 기본값
function Card({ children, className = '', noPadding = false }: CardProps) {
  return (
    <div className={`rounded-xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${noPadding ? '' : 'p-4'} ${className}`}>
      {children}
    </div>
  )
}

export default Card
