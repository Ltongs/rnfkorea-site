// react-dom/server가 vite-prerender-plugin의 (브라우저 타깃) 빌드 조건으로 resolve되면
// server.browser.js가 번들되는데, 이 빌드는 모듈 로드 시점에 무조건 `new MessageChannel()`을
// 만들어 스트리밍 플러시 스케줄링에 쓴다. Node의 전역 MessageChannel/MessagePort는 실제 libuv
// 핸들이라 한번 열리면 명시적으로 close()하지 않는 한 이벤트 루프를 계속 붙잡아, 프리렌더
// 빌드 프로세스가 끝나지 않고 Netlify 빌드 타임아웃(18분)까지 걸린다.
// → react-dom/server를 import하기 전에, 같은 이름/동작을 하되 실제 핸들을 만들지 않는
//   setImmediate 기반의 가벼운 MessageChannel로 미리 바꿔치기한다.
class PolyfillMessagePort {
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  private twin: PolyfillMessagePort | null = null;
  _linkTo(twin: PolyfillMessagePort) {
    this.twin = twin;
  }
  postMessage(data: unknown) {
    const twin = this.twin;
    setImmediate(() => {
      twin?.onmessage?.({ data });
    });
  }
  close() {}
}

class PolyfillMessageChannel {
  port1 = new PolyfillMessagePort();
  port2 = new PolyfillMessagePort();
  constructor() {
    this.port1._linkTo(this.port2);
    this.port2._linkTo(this.port1);
  }
}

if (typeof globalThis.window === "undefined") {
  (globalThis as any).MessageChannel = PolyfillMessageChannel;
}
