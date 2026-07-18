import { CalendarDays, ImagePlus, List, Pencil, Plus, RotateCw, Settings2, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import LoadingSpinner from './LoadingSpinner'
import { useConfirm } from '../contexts/ConfirmContext'
import { useToast } from '../contexts/ToastContext'
import { deleteNote, fetchNotes, noteImageUrl, saveNote, updateNote } from '../lib/api'
import { addCustomNoteCategory, getNoteCategories, isDefaultNoteCategory, removeCustomNoteCategory } from '../lib/noteCategories'
import type { Note } from '../types'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB, 서버 검증과 동일한 상한

interface Props {
  month: string // 'YYYY-MM'
}

interface EditTarget {
  date: string
  note: Note | null // null = 새 메모 추가
}

type ViewMode = 'list' | 'calendar'

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
  const confirm = useConfirm()
  const [notes, setNotes]     = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [view, setView]       = useState<ViewMode>('list')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const [editTarget, setEditTarget]   = useState<EditTarget | null>(null)
  const [categories, setCategories]   = useState(() => getNoteCategories())
  const [category, setCategory]       = useState(categories[0])
  const [content, setContent]         = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [manageCategories, setManageCategories] = useState(false)
  const [saving, setSaving]           = useState(false)
  const [deletingId, setDeletingId]   = useState<string | null>(null)

  // 첨부 이미지 — 새로 선택한 파일(imageFile)이 있으면 우선, 없고 수정 중인 메모에
  // 기존 이미지가 있으면(removeExistingImage=false) 그걸 보여줌
  const [imageFile, setImageFile]     = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [removeExistingImage, setRemoveExistingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function resetImageState() {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImageFile(null)
    setImagePreviewUrl(null)
    setRemoveExistingImage(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('이미지 파일만 첨부할 수 있습니다', 'error')
      e.target.value = ''
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showToast('이미지 용량은 5MB 이하만 가능합니다', 'error')
      e.target.value = ''
      return
    }
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImageFile(file)
    setImagePreviewUrl(URL.createObjectURL(file))
    setRemoveExistingImage(false)
  }

  function load() {
    setLoading(true)
    setError('')
    fetchNotes(month)
      .then(setNotes)
      .catch((err) => setError(err instanceof Error ? err.message : '메모를 불러오지 못했습니다'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [month])

  // 달력에서 선택한 날짜는 월이 바뀌면 의미가 없어지므로, 이번 달이면 오늘을 기본 선택
  useEffect(() => {
    setSelectedDate(todayStr().slice(0, 7) === month ? todayStr() : null)
  }, [month])

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
  // 달력 그리드 채우기용 앞/뒤 빈 칸 — 1일의 요일만큼 앞을, 마지막 주를 7칸으로 맞추기 위해 뒤를 채움
  const leadingBlanks = new Date(year, mon - 1, 1).getDay()
  const trailingBlanks = (7 - ((leadingBlanks + totalDays) % 7)) % 7

  function startAdd(date: string) {
    setEditTarget({ date, note: null })
    setAddingCategory(false)
    setManageCategories(false)
    setCategories(getNoteCategories())
    setCategory(getNoteCategories()[0])
    setContent('')
    resetImageState()
  }

  function startEdit(date: string, note: Note) {
    setEditTarget({ date, note })
    setAddingCategory(false)
    setManageCategories(false)
    setCategories(getNoteCategories())
    setCategory(note.category)
    setContent(note.content)
    resetImageState()
  }

  function cancelEdit() {
    setEditTarget(null)
    setContent('')
    setAddingCategory(false)
    setManageCategories(false)
    resetImageState()
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

  async function handleDeleteCategory(name: string) {
    if (!(await confirm(`"${name}" 분류를 삭제할까요? 이미 이 분류로 저장된 메모는 그대로 남습니다.`))) return
    const updated = removeCustomNoteCategory(name)
    setCategories(updated)
    if (category === name) setCategory(updated[0])
  }

  async function handleSave() {
    if (!editTarget) return
    if (!content.trim()) { showToast('내용을 입력해주세요', 'error'); return }
    setSaving(true)
    try {
      if (editTarget.note) {
        await updateNote(editTarget.note.id, { category, content: content.trim() }, {
          image: imageFile,
          removeImage: removeExistingImage,
        })
      } else {
        await saveNote({ date: editTarget.date, category, content: content.trim() }, imageFile)
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
    if (!(await confirm('이 메모를 삭제할까요?'))) return
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

  // 이미지 첨부 필드 — 새로 고른 파일 미리보기 > 기존 첨부 이미지 > 첨부 버튼 순으로 표시
  function renderImageAttachField() {
    const existingImageKey = editTarget?.note?.image_key
    const showExisting = !imageFile && !removeExistingImage && !!existingImageKey

    if (imageFile && imagePreviewUrl) {
      return (
        <div className="relative inline-block">
          <img src={imagePreviewUrl} alt="첨부할 이미지 미리보기" className="max-h-32 rounded-lg border border-neutral-200 dark:border-neutral-800 object-cover" />
          <button
            type="button"
            onClick={resetImageState}
            aria-label="첨부 이미지 제거"
            className="absolute -right-2 -top-2 rounded-full bg-neutral-900/80 p-1 text-white transition-colors hover:bg-neutral-900"
          >
            <X size={12} />
          </button>
        </div>
      )
    }

    if (showExisting && editTarget?.note) {
      return (
        <div className="relative inline-block">
          <img src={noteImageUrl(editTarget.note.id)} alt="첨부된 이미지" className="max-h-32 rounded-lg border border-neutral-200 dark:border-neutral-800 object-cover" />
          <button
            type="button"
            onClick={() => setRemoveExistingImage(true)}
            aria-label="첨부 이미지 제거"
            className="absolute -right-2 -top-2 rounded-full bg-neutral-900/80 p-1 text-white transition-colors hover:bg-neutral-900"
          >
            <X size={12} />
          </button>
        </div>
      )
    }

    return (
      <label className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 px-2.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400 transition-colors hover:border-coral-200 dark:hover:border-coral-900 hover:text-coral-400 dark:hover:text-coral-300">
        <ImagePlus size={14} /> 스크린샷/사진 첨부
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />
      </label>
    )
  }

  // 카테고리 선택 + textarea + 저장/취소 버튼 (신규/수정 공용)
  function renderEditForm() {
    return (
      <div className="space-y-2 rounded-xl border border-coral-200 dark:border-coral-900 bg-coral-50/40 dark:bg-coral-900/20 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((c) => {
            const deletable = manageCategories && !isDefaultNoteCategory(c)
            return (
              <div key={c} className="relative">
                <button
                  type="button"
                  onClick={() => (deletable ? handleDeleteCategory(c) : setCategory(c))}
                  className={`min-h-7 rounded-full px-2.5 text-xs font-semibold transition-colors ${deletable ? 'pr-6' : ''} ${
                    category === c && !deletable ? 'bg-coral-400 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {c}
                </button>
                {deletable && (
                  <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-red-500 dark:text-red-400">
                    <X size={11} />
                  </span>
                )}
              </div>
            )
          })}
          {!addingCategory && !manageCategories && (
            <button
              type="button"
              onClick={() => setAddingCategory(true)}
              className="min-h-7 rounded-full border border-dashed border-neutral-300 dark:border-neutral-700 px-2.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400 transition-colors hover:border-coral-200 dark:hover:border-coral-900 hover:text-coral-400 dark:hover:text-coral-300"
            >
              + 직접입력
            </button>
          )}
          <button
            type="button"
            onClick={() => setManageCategories((m) => !m)}
            aria-label={manageCategories ? '분류 관리 종료' : '분류 관리'}
            className={`ml-auto flex min-h-7 items-center gap-1 rounded-full px-2.5 text-xs font-semibold transition-colors ${
              manageCategories ? 'bg-neutral-700 text-white dark:bg-neutral-200 dark:text-neutral-900' : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300'
            }`}
          >
            <Settings2 size={12} /> {manageCategories ? '완료' : '관리'}
          </button>
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
        {renderImageAttachField()}
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

  // 메모 한 건 렌더링(카테고리 배지 + 내용 + 수정/삭제 버튼) — 목록/달력 상세 공용
  // card=true(달력 상세)면 각 메모를 테두리 있는 카드 박스로 감싸고 버튼을 항상 노출
  // (목록 뷰는 한 줄씩 촘촘히 나열되므로 기존처럼 hover로만 노출해 시각적 잡음을 줄임)
  function renderNoteItem(date: string, note: Note, card = false) {
    if (editTarget?.note?.id === note.id) {
      return <div key={note.id}>{renderEditForm()}</div>
    }
    return (
      <div
        key={note.id}
        className={`group flex items-start justify-between gap-2 ${
          card ? 'rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-3' : ''
        }`}
      >
        <div className="min-w-0">
          <span className="inline-block rounded bg-coral-50 dark:bg-coral-900/30 px-1.5 py-0.5 text-xs font-semibold text-coral-600 dark:text-coral-200">
            {note.category}
          </span>
          <p className={`mt-1 whitespace-pre-wrap break-words text-neutral-800 dark:text-neutral-200 ${card ? 'text-base leading-relaxed' : 'text-sm'}`}>{note.content}</p>
          {note.image_key && (
            <a href={noteImageUrl(note.id)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block">
              <img
                src={noteImageUrl(note.id)}
                alt="첨부 이미지"
                className={`rounded-lg border border-neutral-200 dark:border-neutral-800 object-cover ${card ? 'max-h-40' : 'max-h-24'}`}
              />
            </a>
          )}
        </div>
        <div className={`flex shrink-0 gap-1 transition-opacity ${card ? '' : 'opacity-0 group-hover:opacity-100'}`}>
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
  }

  // 새 메모 추가 폼 또는 트리거 버튼 — 목록/달력 상세 공용
  function renderAddTrailer(date: string, emphasize: boolean) {
    if (editTarget?.date === date && editTarget.note === null) return renderEditForm()
    return (
      <button
        type="button"
        onClick={() => startAdd(date)}
        className={`flex items-center gap-1 text-sm transition-colors ${
          emphasize ? 'text-neutral-300 dark:text-neutral-600 hover:text-coral-400 dark:hover:text-coral-300' : 'text-neutral-400 dark:text-neutral-500 hover:text-coral-400 dark:hover:text-coral-300'
        }`}
      >
        <Plus size={13} /> 메모 추가
      </button>
    )
  }

  return (
    <div className="space-y-3">
      {/* 목록/달력 보기 전환 */}
      <div className="flex justify-end">
        <div className="inline-flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1">
          <button
            type="button"
            onClick={() => setView('list')}
            className={`flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${
              view === 'list' ? 'bg-white dark:bg-neutral-900 text-coral-600 dark:text-coral-200 shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
            }`}
          >
            <List size={14} /> 목록
          </button>
          <button
            type="button"
            onClick={() => setView('calendar')}
            className={`flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${
              view === 'calendar' ? 'bg-white dark:bg-neutral-900 text-coral-600 dark:text-coral-200 shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
            }`}
          >
            <CalendarDays size={14} /> 달력
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
          <ul>
            {dates.map((date) => {
              const dayNotes = notesByDate.get(date) ?? []
              const day = parseInt(date.split('-')[2], 10)
              const weekday = WEEKDAY_LABELS[new Date(date).getDay()]
              const isToday = date === todayStr()

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
                    {dayNotes.map((note) => renderNoteItem(date, note))}
                    {renderAddTrailer(date, dayNotes.length === 0)}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 달력 그리드 — 폭을 좁혀 셀을 작게 만들고, 아래 메모 상세가 상대적으로 더
              눈에 띄게 함 */}
          <div className="mx-auto w-full max-w-[300px] rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm p-2.5">
            <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[11px] font-semibold text-neutral-400 dark:text-neutral-500">
              {WEEKDAY_LABELS.map((w) => <div key={w}>{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {Array.from({ length: leadingBlanks }, (_, i) => <div key={`lead-${i}`} />)}
              {dates.map((date) => {
                const dayNotes = notesByDate.get(date) ?? []
                const day = parseInt(date.split('-')[2], 10)
                const isToday = date === todayStr()
                const isSelected = date === selectedDate

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md text-xs transition-colors ${
                      isSelected
                        ? 'bg-coral-400 text-white font-bold'
                        : isToday
                        ? 'bg-coral-50 dark:bg-coral-900/30 text-coral-600 dark:text-coral-200 font-bold'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span>{day}</span>
                    {dayNotes.length > 0 && (
                      <span className={`h-1 w-1 rounded-full ${isSelected ? 'bg-white' : 'bg-coral-400'}`} />
                    )}
                  </button>
                )
              })}
              {Array.from({ length: trailingBlanks }, (_, i) => <div key={`trail-${i}`} />)}
            </div>
          </div>

          {/* 선택한 날짜의 메모 상세 — 코랄 액센트 + 넉넉한 여백으로 달력보다 시선이
              먼저 가도록 강조 */}
          {selectedDate && (
            <div className="rounded-2xl border border-l-4 border-neutral-200 dark:border-neutral-800 border-l-coral-400 bg-white dark:bg-neutral-900 shadow-sm p-5">
              <p className="mb-3 text-base font-extrabold text-neutral-800 dark:text-neutral-200">
                {parseInt(selectedDate.split('-')[2], 10)}일 ({WEEKDAY_LABELS[new Date(selectedDate).getDay()]})
              </p>
              <div className="space-y-2.5">
                {(notesByDate.get(selectedDate) ?? []).map((note) => renderNoteItem(selectedDate, note, true))}
                {renderAddTrailer(selectedDate, (notesByDate.get(selectedDate) ?? []).length === 0)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default NotesView
