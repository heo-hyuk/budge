import { Loader2 } from 'lucide-react'

interface Props {
  size?: number
  className?: string
}

/** 버튼 등에 인라인으로 넣는 소형 로딩 스피너 */
function LoadingSpinner({ size = 16, className = '' }: Props) {
  return <Loader2 size={size} className={`animate-spin ${className}`} aria-hidden="true" />
}

export default LoadingSpinner
