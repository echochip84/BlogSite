// plainpedia.com은 정적 자산(Hugo 빌드 결과물)을 서빙하는 Worker다. 커스텀 로직은 둘이다.
//
// (1) www.plainpedia.com → plainpedia.com 301 리다이렉트 — _redirects 파일은 경로 기반
//     규칙만 지원하고 호스트(www) 기반 규칙은 지원하지 않아 여기서 직접 처리한다.
// (2) /api/hits — 블로그별 방문자 카운터. 전용 프로젝트(plainpedia-tidylab 등)의 route는
//     `plainpedia.com/{blog_id}/*` 형태라 /api/hits에 매치되지 않으므로, 이 경로는 항상
//     우산 프로젝트로 떨어진다. 덕분에 카운터를 여기 한 곳에만 두고 모든 블로그가 공유한다
//     (전용 프로젝트에 Worker 스크립트를 추가할 필요가 없다).
//
// 나머지 요청은 정적 자산 파이프라인(_redirects 포함)에 그대로 위임한다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 카운터의 "오늘"은 KST 기준이다. Worker 런타임은 UTC라 오프셋을 직접 더한다.
function kstDay() {
  return new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

// 블로그 하나당 Durable Object 인스턴스 하나. DO는 단일 스레드로 직렬 처리되므로
// 동시 방문에도 카운트가 유실되지 않는다(KV는 같은 키에 초당 1회 쓰기 제한이 있어
// 카운터 용도로는 부적합하다).
export class VisitorCounter {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const inc = new URL(request.url).searchParams.get("inc") === "1";
    const day = kstDay();
    const counts = (await this.state.storage.get("counts")) || { day, today: 0, total: 0 };

    // 날짜가 바뀌었으면 당일 카운트만 리셋한다. 조회만 하는 경우 굳이 저장하지 않는다
    // — 다음 증가 시점에 함께 기록되고, 그 전까지는 매 조회마다 같은 값으로 계산된다.
    if (counts.day !== day) {
      counts.day = day;
      counts.today = 0;
    }

    if (inc) {
      counts.today += 1;
      counts.total += 1;
      await this.state.storage.put("counts", counts);
    }

    return Response.json({ today: counts.today, total: counts.total });
  }
}

async function handleHits(url, env) {
  const site = url.searchParams.get("site") || "";
  // 임의의 site 값으로 Durable Object가 무한 생성되는 것을 막는다.
  if (!/^[a-z0-9-]{1,32}$/.test(site)) {
    return new Response(JSON.stringify({ error: "invalid site" }), {
      status: 400,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  const stub = env.VISITOR_COUNTER.get(env.VISITOR_COUNTER.idFromName(site));
  const inc = url.searchParams.get("inc") === "1" ? "1" : "0";
  const res = await stub.fetch(`https://counter/?inc=${inc}`);

  // 엣지·브라우저 캐시에 걸리면 카운트가 멈춘 것처럼 보인다.
  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === "www.plainpedia.com") {
      url.hostname = "plainpedia.com";
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/api/hits") {
      return handleHits(url, env);
    }

    return env.ASSETS.fetch(request);
  },
};
