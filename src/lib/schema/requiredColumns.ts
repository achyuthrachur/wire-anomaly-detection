export interface RequiredColumn {
  name: string;
  aliases: string[];
  type: 'number' | 'date' | 'string';
  required: boolean;
}

export const REQUIRED_COLUMNS: RequiredColumn[] = [
  {
    name: 'WireID',
    aliases: ['wireid', 'wire_id', 'wire-id', 'transactionid', 'transaction_id', 'txn_id', 'id'],
    type: 'string',
    required: true,
  },
  {
    name: 'Amount',
    aliases: [
      'amount',
      'wire_amount',
      'wireamount',
      'transaction_amount',
      'txn_amount',
      'value',
    ],
    type: 'number',
    required: true,
  },
  {
    name: 'WireDate',
    aliases: ['wiredate', 'wire_date', 'wire-date', 'transaction_date', 'txn_date', 'date'],
    type: 'date',
    required: true,
  },
  {
    name: 'WireDirection',
    aliases: ['wiredirection', 'wire_direction', 'direction', 'type'],
    type: 'string',
    required: false,
  },
];

/** Match a column header to a required column by checking aliases (case-insensitive) */
export function matchRequiredColumn(header: string): RequiredColumn | null {
  const normalized = header
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, '');
  for (const col of REQUIRED_COLUMNS) {
    for (const alias of col.aliases) {
      if (normalized === alias.replace(/[\s_-]+/g, '')) {
        return col;
      }
    }
  }
  return null;
}
