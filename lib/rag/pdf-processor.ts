import { encode } from 'gpt-tokenizer';

// Configuration constants - larger chunks for better context
const CHUNK_SIZE = 1000; // 1000 character chunks for optimal context
const CHUNK_OVERLAP = 200; // 200 character overlap
const MAX_PAGES_PER_BATCH = 1; // Process one page at a time

export interface ProcessedChunk {
  content: string;
  tokens: number;
  pageNumber?: number;
}

export const processPdf = async (
  pdfBlob: Blob,
): Promise<{
  text: string;
  chunks: ProcessedChunk[];
  pageCount: number;
}> => {
  try {
    // Check file size first - reject very large files
    if (pdfBlob.size > 5 * 1024 * 1024) {
      // 5MB limit
      throw new Error(
        'PDF file is too large. Please use a smaller file (under 5MB).',
      );
    }

    // Force garbage collection before starting
    if (global.gc) {
      global.gc();
    }

    // Check memory usage and warn if high
    const memUsage = process.memoryUsage();
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    console.log(
      `Memory before PDF processing: ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)}MB / ${(memUsage.heapTotal / 1024 / 1024).toFixed(1)}MB (${heapUsagePercent.toFixed(1)}%)`,
    );

    if (heapUsagePercent > 90) {
      console.warn('High memory usage detected, forcing garbage collection');
      if (global.gc) {
        global.gc();
      }
      // Wait for GC to complete
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Dynamically import PDFLoader to avoid module loading issues
    const { PDFLoader } = await import(
      '@langchain/community/document_loaders/fs/pdf'
    );

    // Use the Blob directly with memory-efficient options
    const loader = new PDFLoader(pdfBlob, {
      splitPages: true, // Process pages individually
    });

    const docs = await loader.load();
    const pageCount = docs.length;

    // Process pages in smaller batches to reduce memory usage
    const allChunks: ProcessedChunk[] = [];
    const allText: string[] = [];

    // Dynamically import RecursiveCharacterTextSplitter
    const { RecursiveCharacterTextSplitter } = await import(
      '@langchain/textsplitters'
    );

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
    });

    // Process pages one at a time to minimize memory usage
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const pageText = doc.pageContent;

      // Check memory before processing each page
      const memUsage = process.memoryUsage();
      const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      if (heapUsagePercent > 95) {
        console.warn(
          `Memory usage too high (${heapUsagePercent.toFixed(1)}%), forcing GC`,
        );
        if (global.gc) {
          global.gc();
        }
        // Wait for GC to complete
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      allText.push(pageText);

      // Split this page into chunks
      const splitDocs = await splitter.createDocuments([pageText]);

      // Process chunks one at a time to minimize memory usage
      for (let j = 0; j < splitDocs.length; j++) {
        const chunkDoc = splitDocs[j];
        const chunk = {
          content: chunkDoc.pageContent,
          tokens: encode(chunkDoc.pageContent).length,
          pageNumber: i + 1,
        };
        allChunks.push(chunk);

        // Force garbage collection every few chunks
        if (global.gc && j % 2 === 0) {
          global.gc();
        }

        // Small delay to allow GC
        if (j % 3 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }

      // Force garbage collection after each page
      if (global.gc) {
        global.gc();
      }

      // Longer delay between pages
      await new Promise((resolve) => setTimeout(resolve, 100));

      console.log(
        `Processed page ${i + 1}/${docs.length}, chunks: ${allChunks.length}`,
      );
    }

    // Join text in smaller batches to avoid memory spikes
    console.log('Joining text content...');
    const textBatches = [];
    const batchSize = 5; // Process 5 pages at a time

    for (let i = 0; i < allText.length; i += batchSize) {
      const batch = allText.slice(i, i + batchSize);
      textBatches.push(batch.join(' '));

      // Force garbage collection between batches
      if (global.gc) {
        global.gc();
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    const completeText = textBatches.join(' ');

    // Clear the allText array to free memory
    allText.length = 0;

    // Force final garbage collection
    if (global.gc) {
      global.gc();
    }

    console.log(
      `PDF processing completed: ${pageCount} pages, ${allChunks.length} chunks`,
    );

    return {
      text: completeText,
      chunks: allChunks,
      pageCount,
    };
  } catch (error) {
    console.error('Error processing PDF:', error);

    // Provide more specific error messages
    if (error instanceof Error) {
      if (
        error.message.includes('out of memory') ||
        error.message.includes('Invalid size')
      ) {
        throw new Error(
          'PDF is too large or complex to process. Please try with a smaller PDF or split it into smaller files.',
        );
      }
    }

    throw new Error(
      `Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};
