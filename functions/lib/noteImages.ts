/// <reference types="@cloudflare/workers-types" />

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB
export const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

/** 첨부 이미지 File 유효성 검증. 통과하면 null, 실패하면 에러 메시지 */
export function validateNoteImage(image: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    return '이미지 파일(JPEG/PNG/WEBP/GIF)만 첨부할 수 있습니다'
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return '이미지 용량은 5MB 이하만 가능합니다'
  }
  return null
}
