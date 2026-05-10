// L1 runtime: write both 광고주 발송용 html + xlsx atomically under
// <baseDir>/<client>/<week>.{html|xlsx}. Acquires the (client, week) lock to
// serialize concurrent prepare calls.

import { promises as fsp } from "node:fs";
import path from "node:path";
import { renderWeeklyHtml } from "./weekly-html.js";
import { writeWeeklyXlsx } from "./weekly-xlsx.js";
import { acquireLock } from "../runtime/lock.js";
import type { AiAnalysis, PrecomputedPayload } from "../parser/types.js";

export interface WriteReportArgs {
  baseDir: string;
  client: string;
  week: string;
  payload: PrecomputedPayload;
  ai: AiAnalysis;
}

export interface WriteReportResult {
  html_path: string;
  xlsx_path: string;
}

export async function writeReportFiles(
  args: WriteReportArgs,
): Promise<WriteReportResult> {
  const dir = path.resolve(args.baseDir, args.client);
  await fsp.mkdir(dir, { recursive: true });

  const html_path = path.join(dir, `${args.week}.html`);
  const xlsx_path = path.join(dir, `${args.week}.xlsx`);

  const lock = await acquireLock({
    baseDir: args.baseDir,
    client: args.client,
    week: args.week,
  });
  try {
    const html = renderWeeklyHtml({ payload: args.payload, ai: args.ai });
    const htmlTmp = `${html_path}.${process.pid}.tmp`;
    await fsp.writeFile(htmlTmp, html, "utf8");
    await fsp.rename(htmlTmp, html_path);

    const xlsxTmp = `${xlsx_path}.${process.pid}.tmp`;
    await writeWeeklyXlsx({
      payload: args.payload,
      ai: args.ai,
      outputPath: xlsxTmp,
    });
    await fsp.rename(xlsxTmp, xlsx_path);
  } finally {
    await lock.release();
  }

  return { html_path, xlsx_path };
}
