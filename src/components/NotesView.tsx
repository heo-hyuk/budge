import { Pencil, Plus, RotateCw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import { useToast } from '../contexts/ToastContext'
import { deleteNote, fetchNotes, saveNote, updateNote } from '../lib/api'
import { addCustomNoteCategory, getNoteCategories } from '../lib/noteCategories'
import type { Note } from '../types'

interface Props {
  month: string // 'YYYY-MM'
}

interface EditTarget {
  date: string
  note: Note | null // null = 새 메모 추가
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function NotesView({ month }: Props) {
  const { showToast } = useToast()
  const [notes, setNotes]     = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [editTarget, setEditTarget]   = useState<EditTarget | null>(null)
  const [categories, setCategories]   = useState(() => getNoteCategories())
  const [category, setCategory]       = useState(categories[0])
  const [content, setContent]         = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [saving, setSaving]           = useState(false)
  const [deletingId, setDeletingId]   = useState<string | null>(null)

  function load() {
    setLoading(true)
    setError('')
    fetchNotes(month)
      .then(setNotes)
      .catch((err) => setError(err instanceof Error ? err.message : '메모를 불러오지 못했습니다'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [month])

  // 날짜별로 여러 건이 있을 수 있어 배열로 그룹화
  const notesByDate = new Map<string, Note[]>()
  for (const n of notes) {
    const list = notesByDate.get(n.date) ?? []
    list.push(n)
    notesByDate.set(n.date, list)
  }

  const [year, mon] = month.split('-').map(Number)
  const totalDays = daysInMonth(year, mon)
  const dates = Array.from({ length: totalDays }, (_, i) =>
    `${year}-${String(mon).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
  )

  function startAdd(date: string) {
    setEditTarget({ date, note: null })
    setAddingCategory(false)
    setCategories(getNoteCategories())
    setCategory(getNoteCategories()[0])
    setContent('')
  }

  function startEdit(date: string, note: Note) {
    setEditTarget({ date, note })
    setAddingCategory(false)
    setCategories(getNoteCategories())
    setCategory(note.category)
    setContent(note.content)
  }

  function cancelEdit() {
    setEditTarget(null)
    setContent('')
    setAddingCategory(false)
  }

  function handleAddCategory() {
    const trimmed = newCategory.trim()
    if (!trimmed) { setAddingCategory(false); return }
    const updated = addCustomNoteCategory(trimmed)
    setCategories(updated)
    setCategory(trimmed)
    setNewCategory('')
    setAddingCategory(false)
  }

  async function handleSave() {
    if (!editTarget) return
    if (!content.trim()) { showToast('내용을 입력해주세요', 'error'); return }
    setSaving(true)
    try {
      if (editTarget.note) {
        await updateNote(editTarget.note.id, { category, content: content.trim() })
      } else {
        await saveNote({ date: editTarget.date, category, content: content.trim() })
      }
      load()
      cancelEdit()
      showToast('메모를 저장했습니다')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '메모를 저장하지 못했습니다', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(note: Note) {
    if (!window.confirm('이 메모를 삭제할까요?')) return
    setDeletingId(note.id)
    try {
      await deleteNote(note.id)
      setNotes((prev) => prev.filter((n) => n.id !== note.id))
      showToast('메모를 삭제했습니다')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '메모를 삭제하지 못했습니다', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-base text-neutral-500 dark:text-neutral-400">
        <LoadingSpinner size={18} /> 불러오는 중...
      </p>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4">
        <p className="text-base font-semibold text-red-700 dark:text-red-400">{error}</p>
        <button
          type="button"
          onClick={load}
          className="shrink-0 flex items-center gap-1.5 rounded-lg bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-red-700 dark:text-red-400 transition-colors hover:bg-red-100 dark:hover:bg-red-900/50"
        >
          <RotateCw size={13} /> 다시 시도
        </button>
      </div>
    )
  }

  // 카테고리 선택 + textarea + 저장/취소 버튼 (신규/수정 공용)
  function renderEditForm() {
    return (
      <div className="space-y-2 rounded-xl border border-coral-200 dark:border-coral-900 bg-coral-50/40 dark:bg-coral-900/20 p-3">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`min-h-7 rounded-full px-2.5 text-xs font-semibold transition-colors ${
                category === c ? 'bg-coral-400 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              {c}
            </button>
          ))}
          {!addingCategory && (
            <button
              type="button"
              onClick={() => setAddingCategory(true)}
              className="min-h-7 rounded-full border border-dashed border-neutral-300 dark:border-neutral-700 px-2.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400 transition-colors hover:border-coral-200 dark:hover:border-coral-900 hover:text-coral-400 dark:hover:text-coral-300"
            >
              + 직접입력
            </button>
          )}
        </div>
        {addingCategory && (
          <div className="flex gap-2">
            <input
              type="text"
              autoFocus
              placeholder="새 카테고리 이름"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory() } }}
              className="min-h-8 flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 px-2.5 text-sm transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
            />
            <button
              type="button"
              onClick={handleAddCategory}
              className="min-h-8 rounded-lg bg-coral-400 px-3 text-sm font-semibold text-white transition-colors hover:bg-coral-600"
            >
              추가
            </button>
          </div>
        )}
        <textarea
          autoFocus={!addingCategory}
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="오늘 있었던 일, 만난 사람 등을 적어보세요"
          className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="min-h-8 flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-coral-400 text-sm font-bold text-white transition-colors hover:bg-coral-600 disabled:opacity-50"
          >
            {saving ? <><LoadingSpinner size={13} /> 처리 중...</> : '저장'}
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            className="min-h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-3 text-sm font-semibold text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
          >
            취소
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
      <ul>
        {dates.map((date) => {
          const dayNotes = notesByDate.get(date) ?? []
          const day = parseInt(date.split('-')[2], 10)
          const weekday = WEEKDAY_LABELS[new Date(date).getDay()]
          const isToday = date === todayStr()
          const isAddingHere = editTarget?.date === date && editTarget.note === null

          return (
            <li
              key={date}
              className={`flex items-start gap-3 border-b border-neutral-100 dark:border-neutral-800 px-4 py-3 last:border-b-0 ${isToday ? 'bg-coral-50/60 dark:bg-coral-900/25' : ''}`}
            >
              {/* 날짜 열 — 엑셀처럼 좌측에 세로로 고정 */}
              <div className={`w-12 shrink-0 text-center ${isToday ? 'text-coral-600 dark:text-coral-200' : 'text-neutral-500 dark:text-neutral-400'}`}>
                <p className="text-base font-bold leading-tight">{day}</p>
                <p className="text-xs leading-tight">{weekday}</p>
              </div>

              {/* 내용 열 — 하루에 여러 건이 있을 수 있어 세로로 쌓아서 표시 */}
              <div className="min-w-0 flex-1 space-y-2">
                {dayNotes.map((note) =>
                  editTarget?.note?.id === note.id ? (
                    <div key={note.id}>{renderEditForm()}</div>
                  ) : (
                    <div key={note.id} className="group flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="inline-block rounded bg-coral-50 dark:bg-coral-900/30 px-1.5 py-0.5 text-xs font-semibold text-coral-600 dark:text-coral-200">
                          {note.category}
                        </span>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-800 dark:text-neutral-200">{note.content}</p>
                      </div>
                      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => startEdit(date, note)}
                          aria-label="메모 수정"
                          className="rounded-md p-1.5 text-neutral-400 dark:text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-600 dark:hover:text-neutral-300"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(note)}
                          disabled={deletingId === note.id}
                          aria-label="메모 삭제"
                          className="rounded-md p-1.5 text-neutral-400 dark:text-neutral-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/40 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                        >
                          {deletingId === note.id ? <LoadingSpinner size={14} /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </div>
                  )
                )}

                {isAddingHere ? (
                  renderEditForm()
                ) : (
                  <button
                    type="button"
                    onClick={() => startAdd(date)}
                    className={`flex items-center gap-1 text-sm transition-colors ${
                      dayNotes.length === 0 ? 'text-neutral-300 dark:text-neutral-600 hover:text-coral-400 dark:hover:text-coral-300' : 'text-neutral-400 dark:text-neutral-500 hover:text-coral-400 dark:hover:text-coral-300'
                    }`}
                  >
                    <Plus size={13} /> 메모 추가
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default NotesView
