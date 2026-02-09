export type ColumnType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'currency'
  | 'categorical';

export interface InferredColumn {
  name: string;
  type: ColumnType;
  nullable: boolean;
  sampleValues: string[];
}

export interface InferredSchema {
  columns: InferredColumn[];
}

export interface ParsedData {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}
