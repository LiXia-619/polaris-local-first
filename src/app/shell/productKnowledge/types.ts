export type ProductDocId = 'user-guide' | 'ai-guide' | 'backup-migration' | 'privacy';

export type ProductDocSection = {
  heading: string;
  body?: string[];
  bullets?: string[];
};

export type ProductDoc = {
  id: ProductDocId;
  title: string;
  kicker: string;
  summary: string;
  detail: string;
  updatedAt: string;
  sections: ProductDocSection[];
};

export type ProductDocTranslation = Partial<Omit<ProductDoc, 'id' | 'sections'>> & {
  sections?: ProductDocSection[];
  sectionTranslations?: Record<string, ProductDocSection>;
};
