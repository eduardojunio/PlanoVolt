export type Ruleset = {
  version: string;
  review: 'pending' | 'reviewed';
  source: string;
  sections: readonly number[];
  ampacity: Record<string, readonly number[]>;
  temperature: Record<string, number>;
  grouping: readonly number[];
  resistance: readonly number[];
  breakers: readonly number[];
  segmentLimit: number;
};
export const ruleset: Ruleset = {
  version: 'nbr5410-2004-corr2008-dev.2',
  review: 'pending',
  source: 'ABNT NBR 5410:2004 · versão corrigida 17/03/2008',
  sections: [2.5, 4, 6, 10, 16, 25, 35],
  ampacity: {
    B1: [24, 32, 41, 57, 76, 101, 125],
    B2: [23, 30, 38, 52, 69, 90, 111],
    C: [27, 36, 46, 63, 85, 112, 138],
  },
  temperature: {
    '10': 1.22,
    '15': 1.17,
    '20': 1.12,
    '25': 1.06,
    '30': 1,
    '35': 0.94,
    '40': 0.87,
    '45': 0.79,
    '50': 0.71,
    '55': 0.61,
    '60': 0.5,
  },
  grouping: [1, 0.8, 0.7, 0.65, 0.6, 0.57, 0.54, 0.52],
  // Upper envelope across the supported manufacturer's flexible cable families.
  // Table 31's multicore values exceed table 29's isolated-conductor values.
  resistance: [10.2, 6.31, 4.21, 2.44, 1.54, 1, 0.71],
  breakers: [6, 10, 16, 20, 25, 32, 40, 50, 63],
  segmentLimit: 4,
};
export const methodLabels: Record<string, string> = {
  B1: 'B1 · Condutores isolados em eletroduto circular sobre parede',
  B2: 'B2 · Cabo multipolar em eletroduto circular sobre parede',
  C: 'C · Cabo multipolar fixado diretamente sobre parede',
};
