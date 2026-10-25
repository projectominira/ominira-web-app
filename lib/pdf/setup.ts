import "./polyfills";
import "pdfjs-dist/legacy/build/pdf.worker.min.mjs";

/**
 * Browser-side pdf.js setup for the upload parser (lib/book/pdfParser.ts), which
 * resolves to the legacy pdf.js module (next.config.ts). The reader doesn't use
 * pdf.js at all — it renders with PDFium (lib/pdf/pdfiumEngine.ts).
 *
 * pdf.js runs on the main thread: importing its worker module here sets
 * `globalThis.pdfjsWorker`, which pdf.js uses in place of a Web Worker. The
 * parser only reads metadata and rasterizes one page, so a worker buys little,
 * and a separate worker file let readers end up with an API and worker from
 * different pdf.js versions ("The API version … does not match the Worker
 * version …"). Both now come from the same bundle, so they always match.
 */
