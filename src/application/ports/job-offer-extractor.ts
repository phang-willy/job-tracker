export type ExtractedJobDraft = {
  company: string;
  title: string;
  locationCandidates: readonly string[];
  contractLabels: readonly string[];
  salaryTexts: readonly string[];
  jobId: string | null;
};

export interface JobOfferExtractor {
  extract(root: ParentNode): ExtractedJobDraft | null;
}
