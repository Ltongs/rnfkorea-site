// lib/pdfFit.ts
// html2canvas로 캡처한 캔버스를 A4 PDF에 "비율을 유지한 채" 넣는다.
// 예전에는 가로를 A4 폭에 맞춘 뒤 세로만 A4 높이로 잘라 넣어(Math.min) 내용이 길면 글씨가 위아래로 찌그러졌다.
//   - 한 페이지에 들어가면: A4 폭 그대로
//   - 조금(SHRINK_LIMIT 이내) 넘치면: 가로·세로를 같은 비율로 줄여 한 페이지에 (가운데 정렬)
//   - 그보다 길면: 같은 크기로 여러 페이지에 나눠 넣는다
import type jsPDF from "jspdf";

const SHRINK_LIMIT = 1.25; // 25% 이내 초과까지는 축소해서 1페이지 유지

export function addCanvasToA4(pdf: jsPDF, canvas: HTMLCanvasElement, quality = 0.95) {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const fullH = (canvas.height * pageW) / canvas.width; // A4 폭에 맞췄을 때의 높이(mm)

  if (fullH <= pageH * SHRINK_LIMIT) {
    const scale = Math.min(1, pageH / fullH);
    const w = pageW * scale;
    const h = fullH * scale;
    pdf.addImage(canvas.toDataURL("image/jpeg", quality), "JPEG", (pageW - w) / 2, 0, w, h);
    return;
  }

  // 여러 페이지: 캔버스를 A4 비율 높이로 잘라 페이지마다 넣는다
  const slicePx = Math.floor((canvas.width * pageH) / pageW);
  for (let y = 0, page = 0; y < canvas.height; y += slicePx, page++) {
    const h = Math.min(slicePx, canvas.height - y);
    const part = document.createElement("canvas");
    part.width = canvas.width;
    part.height = h;
    const ctx = part.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, part.width, part.height);
    ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    if (page > 0) pdf.addPage();
    pdf.addImage(part.toDataURL("image/jpeg", quality), "JPEG", 0, 0, pageW, (h * pageW) / canvas.width);
  }
}

// 숫자만 있는 글자(금액·날짜·회차 등)를 숫자 폭이 모두 같은 Arial로, 글자 단위가 아닌 한 덩어리로 그리게 한다.
// - 기본 한글 폰트(Apple SD Gothic Neo·맑은 고딕)는 숫자마다 폭이 달라 표의 자릿수가 들쭉날쭉해 보이고,
// - PDF 변환 시 쓰는 letter-spacing 보정 때문에 html2canvas가 글자를 하나씩 찍으면서 숫자 사이 간격이 벌어졌다.
// 캡처 직전의 오프스크린 DOM(root)에만 적용한다.
const NUMERIC_TEXT = /^[\d,.\s/%()+\-:~원개월회차]+$/;
export function applyTabularDigits(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue ?? "";
    if (/\d/.test(t) && NUMERIC_TEXT.test(t.trim())) targets.push(n as Text);
  }
  for (const node of targets) {
    const span = document.createElement("span");
    span.style.cssText = "font-family:Arial,Helvetica,sans-serif;letter-spacing:0;font-variant-numeric:tabular-nums;";
    span.textContent = node.nodeValue;
    node.parentNode?.replaceChild(span, node);
  }
}
