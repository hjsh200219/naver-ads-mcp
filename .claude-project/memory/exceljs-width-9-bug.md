---
name: exceljs-width-9-strip-bug
description: ExcelJS가 column width=9를 default로 인식해서 저장 시 strip하는 버그와 우회 방법
type: project
created: 2026-05-08
---

ExcelJS는 column width === DEFAULT_COLUMN_WIDTH (= 9) 인 경우 `Column.isDefault` getter가 true를 반환해 `<cols>` XML 항목에서 해당 컬럼을 제거함. 이 때문에 `width: 9`로 명시 설정해도 `writeFile` → `readFile` 라운드트립 시 `getColumn(N).width === undefined`로 돌아옴.

**Why:** 참조 템플릿에서 매체별 성과 sheet의 cols 4-8 = width 9가 모두 사라져서 픽셀 패리티 깨짐을 발견.

**How to apply:** Column에 `style`을 부여하면 `isDefault`가 false가 되어 width가 보존됨. 모든 setColumnWidths 호출에서 다음 패턴 적용:

```ts
function setColumnWidths(ws, widths) {
  for (let i = 0; i < widths.length; i++) {
    const w = widths[i];
    if (w !== null && w !== undefined) {
      const col = ws.getColumn(i + 1);
      col.width = w;
      col.style = { font: FONT_MALGUN_9 }; // ← isDefault=false 만들기
    }
  }
}
```

검증: `node_modules/exceljs/lib/doc/column.js:147` `isDefault` getter — `isCustomWidth`가 false이고 style이 없으면 default 처리됨.

참조: `src/excel/writer.ts:setColumnWidths`.
