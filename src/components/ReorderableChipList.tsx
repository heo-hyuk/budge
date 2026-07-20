import { useEffect, useRef, useState } from 'react'

interface Props<T extends string> {
  items: T[]
  draggable: boolean  // 관리 모드일 때만 true — 평소엔 그냥 탭(선택)만 동작
  onReorder: (order: T[]) => void  // 드래그로 순서가 바뀌어 손을 뗐을 때(서버 저장 트리거)
  onTap: (item: T) => void  // 드래그 없이 탭만 했을 때(선택 또는 삭제 — 호출부가 정의)
  renderChip: (item: T, dragging: boolean) => React.ReactNode
}

// 분류/구매처/메모 분류 관리 모드에서 공용으로 쓰는 드래그 앤 드롭 재정렬 칩 목록.
// 외부 드래그 라이브러리 없이 Pointer Events만으로 구현(마우스/터치/펜 통합 처리).
// pointerdown 지점에서 일정 거리 이상 움직여야 "드래그"로 간주하고, 그전에 손을
// 떼면 "탭"으로 처리해 기존 선택/삭제 동작과 자연스럽게 공존한다.
const DRAG_THRESHOLD = 6

export default function ReorderableChipList<T extends string>({ items, draggable, onReorder, onTap, renderChip }: Props<T>) {
  const [order, setOrder] = useState<T[]>(items)
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const chipRefs = useRef(new Map<number, HTMLElement>())
  const dragState = useRef<{ idx: number; startX: number; startY: number; dragging: boolean } | null>(null)
  // setOrder 콜백이 리액트 배칭으로 나중에 실행되더라도 onReorder에 항상 최신 배열을
  // 넘길 수 있도록 별도로 동기 추적(리액트 state 자체는 커밋 전까지 못 읽으므로)
  const orderRef = useRef(items)

  // 관리 모드 밖에서 분류가 추가/삭제되는 등 외부에서 items가 바뀌면 로컬 상태 동기화
  useEffect(() => {
    setOrder(items)
    orderRef.current = items
  }, [items])

  function handlePointerDown(idx: number, e: React.PointerEvent) {
    // draggable 여부와 무관하게 항상 추적 — 평소(비관리) 모드에서도 "드래그 없이 뗐다"를
    // 판단해 탭 선택으로 처리해야 하기 때문. 실제 드래그 동작만 draggable일 때로 제한
    dragState.current = { idx, startX: e.clientX, startY: e.clientY, dragging: false }
    if (draggable) {
      // 포인터 캡처: 손가락/마우스가 칩 사이 여백으로 빠르게 스쳐가도 move/up 이벤트를
      // 계속 이 요소가 받도록 고정(캡처 없으면 요소 사이 빈틈에서 이벤트가 끊길 수 있음).
      // 평소 모드에선 캡처하지 않아야 페이지 스크롤이 방해받지 않음
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const st = dragState.current
    if (!st || !draggable) return
    const dx = e.clientX - st.startX
    const dy = e.clientY - st.startY
    if (!st.dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      st.dragging = true
      setDraggingIdx(st.idx)
    }
    e.preventDefault()

    let overIdx: number | null = null
    chipRefs.current.forEach((el, idx) => {
      const rect = el.getBoundingClientRect()
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        overIdx = idx
      }
    })
    if (overIdx !== null && overIdx !== st.idx) {
      // st.idx는 이 함수 마지막에 다시 갱신되는 가변 ref라, setOrder 콜백을 나중에(리액트가
      // 배칭해서) 실행할 때 그 시점의 st.idx를 읽으면 이미 갱신된 값이라 같은 자리에 다시
      // 넣는 꼴이 되어 아무 변화도 없어 보이는 버그가 생김 — 지역 변수로 스냅샷을 떠서 넘김
      const fromIdx = st.idx
      const toIdx = overIdx
      const next = [...orderRef.current]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      orderRef.current = next
      setOrder(next)
      st.idx = overIdx
    }
  }

  function handlePointerUp() {
    const st = dragState.current
    dragState.current = null
    setDraggingIdx(null)
    if (!st) return
    if (st.dragging) {
      onReorder(orderRef.current)
    }
  }

  function handlePointerUpOnChip(item: T) {
    const st = dragState.current
    if (st && !st.dragging) onTap(item)
  }

  return (
    <>
      {order.map((item, idx) => (
        <div
          key={item}
          ref={(el) => { if (el) chipRefs.current.set(idx, el); else chipRefs.current.delete(idx) }}
          onPointerDown={(e) => handlePointerDown(idx, e)}
          onPointerMove={handlePointerMove}
          onPointerUp={() => { handlePointerUpOnChip(item); handlePointerUp() }}
          onPointerCancel={handlePointerUp}
          className={draggable ? 'touch-none select-none cursor-grab active:cursor-grabbing' : undefined}
          style={draggingIdx === idx ? { opacity: 0.4 } : undefined}
        >
          {renderChip(item, draggingIdx === idx)}
        </div>
      ))}
    </>
  )
}
