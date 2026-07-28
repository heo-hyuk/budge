const MAX_DIMENSION = 1600 // 리사이즈 후 긴 변의 최대 픽셀
const WEBP_QUALITY = 0.8

/**
 * 메모 첨부 이미지를 업로드 전 브라우저에서 리사이즈 + WebP로 압축한다.
 * GIF는 애니메이션이 깨질 수 있어 건드리지 않고, 압축 결과가 오히려 더
 * 크거나 canvas 관련 API를 쓸 수 없는 환경이면 원본 파일을 그대로 반환한다.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  if (file.type === 'image/gif') return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY))
    if (!blob || blob.size >= file.size) return file

    const newName = file.name.replace(/\.[^./]+$/, '') + '.webp'
    return new File([blob], newName, { type: 'image/webp' })
  } catch {
    return file
  }
}
