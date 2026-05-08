// RAW sheet header columns. Reference template appends a trailing dot to each
// header (Excel pivot table column name convention). Writer reads these raw
// strings and applies styling.

export const HEADERS_DAILY_RAW: string[] = [
  "월별.",
  "주차.",
  "날짜.",
  "매체.",
  "캠페인유형.",
  "캠페인.",
  "광고그룹.",
  "디바이스.",
  "광고비 (VAT-).",
  "노출수.",
  "클릭수.",
  "구매완료.",
  "회원가입.",
  "신청완료.",
  "기타전환.",
  "전환매출액.",
  "평균노출순위.",
];

export const HEADERS_KEYWORD_RAW: string[] = [
  "월별.",
  "주차.",
  "날짜.",
  "매체.",
  "캠페인유형.",
  "캠페인.",
  "광고그룹.",
  "디바이스.",
  "키워드.",
  "광고비 (VAT-).",
  "노출수.",
  "클릭수.",
  "구매완료.",
  "회원가입.",
  "신청완료.",
  "기타전환.",
  "전환매출액.",
  "평균노출순위.",
];

export const HEADERS_SEARCH_TERM_RAW: string[] = [
  "월별.",
  "주차.",
  "날짜.",
  "매체.",
  "캠페인유형.",
  "캠페인.",
  "광고그룹.",
  "디바이스.",
  "검색어.",
  "광고비 (VAT-).",
  "노출수.",
  "클릭수.",
  "구매완료.",
  "회원가입.",
  "신청완료.",
  "기타전환.",
  "전환매출액.",
  "평균노출순위.",
];

export const HEADERS_MATERIAL_RAW: string[] = [
  "월별.",
  "주차.",
  "날짜.",
  "매체.",
  "캠페인유형.",
  "캠페인.",
  "광고그룹.",
  "디바이스.",
  "소재ID.",
  "네이버 쇼핑 상품 ID.",
  "상품명.",
  "광고비 (VAT-).",
  "노출수.",
  "클릭수.",
  "구매완료.",
  "회원가입.",
  "신청완료.",
  "기타전환.",
  "전환매출액.",
  "평균노출순위.",
];

/** Returns the header without trailing dot — used to look up raw row keys. */
export function stripDot(header: string): string {
  return header.endsWith(".") ? header.slice(0, -1) : header;
}

/** Conversion columns get a yellow fill on 소재RAW header (reference quirk). */
export const CONV_COLUMNS = new Set([
  "구매완료.",
  "회원가입.",
  "신청완료.",
  "기타전환.",
]);
