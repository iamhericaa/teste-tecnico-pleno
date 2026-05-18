export interface Quotation {
  symbol: string;
  name?: string;
  price: number;
  updated_at?: string | Date;
  [key: string]: any;
}

export interface QuotationSourceStrategy {
  fetch(symbol?: string): Promise<Quotation | Quotation[]>;
}

export interface QuotationSaverStrategy {
  save(quotation: Quotation): Promise<void>;
}
