declare module 'pdf-parse' {
  interface PDFResult {
    numpages: number;
    numrender: number;
    info: {
      PDFFormatVersion?: string;
      IsAcroFormPresent?: boolean;
      IsXFAPresent?: boolean;
      Title?: string;
      Author?: string;
      Subject?: string;
      Keywords?: string;
      Creator?: string;
      Producer?: string;
      CreationDate?: string;
      ModDate?: string;
      [key: string]: any;
    };
    metadata: any;
    text: string;
    version: string;
  }

  function parse(dataBuffer: Buffer, options?: any): Promise<PDFResult>;
  
  namespace parse {
    function render(pageData: any): string;
  }

  export = parse;
}