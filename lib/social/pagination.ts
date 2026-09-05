export const DIARY_PAGE_SIZE = 20;

export function pageNumber(value: string | string[] | undefined): number {
  const input = Array.isArray(value) ? value[0] : value;
  if (!input || !/^[1-9]\d{0,5}$/.test(input)) return 1;
  return Number(input);
}
