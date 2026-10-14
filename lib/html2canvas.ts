// lib/html2canvas.ts
// html2canvas를 그대로 쓰되, 캡처하는 동안 글자 기준선 측정 보정(withCaptureFix)을 적용한다.
// (Tailwind img{display:block} 때문에 PDF·문자 이미지의 글자가 칸 아래로 처지던 문제 — lib/pdfFit.ts 참고)
// 이 사이트에서 html2canvas가 필요하면 'html2canvas' 대신 이 모듈을 import 한다.
import html2canvasOriginal from "html2canvas";
import { withCaptureFix } from "./pdfFit";

type Options = Parameters<typeof html2canvasOriginal>[1];

export default function html2canvas(element: HTMLElement, options?: Options): Promise<HTMLCanvasElement> {
  return withCaptureFix(() => html2canvasOriginal(element, options));
}
