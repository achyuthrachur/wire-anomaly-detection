// ---------------------------------------------------------------------------
// Entity pool generators for synthetic wire data
// ---------------------------------------------------------------------------

export interface EntityPools {
  initiators: string[];
  reviewers: string[];
  customers: string[];
  beneficiaries: string[];
  lowRiskCountries: string[];
  highRiskCountries: string[];
}

const FIRST_NAMES = [
  'James',
  'Mary',
  'Robert',
  'Patricia',
  'John',
  'Jennifer',
  'Michael',
  'Linda',
  'David',
  'Elizabeth',
  'William',
  'Barbara',
  'Richard',
  'Susan',
  'Joseph',
  'Jessica',
  'Thomas',
  'Sarah',
  'Charles',
  'Karen',
  'Christopher',
  'Lisa',
  'Daniel',
  'Nancy',
  'Matthew',
  'Betty',
  'Anthony',
  'Margaret',
  'Mark',
  'Sandra',
  'Donald',
  'Ashley',
  'Steven',
  'Dorothy',
  'Paul',
  'Kimberly',
  'Andrew',
  'Emily',
  'Joshua',
  'Donna',
  'Kenneth',
  'Michelle',
  'Kevin',
  'Carol',
  'Brian',
  'Amanda',
  'George',
  'Melissa',
  'Timothy',
  'Deborah',
  'Ronald',
  'Stephanie',
  'Edward',
  'Rebecca',
  'Jason',
  'Sharon',
  'Jeffrey',
  'Laura',
  'Ryan',
  'Cynthia',
  'Anita',
  'Priya',
  'Wei',
  'Akiko',
  'Fatima',
  'Olga',
  'Hiroshi',
  'Raj',
  'Sven',
  'Elena',
  'Pierre',
  'Ingrid',
];

const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Perez',
  'Thompson',
  'White',
  'Harris',
  'Sanchez',
  'Clark',
  'Ramirez',
  'Lewis',
  'Robinson',
  'Walker',
  'Young',
  'Allen',
  'King',
  'Wright',
  'Scott',
  'Torres',
  'Nguyen',
  'Hill',
  'Flores',
  'Green',
  'Adams',
  'Nelson',
  'Baker',
  'Hall',
  'Rivera',
  'Campbell',
  'Mitchell',
  'Carter',
  'Roberts',
  'Patel',
  'Singh',
  'Chen',
  'Kim',
  'Tanaka',
  'Mueller',
  'Johansson',
  'Ivanov',
  'Dubois',
  'Santos',
  'Ferrari',
  'Rossi',
];

const LOW_RISK_COUNTRIES = [
  'US',
  'GB',
  'CA',
  'DE',
  'FR',
  'JP',
  'AU',
  'NL',
  'CH',
  'SE',
  'NO',
  'DK',
  'FI',
  'AT',
  'BE',
  'LU',
  'IE',
  'NZ',
  'SG',
  'HK',
];

const HIGH_RISK_COUNTRIES = [
  'NG',
  'KP',
  'IR',
  'SY',
  'MM',
  'VE',
  'CU',
  'SD',
  'SO',
  'YE',
  'AF',
  'LY',
  'ZW',
  'PK',
  'IQ',
];

/**
 * Generate entity pools with deterministic seeded names.
 */
export function generateEntityPools(
  rng: () => number,
  population: {
    initiators: number;
    reviewers: number;
    customers: number;
    beneficiaries: number;
  }
): EntityPools {
  const generateNames = (count: number, prefix: string): string[] => {
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
      const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
      names.push(`${prefix}-${first}.${last}-${String(i + 1).padStart(4, '0')}`);
    }
    return names;
  };

  const generateIds = (count: number, prefix: string): string[] => {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(`${prefix}-${String(i + 1).padStart(6, '0')}`);
    }
    return ids;
  };

  return {
    initiators: generateNames(population.initiators, 'INI'),
    reviewers: generateNames(population.reviewers, 'REV'),
    customers: generateIds(population.customers, 'CUST'),
    beneficiaries: generateIds(population.beneficiaries, 'BEN'),
    lowRiskCountries: LOW_RISK_COUNTRIES,
    highRiskCountries: HIGH_RISK_COUNTRIES,
  };
}
