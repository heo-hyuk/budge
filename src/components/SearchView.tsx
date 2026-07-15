import { useState } from 'react'
import { fetchTransactions } from '../lib/api'
import { formatWon } from '../lib/format'
import type { Card, Transaction } from '../types'
import ExportButton from './ExportButton'

interface Props {
  cards: Card[]
}

function SearchView({ cards }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Transaction[] | null>(null)
  const [loading, setLoading] = useState(false)

  // 카드 ID → 카드명 매핑
  const cardMap = new Map(cards.map((c) => [c.id, c]))

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    try {
      const txs = await fetchTransactions({ q: query.trim() })
      setResults(txs)
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-neutral-800">검색</h2>
        <ExportButton defaultPreset="all" />
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="구매처, 분류, 메모로 검색..."
          className="min-h-11 flex-1 rounded-xl border-2 border-neutral-300 px-4 text-base focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="min-h-11 rounded-xl bg-neutral-900 px-5 text-sm font-bold text-white disabled:opacity-40"
        >
          {loading ? '...' : '검색'}
        </button>
      </form>

      {results !== null && (
        <>
          <p className="text-sm text-neutral-500">
            <span className="font-bold text-neutral-800">{results.length}건</span> 검색됨
            {query && ` — "${query}"`}
          </p>

          {results.length === 0 ? (
            <div className="rounded-2xl border-2 border-neutral-200 bg-white p-8 text-center shadow-sm">
              <p className="text-base text-neutral-500">결과가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(groups.entries()).map(([date, items]) => (
                <div key={date} className="rounded-2xl border-2 border-neutral-200 bg-white shadow-sm">
                  <h3 className="border-b-2 border-neutral-100 px-4 py-2.5 text-sm font-bold text-neutral-500">
                    {date}
                  </h3>
                  <ul>
                    {items.map((tx) => {
                      const card = tx.card_id ? cardMap.get(tx.card_id) : null
                      return (
                        <li
                          key={tx.id}
                          className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 last:border-b-0"
                        >
                          <div className="min-w-0">
                            {/* 구매처 또는 분류 */}
                            <p className="text-base font-semibold text-neutral-900">
                              {tx.merchant || tx.category}
                            </p>
                            <div className="mt-0.5 flex flex-wrap gap-1.5">
                              {tx.merchant && (
                                <span className="text-xs text-neutral-500">{tx.category}</span>
                              )}
                              {/* 결제 방법 뱃지 */}
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
                            </div>
                          </div>
                          <span
                            className={`shrink-0 text-base font-bold ${
                              tx.type === 'income' ? 'text-blue-700' : 'text-red-700'
                            }`}
                          >
                            {tx.type === 'income' ? '+' : '-'}{formatWon(tx.amount)}
                          </span>
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
