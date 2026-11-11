// lib/imageCompress.ts — 업로드 전 사진 용량 줄이기 (휴대폰 원본 5~10MB → 보통 0.3~1MB)
// 긴 변을 maxSide 이하로 줄이고 JPEG로 다시 저장한다. 서류 사진도 글자가 읽히도록 2000px을 기본값으로 둔다.
// PDF 등 이미지가 아닌 파일, 이미 작은 파일, 브라우저가 못 여는 형식(예: 크롬의 HEIC)은 원본 그대로 돌려준다.

const SKIP_BELOW_BYTES = 700 * 1024;

export async function compressImage(file: File, maxSide = 2000, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < SKIP_BELOW_BYTES) return file;

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("이미지를 열 수 없습니다."));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff"; // 투명 PNG가 JPEG에서 검게 나오지 않도록
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
