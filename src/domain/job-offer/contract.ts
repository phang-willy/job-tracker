import { collapseWhitespace, fold } from '@/src/domain/shared/text';

export const CONTRACT_TYPES = [
  'CDI',
  'CDD',
  'Stage',
  'Alternance',
  'VIE',
  'Freelance',
  'Intérim',
] as const;

export type ContractType = (typeof CONTRACT_TYPES)[number];

export type ContractNormalization = {
  contractType: ContractType | '';
  inferredFromFullTime: boolean;
};

const EMPTY_CONTRACT: ContractNormalization = {
  contractType: '',
  inferredFromFullTime: false,
};

export function isContractType(value: unknown): value is ContractType {
  return (
    typeof value === 'string' &&
    (CONTRACT_TYPES as readonly string[]).includes(value)
  );
}

export function normalizeContract(
  labels: readonly string[],
): ContractNormalization {
  for (const label of labels) {
    const explicit = explicitContract(label);

    if (explicit !== null) {
      return { contractType: explicit, inferredFromFullTime: false };
    }
  }

  if (labels.some((label) => isFullTimeLabel(label))) {
    return { contractType: 'CDI', inferredFromFullTime: true };
  }

  return EMPTY_CONTRACT;
}

function explicitContract(label: string): ContractType | null {
  const value = fold(label);

  if (value === 'vie' || value === 'contrat vie') {
    return 'VIE';
  }

  if (value.includes('volontariat international')) {
    return 'VIE';
  }

  if (/\bcdd\b/.test(value)) {
    return 'CDD';
  }

  if (/\bcdi\b/.test(value)) {
    return 'CDI';
  }

  if (/\b(stage|stagiaire|internship|intern)\b/.test(value)) {
    return 'Stage';
  }

  if (/\b(alternance|apprentissage|apprenti|apprentie)\b/.test(value)) {
    return 'Alternance';
  }

  if (/\b(freelance|independant|contractor)\b/.test(value)) {
    return 'Freelance';
  }

  if (/\b(interim|interimaire)\b/.test(value)) {
    return 'Intérim';
  }

  return null;
}

function isFullTimeLabel(label: string): boolean {
  const value = fold(collapseWhitespace(label)).replace(/-/g, ' ');

  return value === 'temps plein' || value === 'full time';
}
