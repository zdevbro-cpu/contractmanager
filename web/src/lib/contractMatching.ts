export type MatchStatus =
  | "MATCHED"
  | "REVIEW_REQUIRED"
  | "UNMATCHED_PDF"
  | "UNMATCHED_ROW"
  | "DUPLICATE_PDF"
  | "INVALID_FILENAME"
  | "INVALID_DATE";

export type ParsedPdf = {
  fileName: string;
  contractName: string;
  firstAllowanceDate: string; // YYYY-MM-DD
  contractorName: string;
  matchKey: string;
  errors: string[];
};

export type ContractRow = {
  rowId: string;
  contractNo?: string;
  contractName: string;
  firstAllowanceDate: string; // YYYY-MM-DD preferred
  contractorName: string;
};

export type MatchResultRow = {
  rowId: string;
  matchStatus: MatchStatus;
  matchKey: string;
  matchedPdfFile?: string;
  errorCode?: string;
  errorReason?: string;
};

const PDF_FILE_PATTERN = /^(.+)_([0-9]{8})_(.+)\.pdf$/i;

export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function yyyymmddToIso(value: string): string | null {
  if (!/^\d{8}$/.test(value)) return null;
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(4, 6));
  const d = Number(value.slice(6, 8));
  const date = new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== y || date.getMonth() + 1 !== m || date.getDate() !== d) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

export function normalizeDate(value: string): string | null {
  const v = value.trim();
  if (/^\d{8}$/.test(v)) return yyyymmddToIso(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return yyyymmddToIso(v.replaceAll("-", ""));
  return null;
}

export function buildMatchKey(contractName: string, firstAllowanceDateIso: string, contractorName: string): string {
  return `${normalizeText(contractName)}|${firstAllowanceDateIso}|${normalizeText(contractorName)}`;
}

export function parsePdfFileName(fileName: string): ParsedPdf {
  const errors: string[] = [];
  const base = fileName.trim();
  const matched = base.match(PDF_FILE_PATTERN);
  if (!matched) {
    return {
      fileName,
      contractName: "",
      firstAllowanceDate: "",
      contractorName: "",
      matchKey: "",
      errors: ["INVALID_FILENAME"]
    };
  }

  const contractName = matched[1].trim();
  const date8 = matched[2];
  const contractorName = matched[3].trim();
  const iso = yyyymmddToIso(date8);
  if (!iso) errors.push("INVALID_DATE");
  if (!contractName || !contractorName) errors.push("EMPTY_FIELD");

  return {
    fileName,
    contractName,
    firstAllowanceDate: iso ?? "",
    contractorName,
    matchKey: iso ? buildMatchKey(contractName, iso, contractorName) : "",
    errors
  };
}

export function buildRowMatchKey(row: ContractRow): { key: string; error?: string } {
  const dateIso = normalizeDate(row.firstAllowanceDate);
  if (!dateIso) return { key: "", error: "INVALID_DATE" };
  return { key: buildMatchKey(row.contractName, dateIso, row.contractorName) };
}

export function matchContracts(rows: ContractRow[], pdfFiles: string[]): MatchResultRow[] {
  const parsedPdfs = pdfFiles.map(parsePdfFileName);
  const pdfMap = new Map<string, ParsedPdf[]>();

  for (const pdf of parsedPdfs) {
    if (!pdf.matchKey) continue;
    const bucket = pdfMap.get(pdf.matchKey) ?? [];
    bucket.push(pdf);
    pdfMap.set(pdf.matchKey, bucket);
  }

  const results: MatchResultRow[] = rows.map((row) => {
    const { key, error } = buildRowMatchKey(row);
    if (error) {
      return {
        rowId: row.rowId,
        matchStatus: "REVIEW_REQUIRED",
        matchKey: "",
        errorCode: error,
        errorReason: "최초수당지급일 형식이 올바르지 않습니다."
      };
    }
    const candidates = pdfMap.get(key) ?? [];
    if (candidates.length === 1) {
      return {
        rowId: row.rowId,
        matchStatus: "MATCHED",
        matchKey: key,
        matchedPdfFile: candidates[0].fileName
      };
    }
    if (candidates.length > 1) {
      return {
        rowId: row.rowId,
        matchStatus: "DUPLICATE_PDF",
        matchKey: key,
        errorCode: "DUPLICATE_PDF",
        errorReason: "동일 키의 PDF가 2개 이상입니다."
      };
    }
    return {
      rowId: row.rowId,
      matchStatus: "UNMATCHED_ROW",
      matchKey: key,
      errorCode: "UNMATCHED_ROW",
      errorReason: "일치하는 PDF를 찾지 못했습니다."
    };
  });

  return results;
}
