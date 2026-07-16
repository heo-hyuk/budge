import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../contexts/ToastContext'
import { fetchExportData } from '../lib/api'
import { exportTransactionsToExcel } from '../lib/exportExcel'

type Preset = 'this_month' | 'this_year' | 'all' | 'custom'

interface Props {
  /** 버튼 초기 preset (화면 맥락에 맞게) */
  defaultPreset?: Preset
  /** 연도 (연정산 화면에서 올해 자동 선택용) */
  year?: string
  /** 월 (홈/월정산 화면에서 이번달 자동 선택용) */
  month?: string
}

function currentYM(): string {
  return new Date().toISOString().slice(0, 7)
}
function currentYear(): string {
  return new Date().getFullYear().toString()
}

function presetDates(preset: Preset, year?: string, month?: string) {
  const ym    = month ?? currentYM()
  const yr    = year  ?? currentYear()

  switch (preset) {
    case 'this_month':
      return { start: `${ym}-01`, end: `${ym}-31` }
    case 'this_year':
      return { start: `${yr}-01-01`, end: `${yr}-12-31` }
    case 'all':
      return { start: '', end: '' }
    default:
      return null
  }
}

export default function ExportButton({ defaultPreset = 'this_month', year, month }: Props) {
  const { showToast } = useToast()
  const [open, setOpen]         = useState(false)
  const [preset, setPreset]     = useState<Preset>(defaultPreset)
  const [customStart, setCustomStart] = useState('')
  const [customEnd,   setCustomEnd]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleExport() {
    setError('')
    let startDate = ''
    let endDate   = ''

    if (preset === 'custom') {
      if (!customStart || !customEnd) { setError('날짜 범위를 입력하세요'); return }
      if (customStart > customEnd)    { setError('시작일이 종료일보다 늦습니다'); return }
      startDate = customStart
      endDate   = customEnd
    } else {
      const dates = presetDates(preset, year, month)
      if (dates) { startDate = dates.start; endDate = dates.end }
    }

    setLoading(true)
    try {
      const data = await fetchExportData({
        start_date: startDate || undefined,
        end_date:   endDate   || undefined,
      })
      if (data.transactions.length === 0) {
        setError('해당 기간에 거래 내역이 없습니다')
        return
      }
      exportTransactionsToExcel(data)
      setOpen(false)
      showToast('엑셀 파일을 다운로드했습니다')
    } catch (e) {
      setError(e instanceof Error ? e.message : '내보내기 실패')
    } finally {
      setLoading(false)
    }
  }

  const PRESETS: { id: Preset; label: string }[] = [
    { id: 'this_month', label: month ? `${parseInt(month.split('-')[1])}월` : '이번 달' },
    { id: 'this_year',  label: `${year ?? currentYear()}년` },
    { id: 'all',        label: '전체' },
    { id: 'custom',     label: '직접 선택' },
  ]

  return (
    <>
      {/* 내보내기 버튼 */}
      <button
        type="button"
        onClick={() => { setOpen(true); setError('') }}
        className="min-h-9 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900 flex items-center gap-1.5"
      >
        <Download size={15} strokeWidth={2.25} /> 엑셀 내보내기
      </button>

      {/* 모달 오버레이 */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-xl">
            <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-200">엑셀 내보내기</h3>
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              거래내역 / 월별요약 / 카드별정산 3개 시트로 내보냅니다
            </p>

            {/* 기간 선택 */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  className={`min-h-10 rounded-xl text-sm font-semibold transition-colors ${
                    preset === p.id
                      ? 'bg-coral-400 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* 직접 선택 시 날짜 입력 */}
            {preset === 'custom' && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">시작일</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="min-h-9 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 px-2 text-sm transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">종료일</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="min-h-9 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 px-2 text-sm transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
                  />
                </div>
              </div>
            )}

            {/* 안내 */}
            <div className="mt-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400">
              {preset === 'all'   && '전체 거래 내역을 내보냅니다'}
              {preset === 'this_month' && `${month ?? currentYM()} 기간의 거래를 내보냅니다`}
              {preset === 'this_year'  && `${year ?? currentYear()}년 1월~12월 거래를 내보냅니다`}
              {preset === 'custom'     && '선택한 기간의 거래를 내보냅니다'}
            </div>

            {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400 font-semibold">{error}</p>}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleExport}
                disabled={loading}
                className="min-h-10 flex-1 rounded-xl bg-coral-400 text-sm font-bold text-white transition-colors hover:bg-coral-600 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> 생성 중...
                  </>
                ) : (
                  <><Download size={16} strokeWidth={2.25} /> 다운로드</>
                )}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 px-4 text-sm font-semibold text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
