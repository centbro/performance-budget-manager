declare module "pdf-parse" {
  function pdf(
    data: Buffer,
    options?: { pagerender?: (pageData: any) => string | Promise<string> }
  ): Promise<{ text: string; numpages: number }>;
  export default pdf;
}
