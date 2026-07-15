import { SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { fetchTransactions } from '../lib/api'
import { getCategories } from '../lib/categories'
import { formatWon } from '../lib/format'
import type { Card, Transaction, TransactionType } from '../types'
import ExportButton from './ExportButton'

interface Props {
  cards: Card[]
}

interface Filters {
  q: string
  type: TransactionType | ''         // '' = 전체
  dateStart: string
  dateEnd: string
  category: string                   // '' = 전체
  cardId: string                     // '' = 전체, 'cash' = 현금
  amountMin: string
  amountMax: string
}

const DEFAULT_FILTERS: Filters = {
  q: '', type: '', dateStart: '', dateEnd: '',
  category: '', cardId: '', amountMin: '', amountMax: '',
}

const EXPENSE_CATS = getCategories('expense')
const INCOME_CATS  = getCategories('income')

function activeCount(f: Filters): number {
  return [
    f.type, f.dateStart, f.dateEnd, f.category,
    f.cardId, f.amountMin, f.amountMax,
  ].filter(Boolean).length
}

function SearchView({ cards }: Props) {
  const [filters, setFilters]     = useState<Filters>(DEFAULT_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [results, setResults]     = useState<Transaction[] | null>(null)
  const [loading, setLoading]     = useState(false)

  const cardMap = new Map(cards.map((c) => [c.id, c]))

  /** 현재 필터 기준으로 카테고리 목록 (수입/지출 선택에 따라 변경) */
  function categoryList(): string[] {
    if (filters.type === 'expense') return EXPENSE_CATS
    if (filters.type === 'income')  return INCOME_CATS
    return [...EXPENSE_CATS, ...INCOME_CATS.filter((c) => !EXPENSE_CATS.includes(c))]
  }

  function set<K extends keyof Filters>(key: K, val: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: val }))
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS)
  }

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault()
    setLoading(true)
    try {
      // API: q, date_start, date_end, card_id 서버 필터
      const txs = await fetchTransactions({
        q:          filters.q.trim() || undefined,
        date_start: filters.dateStart || undefined,
        date_end:   filters.dateEnd   || undefined,
        card_id:    filters.cardId && filters.cardId !== 'cash' ? filters.cardId : undefined,
      })

      // 클라이언트 필터: type, category, 현금, 금액 범위
      const minAmt = filters.amountMin ? parseInt(filters.amountMin, 10) : null
      const maxAmt = filters.amountMax ? parseInt(filters.amountMax, 10) : null

      const filtered = txs.filter((t) => {
        if (filters.type && t.type !== filters.type) return false
        if (filters.category && t.category !== filters.category) return false
        if (filters.cardId === 'cash' && t.card_id) return false
        if (minAmt !== null && t.amount < minAmt) return false
        if (maxAmt !== null && t.amount > maxAmt) return false
        return true
      })

      setResults(filtered)
    } finally {
      setLoading(false)
    }
  }

  // 날짜별 그룹화
  const groups = new Map<string, Transaction[]>()
  if (results) {
    for (const tx of results) {
      const list = groups.get(tx.date) ?? []
      list.push(tx)
      groups.set(tx.date, list)
    }
  }

  const cnt = activeCount(filters)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-neutral-800">검색</h2>
        <ExportButton defaultPreset="all" />
      </div>

      {/* 검색 폼 */}
      <form onSubmit={handleSearch} className="space-y-3">
        {/* 키워드 입력 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={filters.q}
            onChange={(e) => set('q', e.target.value)}
            placeholder="구매처, 분류, 메모로 검색..."
            className="min-h-11 flex-1 rounded-xl border border-neutral-300 px-4 text-base transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="submit"
            disabled={loading}
            className="min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
          >
            {loading ? '...' : '검색'}
          </button>
        </div>

        {/* 필터 토글 버튼 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 rounded-xl px-3 min-h-9 text-sm font-semibold border transition-colors ${
              showFilters || cnt > 0
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <SlidersHorizontal size={15} strokeWidth={2.25} />
            필터
            {cnt > 0 && (
              <span className="ml-0.5 rounded-full bg-white text-brand-700 text-xs font-bold min-w-5 h-5 flex items-center justify-center px-1">
                {cnt}
              </span>
            )}
          </button>
          {cnt > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-neutral-400 underline hover:text-neutral-600"
            >
              필터 초기화
            </button>
          )}
        </div>

        {/* 필터 패널 */}
        {showFilters && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4 shadow-sm">

            {/* 수입 / 지출 */}
            <div>
              <p className="text-xs font-bold text-neutral-500 mb-2">구분</p>
              <div className="flex gap-2">
                {([['', '전체'], ['expense', '지출'], ['income', '수입']] as [TransactionType | '', string][]).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => { set('type', v); set('category', '') }}
                    className={`min-h-8 rounded-full px-3 text-sm font-semibold transition-colors ${
                      filters.type === v
                        ? v === 'expense' ? 'bg-red-600 text-white'
                        : v === 'income'  ? 'bg-blue-600 text-white'
                        :                   'bg-brand-600 text-white'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 날짜 범위 */}
            <div>
              <p className="text-xs font-bold text-neutral-500 mb-2">날짜 범위</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">시작일</label>
                  <input
                    type="date"
                    value={filters.dateStart}
                    onChange={(e) => set('dateStart', e.target.value)}
                    className="min-h-9 w-full rounded-xl border border-neutral-300 px-3 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">종료일</label>
                  <input
                    type="date"
                    value={filters.dateEnd}
                    onChange={(e) => set('dateEnd', e.target.value)}
                    className="min-h-9 w-full rounded-xl border border-neutral-300 px-3 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>
              {/* 빠른 날짜 선택 */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  { label: '이번 달', fn: () => {
                    const ym = new Date().toISOString().slice(0, 7)
                    set('dateStart', `${ym}-01`); set('dateEnd', `${ym}-31`)
                  }},
                  { label: '지난 달', fn: () => {
                    const d = new Date(); d.setMonth(d.getMonth() - 1)
                    const ym = d.toISOString().slice(0, 7)
                    set('dateStart', `${ym}-01`); set('dateEnd', `${ym}-31`)
                  }},
                  { label: '올해', fn: () => {
                    const y = new Date().getFullYear()
                    set('dateStart', `${y}-01-01`); set('dateEnd', `${y}-12-31`)
                  }},
                  { label: '최근 3개월', fn: () => {
                    const end = new Date().toISOString().slice(0, 10)
                    const d = new Date(); d.setMonth(d.getMonth() - 3)
                    set('dateStart', d.toISOString().slice(0, 10)); set('dateEnd', end)
                  }},
                ].map(({ label, fn }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={fn}
                    className="min-h-7 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
                  >
                    {label}
                  </button>
                ))}
                {(filters.dateStart || filters.dateEnd) && (
                  <button
                    type="button"
                    onClick={() => { set('dateStart', ''); set('dateEnd', '') }}
                    className="min-h-7 rounded-full px-2.5 text-xs font-semibold text-neutral-400 underline"
                  >
                    날짜 초기화
                  </button>
                )}
              </div>
            </div>

            {/* 분류 */}
            <div>
              <p className="text-xs font-bold text-neutral-500 mb-2">분류</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => set('category', '')}
                  className={`min-h-7 rounded-full px-3 text-xs font-semibold transition-colors ${
                    filters.category === '' ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  전체
                </button>
                {categoryList().map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set('category', c)}
                    className={`min-h-7 rounded-full px-3 text-xs font-semibold transition-colors ${
                      filters.category === c ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* 결제 방법 */}
            <div>
              <p className="text-xs font-bold text-neutral-500 mb-2">결제 방법</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => set('cardId', '')}
                  className={`min-h-7 rounded-full px-3 text-xs font-semibold transition-colors ${
                    filters.cardId === '' ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  전체
                </button>
                <button
                  type="button"
                  onClick={() => set('cardId', 'cash')}
                  className={`min-h-7 rounded-full px-3 text-xs font-semibold transition-colors ${
                    filters.cardId === 'cash' ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  현금
                </button>
                {cards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => set('cardId', card.id)}
                    className={`min-h-7 rounded-full px-3 text-xs font-semibold transition-colors ${
                      filters.cardId === card.id ? 'text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                    style={filters.cardId === card.id ? { backgroundColor: card.color } : {}}
                  >
                    {card.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 금액 범위 */}
            <div>
              <p className="text-xs font-bold text-neutral-500 mb-2">금액 범위</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    placeholder="최소 금액"
                    value={filters.amountMin}
                    onChange={(e) => set('amountMin', e.target.value)}
                    className="min-h-9 w-full rounded-xl border border-neutral-300 px-3 pr-7 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400">원~</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    placeholder="최대 금액"
                    value={filters.amountMax}
                    onChange={(e) => set('amountMax', e.target.value)}
                    className="min-h-9 w-full rounded-xl border border-neutral-300 px-3 pr-7 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400">~원</span>
                </div>
              </div>
            </div>

            {/* 검색 실행 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-10 rounded-xl bg-brand-600 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
            >
              {loading ? '검색 중...' : '필터 적용하여 검색'}
            </button>
          </div>
        )}
      </form>

      {/* 검색 결과 */}
      {results !== null && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-neutral-500">
              <span className="font-bold text-neutral-800">{results.length}건</span> 검색됨
              {filters.q && ` — "${filters.q}"`}
            </p>
            {/* 결과 요약 */}
            {results.length > 0 && (
              <p className="text-xs text-neutral-500">
                수입{' '}
                <span className="font-bold text-blue-700">
                  {formatWon(results.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0))}
                </span>
                {' / '}지출{' '}
                <span className="font-bold text-red-700">
                  {formatWon(results.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0))}
                </span>
              </p>
            )}
          </div>

          {results.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
              <p className="text-base text-neutral-500">결과가 없습니다</p>
              {cnt > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-2 text-sm text-brand-600 underline hover:text-brand-700"
                >
                  필터 초기화
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(groups.entries()).map(([date, items]) => (
                <div key={date} className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
                  <h3 className="border-b border-neutral-100 px-4 py-2.5 text-sm font-bold text-neutral-500">
                    {date}
                  </h3>
                  <ul>
                    {items.map((tx) => {
                      const card = tx.card_id ? cardMap.get(tx.card_id) : null
                      return (
                        <li
                          key={tx.id}
                          className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-neutral-50"
                        >
                          <div className="min-w-0">
                            <p className="text-base font-semibold text-neutral-900">
                              {tx.merchant || tx.category}
                            </p>
                            <div className="mt-0.5 flex flex-wrap gap-1.5">
                              {tx.merchant && (
                                <span className="text-xs text-neutral-500">{tx.category}</span>
                              )}
                              {card ? (
                                <span
                                  className="text-xs font-semibold px-1.5 py-0.5 rounded text-white"
                                  style={{ backgroundColor: card.color }}
                                >
                                  {card.name}
                                </span>
                              ) : (
                                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-600">
                                  현금
                                </span>
                              )}
                              {tx.memo && (
                                <span className="text-xs text-neutral-400">{tx.memo}</span>
                              )}
                              {/* 할인 뱃지 */}
                              {(tx.discount_amount ?? 0) > 0 && (
                                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                                  -{formatWon(tx.discount_amount)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-base font-bold ${tx.type === 'income' ? 'text-blue-700' : 'text-red-700'}`}>
                              {tx.type === 'income' ? '+' : '-'}{formatWon(tx.amount)}
                            </p>
                            {(tx.original_amount ?? 0) > 0 && (
                              <p className="text-xs text-neutral-400 line-through">
                                {formatWon(tx.original_amount)}
                              </p>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default SearchView
