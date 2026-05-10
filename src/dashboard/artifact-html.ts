// L2 service: AE preview artifact (HTML, self-contained, no external fetch).
// Mirrors the docs/references/hellomax_weekly_comment_sample.html layout but
// is generated programmatically from the precomputed payload + AI analysis.
//
// This artifact is shown ONLY to the AE in Claude Desktop. Per v1.6 the
// 광고주 발송용 산출물은 별도 모듈(weekly-html.ts / weekly-xlsx.ts)에서 생성됩니다.

import type {
  AiAnalysis,
  ActionPriority,
  DeviceRow,
  Insight,
  InsightType,
  MediaBlock,
  PrecomputedPayload,
  WowDelta,
} from "../parser/types.js";

export interface RenderArgs {
  payload: PrecomputedPayload;
  ai: AiAnalysis;
}

const CONFIDENCE_THRESHOLD = 0.7;

export function renderArtifactHtml({ payload, ai }: RenderArgs): string {
  const showConfidenceWarn = ai.confidence < CONFIDENCE_THRESHOLD;
  return [
    "<!DOCTYPE html>",
    `<html lang="ko"><head><meta charset="UTF-8"><title>${escape(
      payload.advertiser,
    )} — 주간 AI 리포트 (AE 검토)</title>`,
    "<style>",
    INLINE_CSS,
    "</style></head><body>",
    renderTopNav(),
    `<div class="page">`,
    renderHeader(payload, showConfidenceWarn),
    renderKpiGrid(payload.kpi_current, payload.kpi_previous, payload.kpi_wow),
    renderMediaBlocks(payload.media),
    renderReview(ai.review_text),
    renderInsights(ai.insights),
    renderActions(ai.action_items),
    renderDataWarnings(payload.data_warnings, ai.data_warnings),
    "</div></body></html>",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// HTML utility — minimal HTML escape so generated text can never break out of
// its container.
// ---------------------------------------------------------------------------

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtInt(n: number): string {
  return n.toLocaleString("ko-KR");
}

function fmtPct(n: number, digits = 2): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

function deltaClass(n: number): string {
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "neu";
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function renderTopNav(): string {
  return `<nav class="topnav"><div class="logo">hello<span>MAX</span> PRO</div><div class="badge-ai">✦ AI 생성</div></nav>`;
}

function renderHeader(payload: PrecomputedPayload, warn: boolean): string {
  const warnPill = warn
    ? `<span class="pill" style="background:#FDEDEC;color:#C0392B;border-color:#F1948A" data-flag="confidence-warn">⚠ 신뢰도 &lt; 0.7 — AE 추가 검토 필요</span>`
    : "";
  return [
    `<div class="pg-header">`,
    `<div class="left"><h1>${escape(payload.advertiser)} — 주간 AI 리포트</h1>`,
    `<div class="sub">분석 기간: <strong>${escape(
      payload.report_period.start,
    )} ~ ${escape(payload.report_period.end)}</strong> | 비교 기간: ${escape(
      payload.compare_period.start,
    )} ~ ${escape(payload.compare_period.end)} | 매체: 네이버 파워링크 + 쇼핑검색</div>`,
    `</div>`,
    `<div class="meta-pills"><span class="pill pill-blue">📁 업로드 완료</span><span class="pill pill-green">✦ AI 생성</span>${warnPill}</div>`,
    `</div>`,
  ].join("");
}

function kpiCard(
  label: string,
  value: string,
  delta: number,
  prevLabel: string,
  variant?: string,
): string {
  return [
    `<div class="kpi-card${variant ? " " + variant : ""}">`,
    `<div class="kpi-label">${escape(label)}</div>`,
    `<div class="kpi-value">${escape(value)}</div>`,
    `<div class="kpi-delta ${deltaClass(delta)}">${escape(fmtPct(delta))}</div>`,
    `<div class="kpi-prev">${escape(prevLabel)}</div>`,
    `</div>`,
  ].join("");
}

function renderKpiGrid(
  cur: PrecomputedPayload["kpi_current"],
  prev: PrecomputedPayload["kpi_previous"],
  wow: WowDelta,
): string {
  return [
    `<div class="kpi-grid">`,
    kpiCard(
      "총 노출수",
      fmtInt(cur.impressions),
      wow.impressions_pct,
      `전주 ${fmtInt(prev.impressions)}`,
    ),
    kpiCard(
      "총 클릭수",
      fmtInt(cur.clicks),
      wow.clicks_pct,
      `전주 ${fmtInt(prev.clicks)}`,
    ),
    kpiCard(
      "총 광고비",
      `${fmtInt(cur.cost)}원`,
      wow.cost_pct,
      `전주 ${fmtInt(prev.cost)}원`,
    ),
    kpiCard(
      "총 전환수",
      `${fmtInt(cur.conversions)}건`,
      wow.conversions_pct,
      `전주 ${fmtInt(prev.conversions)}건`,
      "green",
    ),
    kpiCard(
      "총 매출액",
      `${fmtInt(cur.revenue)}원`,
      wow.revenue_pct,
      `전주 ${fmtInt(prev.revenue)}원`,
      "green",
    ),
    kpiCard(
      "ROAS",
      `${cur.roas.toFixed(0)}%`,
      wow.roas_pct,
      `전주 ${prev.roas.toFixed(0)}%`,
      "orange",
    ),
    `</div>`,
  ].join("");
}

function renderMediaBlocks(blocks: MediaBlock[]): string {
  return `<div class="media-row">${blocks.map(renderMediaCard).join("")}</div>`;
}

function renderMediaCard(block: MediaBlock): string {
  const head = `<div class="mc-head"><h3>${escape(block.label)}</h3><span class="mc-badge ${deltaClass(
    block.wow.roas_pct,
  )}">ROAS ${fmtPct(block.wow.roas_pct, 1)}</span></div>`;
  const headerRow = `<tr><th>구분</th><th>노출</th><th>클릭</th><th>비용(원)</th><th>전환</th><th>매출(원)</th><th>ROAS</th></tr>`;
  const dataRows = block.rows.map((r) => deviceRow(r)).join("");
  const wowRow = `<tr style="background:#FFF8F8"><td>전주 비교</td><td class="${deltaClass(
    block.wow.impressions_pct,
  )}">${fmtPct(block.wow.impressions_pct, 1)}</td><td class="${deltaClass(
    block.wow.clicks_pct,
  )}">${fmtPct(block.wow.clicks_pct, 1)}</td><td class="${deltaClass(
    block.wow.cost_pct,
  )}">${fmtPct(block.wow.cost_pct, 1)}</td><td class="${deltaClass(
    block.wow.conversions_pct,
  )}">${fmtPct(block.wow.conversions_pct, 1)}</td><td class="${deltaClass(
    block.wow.revenue_pct,
  )}">${fmtPct(block.wow.revenue_pct, 1)}</td><td class="${deltaClass(
    block.wow.roas_pct,
  )}">${fmtPct(block.wow.roas_pct, 1)}</td></tr>`;
  return `<div class="media-card">${head}<table class="mc-table"><thead>${headerRow}</thead><tbody>${dataRows}${wowRow}</tbody></table></div>`;
}

function deviceRow(r: DeviceRow): string {
  return `<tr><td>${escape(r.device)}</td><td>${fmtInt(r.impressions)}</td><td>${fmtInt(
    r.clicks,
  )}</td><td>${fmtInt(r.cost)}</td><td>${fmtInt(r.conversions)}건</td><td>${fmtInt(
    r.revenue,
  )}</td><td>${r.roas.toFixed(0)}%</td></tr>`;
}

function renderReview(text: string): string {
  return `<div class="section-label"><h2>📝 실적 리뷰</h2><span class="ai-badge">✦ AI 생성</span><span class="edit-hint">✏️ AE 수정 가능</span></div><div class="ai-card"><div class="review-block"><pre class="review-textarea">${escape(
    text,
  )}</pre></div></div>`;
}

function insightTagClass(t: InsightType): string {
  return t === "good"
    ? "good"
    : t === "bad"
      ? "bad"
      : t === "warn"
        ? "warn"
        : "info";
}

function insightIcon(t: InsightType): string {
  return t === "good" ? "🚀" : t === "bad" ? "⚠️" : t === "warn" ? "📊" : "📝";
}

function insightTagLabel(t: InsightType): string {
  return t === "good"
    ? "기회"
    : t === "bad"
      ? "즉시 개선 필요"
      : t === "warn"
        ? "모니터링 필요"
        : "참고";
}

function renderInsights(insights: Insight[]): string {
  const items = insights
    .map(
      (i) =>
        `<li class="insight-item"><div class="insight-icon ${insightTagClass(
          i.type,
        )}">${insightIcon(i.type)}</div><div class="insight-text"><span class="it-tag ${insightTagClass(
          i.type,
        )}">${escape(insightTagLabel(i.type))}</span><p><strong>${escape(
          i.title,
        )}</strong> — ${escape(i.body)}</p><div class="it-metric">${i.metrics
          .map((m) => `<span>${escape(m)}</span>`)
          .join("")}</div></div></li>`,
    )
    .join("");
  return `<div class="section-label"><h2>💡 주요 인사이트</h2><span class="ai-badge">✦ AI 생성</span></div><div class="ai-card"><ul class="insight-list">${items}</ul></div>`;
}

function priorityClass(p: ActionPriority): string {
  return p === "high" ? "pri-high" : p === "mid" ? "pri-mid" : "pri-low";
}

function priorityLabel(p: ActionPriority): string {
  return p === "high" ? "긴급" : p === "mid" ? "권장" : "유지";
}

function renderActions(actions: AiAnalysis["action_items"]): string {
  const items = actions
    .map(
      (a) =>
        `<li class="action-item"><input type="checkbox"><div class="action-text"><div class="action-title">${escape(
          a.title,
        )}</div><div class="action-desc">${escape(
          a.description,
        )}</div></div><span class="action-priority ${priorityClass(
          a.priority,
        )}">${escape(priorityLabel(a.priority))}</span></li>`,
    )
    .join("");
  return `<div class="section-label"><h2>✅ Next Week Action Items</h2><span class="ai-badge">✦ AI 생성</span></div><div class="ai-card"><ul class="action-list">${items}</ul></div>`;
}

function renderDataWarnings(
  payloadWarnings: string[],
  aiWarnings: string[],
): string {
  const all = [...payloadWarnings, ...aiWarnings];
  if (all.length === 0) return "";
  const items = all.map((w) => `<li>${escape(w)}</li>`).join("");
  return `<div class="section-label"><h2>⚠️ 데이터 경고</h2></div><div class="ai-card"><ul class="warning-list">${items}</ul></div>`;
}

// ---------------------------------------------------------------------------
// Inline CSS — kept compact; mirrors the sample's variables and layout.
// ---------------------------------------------------------------------------

const INLINE_CSS = `
:root{--primary:#1A5C9A;--accent:#2E86DE;--light:#EAF3FB;--green:#27AE60;--red:#E74C3C;--orange:#F39C12;--bg:#F4F6F9;--card:#FFFFFF;--border:#DCE6F0;--text:#1C2B3A;--muted:#6C7D8E;--radius:10px}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:var(--bg);color:var(--text);font-size:14px}
.topnav{background:var(--primary);padding:0 28px;height:52px;display:flex;align-items:center;justify-content:space-between}
.topnav .logo{color:#fff;font-size:20px;font-weight:700}
.topnav .logo span{color:#7EC8F7}
.topnav .badge-ai{background:linear-gradient(135deg,#7EC8F7,#2E86DE);color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px}
.page{max-width:1180px;margin:0 auto;padding:24px 20px 60px}
.pg-header{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between}
.pg-header .left h1{font-size:20px;font-weight:700;color:var(--primary)}
.pg-header .left .sub{font-size:13px;color:var(--muted);margin-top:4px}
.pg-header .meta-pills{display:flex;gap:8px;flex-wrap:wrap}
.pill{padding:5px 14px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid}
.pill-blue{background:var(--light);color:var(--primary);border-color:#9BBFE0}
.pill-green{background:#E8F8EF;color:#1E8449;border-color:#A9DFBF}
.kpi-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:20px}
.kpi-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:14px}
.kpi-card.green{border-left:4px solid var(--green)}
.kpi-card.orange{border-left:4px solid var(--orange)}
.kpi-label{font-size:12px;color:var(--muted)}
.kpi-value{font-size:22px;font-weight:700;margin:6px 0}
.kpi-delta{font-size:12px;font-weight:600}
.kpi-delta.up{color:var(--green)}
.kpi-delta.down{color:var(--red)}
.kpi-prev{font-size:11px;color:var(--muted);margin-top:4px}
.media-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
.media-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px}
.mc-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.mc-head h3{font-size:14px}
.mc-badge{font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px}
.mc-badge.up{background:#E8F8EF;color:#1E8449}
.mc-badge.down{background:#FDEDEC;color:#C0392B}
.mc-table{width:100%;border-collapse:collapse;font-size:12px}
.mc-table th,.mc-table td{padding:6px 8px;border-bottom:1px solid var(--border);text-align:right}
.mc-table th:first-child,.mc-table td:first-child{text-align:left}
.up{color:var(--green)}
.down{color:var(--red)}
.section-label{display:flex;align-items:center;gap:8px;margin:18px 0 10px}
.section-label h2{font-size:15px;color:var(--primary)}
.ai-badge{background:linear-gradient(135deg,#7EC8F7,#2E86DE);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px}
.edit-hint{font-size:11px;color:var(--muted)}
.ai-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:8px}
.review-textarea{width:100%;min-height:120px;font-family:inherit;font-size:13px;line-height:1.7;border:1px dashed var(--border);padding:10px;border-radius:6px;white-space:pre-wrap}
.insight-list,.action-list{list-style:none}
.insight-item{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)}
.insight-icon{width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:var(--light)}
.insight-icon.bad{background:#FDEDEC}
.it-tag{font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;margin-right:6px}
.it-tag.good{background:#E8F8EF;color:#1E8449}
.it-tag.bad{background:#FDEDEC;color:#C0392B}
.it-tag.warn{background:#FEF9E7;color:#B7770D}
.it-tag.info{background:var(--light);color:var(--primary)}
.it-metric{display:flex;gap:12px;margin-top:6px;font-size:11px;color:var(--muted)}
.action-item{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)}
.action-title{font-weight:700;font-size:13px}
.action-desc{font-size:12px;color:var(--muted);margin-top:4px}
.action-priority{font-size:10px;font-weight:700;padding:3px 10px;border-radius:10px;align-self:flex-start}
.pri-high{background:#FDEDEC;color:#C0392B}
.pri-mid{background:#FEF9E7;color:#B7770D}
.pri-low{background:#E8F8EF;color:#1E8449}
.warning-list{list-style:disc;padding-left:20px;color:#B7770D;font-size:12px}
`;
