import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import { HelmetProvider } from "react-helmet-async";
import App from "../App";

type PrerenderContext = {
  url: string;
};

// ⚠️ react-helmet-async@3은 React 19에서 자체 reducer를 쓰지 않고 React 19의
// 네이티브 <title>/<meta>/<link>/<script> 호이스팅에 의존한다. 그 결과
// - context.helmet은 채워지지 않고 (React19Dispatcher가 별도 경로를 탐)
// - <head> 태그로의 실제 이동도 renderToString에서는 일어나지 않으며
//   렌더링된 위치(=body, #root 내부) 그대로 문자열에 남는다.
// 그래서 renderToString 결과 문자열에서 title/meta/link/script(JSON-LD) 태그를
// 직접 추출해 <head>로 옮기고, 같은 페이지 안에서도 SeoHead(라우트 공통) +
// 페이지 로컬 <Helmet>이 동시에 렌더링돼 생기는 중복은 "마지막 것이 우선"으로 합친다.
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function dedupeKey(rawTag: string): string | null {
  const match = rawTag.match(/\s(name|property|http-equiv|charset|rel)="([^"]*)"/);
  return match ? `${match[1]}:${match[2]}` : null;
}

function extractHeadTags(rawHtml: string) {
  let html = rawHtml;
  let title = "";
  const scripts: string[] = [];
  const keyed = new Map<string, string>();
  const unkeyed: string[] = [];

  html = html.replace(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/g,
    (match) => {
      scripts.push(match);
      return "";
    }
  );

  html = html.replace(/<title[^>]*>([\s\S]*?)<\/title>/g, (_match, content: string) => {
    title = decodeHtmlEntities(content);
    return "";
  });

  html = html.replace(/<meta\b[^>]*>/g, (match) => {
    const key = dedupeKey(match);
    if (key) keyed.set(key, match);
    else unkeyed.push(match);
    return "";
  });

  html = html.replace(/<link\b[^>]*>/g, (match) => {
    const key = dedupeKey(match);
    if (key) keyed.set(key, match);
    else unkeyed.push(match);
    return "";
  });

  const elements = [...keyed.values(), ...unkeyed, ...scripts];

  return { html, title, elements };
}

export async function prerender({ url }: PrerenderContext) {
  const helmetContext = {};

  const rawHtml = renderToString(
    <HelmetProvider context={helmetContext}>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </HelmetProvider>
  );

  const { html, title, elements } = extractHeadTags(rawHtml);

  return {
    html,
    head: {
      lang: "ko",
      title,
      elements,
    },
  };
}
