// Shared, dependency-free list of the three businesses. Safe to import from
// both client and server code (unlike lib/db.ts, which pulls in `pg`).
export type Business = 'construction' | 'clove_cafe' | 'clove_guesthouse';

export const businesses: Array<{ id: Business; label: string }> = [
  { id: 'construction', label: 'Clove Construction' },
  { id: 'clove_cafe', label: 'Clove Cafe' },
  { id: 'clove_guesthouse', label: 'Clove Guesthouse' },
];

export const isValidBusiness = (value: unknown): value is Business =>
  typeof value === 'string' && businesses.some((business) => business.id === value);
