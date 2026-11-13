import { assert, nonnegative } from '../domain/rules';
export async function exportWorkbook(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Dữ liệu');
  sheet.addRow(headers);
  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004777' } };
  sheet.columns.forEach((c) => {
    c.width = 24;
  });
  const buffer = await book.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function parseSales(file: File) {
  assert(/\.xlsx$/i.test(file.name), 'Chỉ hỗ trợ tệp Excel .xlsx.');
  assert(file.size <= 5 * 1024 * 1024, 'Tệp không được vượt quá 5 MB.');
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await file.arrayBuffer());
  const sheet = book.worksheets[0];
  assert(sheet && sheet.rowCount > 1, 'Tệp không có dữ liệu.');
  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, col) => headers.set(normalize(cell.text), col));
  const idColumn = headers.get('mamon') || headers.get('mamondouong');
  const nameColumn = headers.get('tenmon') || headers.get('tenmondouong');
  const quantityColumn = headers.get('soluongban') || headers.get('soluong');
  assert(quantityColumn, 'Thiếu trường “Số lượng bán”.');
  assert(idColumn || nameColumn, 'Thiếu trường “Mã món” hoặc “Tên món”.');
  const lines: { recipeId: string; quantity: number; name?: string }[] = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const name = nameColumn ? row.getCell(nameColumn).text.trim() : undefined;
    const recipeId = idColumn ? row.getCell(idColumn).text.trim() : name || '';
    const raw = row.getCell(quantityColumn).value;
    assert(
      recipeId && typeof raw === 'number',
      `Dòng ${index}: mã món hoặc số lượng không hợp lệ.`,
    );
    nonnegative(raw, `Dòng ${index}: Số lượng`);
    lines.push({ recipeId, quantity: raw, name });
  });
  assert(lines.length <= 10000, 'Tệp tối đa 10.000 dòng.');
  return lines;
}
