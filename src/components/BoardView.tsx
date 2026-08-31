import { ChevronDown, Lock, Pencil, Pin, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useConfirm } from '../contexts/ConfirmContext'
import { useToast } from '../contexts/ToastContext'
import { createBoardPost, deleteBoardPost, fetchBoardPosts, updateBoardPost } from '../lib/api'
import type { BoardPost, BoardPostType } from '../types'

/** ISO 타임스탬프 → 'YYYY.MM.DD HH:MM' */
function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface Props {
  isAdmin: boolean
}

function BoardView({ isAdmin }: Props) {
  const showToast = useToast().showToast
  const confirm   = useConfirm()

  const [boardType, setBoardType] = useState<BoardPostType>('notice')
  const [posts, setPosts]         = useState<BoardPost[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // 글쓰기 폼
  const [writing, setWriting]     = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formPrivate, setFormPrivate] = useState(false)
  const [submitting, setSubmitting]   = useState(false)

  // 인라인 수정
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [editTitle, setEditTitle]       = useState('')
  const [editContent, setEditContent]   = useState('')
  const [editPrivate, setEditPrivate]   = useState(false)

  // 관리자 답변 초안 (postId → 텍스트)
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({})

  async function load(type: BoardPostType) {
    setLoading(true)
    setError('')
    try {
      const res = await fetchBoardPosts(type)
      setPosts(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '게시판을 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(boardType)
    setExpandedId(null)
    setWriting(false)
    setEditingId(null)
  }, [boardType])

  function switchTab(type: BoardPostType) {
    if (type === boardType) return
    setBoardType(type)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formTitle.trim() || !formContent.trim()) {
      setError('제목과 내용을 입력해주세요')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createBoardPost({
        type: boardType,
        title: formTitle.trim(),
        content: formContent.trim(),
        is_private: boardType === 'qna' ? formPrivate : undefined,
      })
      setFormTitle('')
      setFormContent('')
      setFormPrivate(false)
      setWriting(false)
      showToast(boardType === 'notice' ? '공지를 등록했어요' : '문의를 등록했어요')
      await load(boardType)
    } catch (err) {
      setError(err instanceof Error ? err.message : '글을 등록하지 못했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(post: BoardPost) {
    setEditingId(post.id)
    setEditTitle(post.title)
    setEditContent(post.content)
    setEditPrivate(post.is_private)
  }

  async function saveEdit(post: BoardPost) {
    if (!editTitle.trim() || !editContent.trim()) {
      showToast('제목과 내용을 입력해주세요')
      return
    }
    try {
      await updateBoardPost(post.id, {
        title: editTitle.trim(),
        content: editContent.trim(),
        is_private: post.type === 'qna' ? editPrivate : undefined,
      })
      setEditingId(null)
      showToast('수정했어요')
      await load(boardType)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '수정하지 못했습니다')
    }
  }

  async function handleDelete(post: BoardPost) {
    const ok = await confirm(post.type === 'notice' ? '이 공지를 삭제할까요?' : '이 문의를 삭제할까요?')
    if (!ok) return
    try {
      await deleteBoardPost(post.id)
      showToast('삭제했어요')
      await load(boardType)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '삭제하지 못했습니다')
    }
  }

  async function togglePin(post: BoardPost) {
    try {
      await updateBoardPost(post.id, { is_pinned: !post.is_pinned })
      await load(boardType)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '고정 상태를 바꾸지 못했습니다')
    }
  }

  async function saveAnswer(post: BoardPost) {
    const draft = (answerDrafts[post.id] ?? post.answer ?? '').trim()
    if (!draft) {
      showToast('답변 내용을 입력해주세요')
      return
    }
    try {
      await updateBoardPost(post.id, { answer: draft })
      showToast('답변을 등록했어요')
      await load(boardType)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '답변을 등록하지 못했습니다')
    }
  }

  async function clearAnswer(post: BoardPost) {
    const ok = await confirm('답변을 삭제할까요?')
    if (!ok) return
    try {
      await updateBoardPost(post.id, { answer: null })
      setAnswerDrafts((d) => ({ ...d, [post.id]: '' }))
      showToast('답변을 삭제했어요')
      await load(boardType)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '답변을 삭제하지 못했습니다')
    }
  }

  const canWrite = boardType === 'qna' || isAdmin
  const inputClass =
    'min-h-11 w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-base transition-colors focus:border-coral-400 focus:outline-none focus:ring-2 focus:ring-coral-50 dark:focus:ring-coral-900/40'

  return (
    <div className="space-y-4">
      {/* 공지 / 문의 서브탭 */}
      <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1">
        {(['notice', 'qna'] as BoardPostType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchTab(t)}
            className={`flex-1 min-h-9 rounded-lg text-sm font-semibold transition-colors ${
              boardType === t
                ? 'bg-white dark:bg-neutral-900 text-coral-600 dark:text-coral-200 shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
            }`}
          >
            {t === 'notice' ? '공지사항' : '문의(Q&A)'}
          </button>
        ))}
      </div>

      {/* 글쓰기 버튼 / 폼 */}
      {canWrite && !writing && (
        <button
          type="button"
          onClick={() => { setWriting(true); setError('') }}
          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-coral-400 text-sm font-bold text-white transition-colors hover:bg-coral-600 active:bg-coral-800"
        >
          <Plus size={17} strokeWidth={2.5} />
          {boardType === 'notice' ? '공지 작성' : '문의 작성'}
        </button>
      )}

      {canWrite && writing && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm">
          <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
            {boardType === 'notice' ? '새 공지 작성' : '새 문의 작성'}
          </p>
          <input
            type="text"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="제목"
            maxLength={200}
            className={inputClass}
          />
          <textarea
            value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
            placeholder="내용을 입력해주세요"
            rows={6}
            maxLength={10000}
            className={`${inputClass} resize-y py-2 leading-relaxed`}
          />
          {boardType === 'qna' && (
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">
              <input
                type="checkbox"
                checked={formPrivate}
                onChange={(e) => setFormPrivate(e.target.checked)}
                className="h-4 w-4 rounded border-2 border-neutral-300 dark:border-neutral-700 accent-coral-400"
              />
              비공개 (나와 관리자만 볼 수 있어요)
            </label>
          )}
          {error && (
            <p className="rounded-xl bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm font-semibold text-red-700 dark:text-red-400">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="min-h-11 flex-1 rounded-xl bg-coral-400 text-sm font-bold text-white transition-colors hover:bg-coral-600 active:bg-coral-800 disabled:opacity-50"
            >
              {submitting ? '등록 중...' : '등록'}
            </button>
            <button
              type="button"
              onClick={() => { setWriting(false); setError('') }}
              className="min-h-11 rounded-xl border border-neutral-300 dark:border-neutral-700 px-4 text-sm font-semibold text-neutral-600 dark:text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              취소
            </button>
          </div>
        </form>
      )}

      {/* 목록 */}
      {loading ? (
        <p className="py-10 text-center text-sm text-neutral-400 dark:text-neutral-500">불러오는 중...</p>
      ) : error && !writing ? (
        <p className="rounded-xl bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm font-semibold text-red-700 dark:text-red-400">{error}</p>
      ) : posts.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-400 dark:text-neutral-500">
          {boardType === 'notice' ? '등록된 공지가 없어요' : '등록된 문의가 없어요'}
        </p>
      ) : (
        <ul className="space-y-2">
          {posts.map((post) => {
            const expanded = expandedId === post.id
            const isEditing = editingId === post.id
            return (
              <li
                key={post.id}
                className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm"
              >
                {/* 헤더 */}
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : post.id)}
                  className="flex w-full items-start gap-2 px-4 py-3 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {post.is_pinned && (
                        <Pin size={14} className="shrink-0 text-coral-500" fill="currentColor" />
                      )}
                      {post.is_private && (
                        <Lock size={13} className="shrink-0 text-neutral-400" />
                      )}
                      <span className="font-bold text-neutral-900 dark:text-neutral-100">{post.title}</span>
                      {post.type === 'qna' && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                            post.answer
                              ? 'bg-coral-50 text-coral-600 dark:bg-coral-900/40 dark:text-coral-200'
                              : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                          }`}
                        >
                          {post.answer ? '답변완료' : '답변대기'}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                      {post.author_name} · {formatTimestamp(post.created_at)}
                    </p>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`mt-0.5 shrink-0 text-neutral-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* 펼친 내용 */}
                {expanded && (
                  <div className="border-t border-neutral-100 dark:border-neutral-800 px-4 py-3">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          maxLength={200}
                          className={inputClass}
                        />
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={6}
                          maxLength={10000}
                          className={`${inputClass} resize-y py-2 leading-relaxed`}
                        />
                        {post.type === 'qna' && (
                          <label className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                            <input
                              type="checkbox"
                              checked={editPrivate}
                              onChange={(e) => setEditPrivate(e.target.checked)}
                              className="h-4 w-4 rounded border-2 border-neutral-300 dark:border-neutral-700 accent-coral-400"
                            />
                            비공개
                          </label>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveEdit(post)}
                            className="min-h-10 flex-1 rounded-xl bg-coral-400 text-sm font-bold text-white transition-colors hover:bg-coral-600"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="min-h-10 rounded-xl border border-neutral-300 dark:border-neutral-700 px-4 text-sm font-semibold text-neutral-600 dark:text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                        {post.content}
                      </p>
                    )}

                    {/* Q&A 답변 영역 */}
                    {post.type === 'qna' && !isEditing && (
                      <div className="mt-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 p-3">
                        <p className="text-xs font-bold text-coral-600 dark:text-coral-300">관리자 답변</p>
                        {isAdmin ? (
                          <div className="mt-1.5 space-y-2">
                            <textarea
                              value={answerDrafts[post.id] ?? post.answer ?? ''}
                              onChange={(e) => setAnswerDrafts((d) => ({ ...d, [post.id]: e.target.value }))}
                              rows={3}
                              maxLength={10000}
                              placeholder="답변을 입력해주세요"
                              className={`${inputClass} resize-y py-2 text-sm leading-relaxed`}
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => saveAnswer(post)}
                                className="min-h-9 rounded-lg bg-coral-400 px-3 text-sm font-bold text-white transition-colors hover:bg-coral-600"
                              >
                                {post.answer ? '답변 수정' : '답변 등록'}
                              </button>
                              {post.answer && (
                                <button
                                  type="button"
                                  onClick={() => clearAnswer(post)}
                                  className="min-h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 text-sm font-semibold text-neutral-600 dark:text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                >
                                  답변 삭제
                                </button>
                              )}
                            </div>
                          </div>
                        ) : post.answer ? (
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                            {post.answer}
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-500">아직 답변이 없어요</p>
                        )}
                        {post.answer && post.answered_at && !isAdmin && (
                          <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">{formatTimestamp(post.answered_at)}</p>
                        )}
                      </div>
                    )}

                    {/* 액션 버튼 */}
                    {!isEditing && (post.can_edit || (isAdmin && post.type === 'notice')) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {isAdmin && post.type === 'notice' && (
                          <button
                            type="button"
                            onClick={() => togglePin(post)}
                            className="flex min-h-9 items-center gap-1 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 text-xs font-semibold text-neutral-600 dark:text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          >
                            <Pin size={13} />
                            {post.is_pinned ? '고정 해제' : '상단 고정'}
                          </button>
                        )}
                        {post.can_edit && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(post)}
                              className="flex min-h-9 items-center gap-1 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 text-xs font-semibold text-neutral-600 dark:text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            >
                              <Pencil size={13} />
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(post)}
                              className="flex min-h-9 items-center gap-1 rounded-lg border border-red-200 dark:border-red-900 px-3 text-xs font-semibold text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
                            >
                              <Trash2 size={13} />
                              삭제
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default BoardView
