import 'server-only';

// Text chunking utilities
export async function chunkText(
  text: string,
  chunkSize = 1000,
  overlap = 200,
): Promise<string[]> {
  console.log(`Starting chunking for text of length: ${text.length}`);

  const chunks: string[] = [];
  let start = 0;
  let processedChunks = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);

    // Try to break at sentence boundaries
    if (end < text.length) {
      const lastSentenceEnd = chunk.lastIndexOf('.');
      const lastQuestionEnd = chunk.lastIndexOf('?');
      const lastExclamationEnd = chunk.lastIndexOf('!');
      const lastNewline = chunk.lastIndexOf('\n');

      const breakPoint = Math.max(
        lastSentenceEnd,
        lastQuestionEnd,
        lastExclamationEnd,
        lastNewline,
      );

      if (breakPoint > chunkSize * 0.5) {
        chunk = chunk.slice(0, breakPoint + 1);
      }
    }

    chunks.push(chunk.trim());
    start = start + chunk.length - overlap;
    processedChunks++;

    // Force garbage collection every 25 chunks to prevent memory buildup
    if (global.gc && processedChunks % 25 === 0) {
      global.gc();
      console.log(`Processed ${processedChunks} chunks, forcing GC...`);
      // Small delay to allow GC to complete
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  console.log(`Chunking completed: ${chunks.length} chunks created`);

  // Final garbage collection
  if (global.gc) {
    global.gc();
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

// Generate embeddings using OpenAI
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate embedding: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// Process document for RAG
export async function processDocumentForRAG({
  title,
  content,
  chunks,
  source,
  metadata,
  userId,
}: {
  title: string;
  content: string;
  chunks: string[];
  source?: string;
  metadata?: any;
  userId: string;
}) {
  console.log('Starting document processing for RAG...');

  // Force garbage collection before starting
  if (global.gc) {
    global.gc();
  }

  const { saveRagDocument, saveRagChunk } = await import('@/lib/db/queries');

  // Clean the text to remove null bytes and other problematic characters
  const cleanText = (text: string) => {
    console.log(`Cleaning text of length: ${text.length}`);

    // Process in smaller chunks to avoid memory issues
    const chunkSize = 10000; // Process 10k characters at a time
    const chunks = [];

    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.slice(i, i + chunkSize);
      const cleanedChunk = chunk
        .replace(/\0/g, '') // Remove null bytes
        .split('')
        .filter((char) => {
          const code = char.charCodeAt(0);
          // Keep printable characters and common whitespace (space, tab, newline, carriage return)
          return code >= 32 || code === 9 || code === 10 || code === 13;
        })
        .join('')
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      chunks.push(cleanedChunk);

      // Force garbage collection every few chunks
      if (global.gc && i % (chunkSize * 5) === 0) {
        global.gc();
      }
    }

    const result = chunks.join(' ');
    console.log(
      `Text cleaning completed. Original: ${text.length}, Cleaned: ${result.length}`,
    );
    return result;
  };

  const cleanedTitle = cleanText(title);
  const cleanedContent = cleanText(content);
  const cleanedSource = source ? cleanText(source) : undefined;

  // Save the document
  console.log('Saving document to database...');
  const [document] = await saveRagDocument({
    title: cleanedTitle,
    content: cleanedContent,
    source: cleanedSource,
    metadata,
    userId,
  });
  console.log(`Document saved with ID: ${document.id}`);

  // Force garbage collection after saving document
  if (global.gc) {
    global.gc();
  }

  // Use the chunks that were already created by LangChain in the PDF processor
  // No need to chunk again - this was causing the memory issues!
  console.log(`Using pre-chunked content from PDF processor`);

  // Generate embeddings and save chunks in batches to avoid memory issues
  console.log(`Processing ${chunks.length} chunks for embeddings...`);
  const batchSize = 10; // Process 10 chunks at a time

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    console.log(
      `Processing embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`,
    );

    const chunkPromises = batch.map(async (chunk, batchIndex) => {
      console.log(
        `Generating embedding for chunk ${i + batchIndex + 1}/${chunks.length} (length: ${chunk.length})`,
      );
      const embedding = await generateEmbedding(chunk);

      // Validate embedding
      if (
        !embedding ||
        !Array.isArray(embedding) ||
        embedding.length !== 1536
      ) {
        console.error(`Invalid embedding for chunk ${i + batchIndex + 1}:`, {
          isArray: Array.isArray(embedding),
          length: embedding?.length,
          type: typeof embedding,
        });
        throw new Error(
          `Invalid embedding generated for chunk ${i + batchIndex + 1}`,
        );
      }

      // Clean chunk content - remove null bytes and other problematic characters
      const cleanedChunk = chunk
        .replace(/\0/g, '') // Remove null bytes
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove other control characters
        .trim();

      // Validate chunk content
      if (!cleanedChunk || cleanedChunk.length === 0) {
        console.error(
          `Invalid chunk content for chunk ${i + batchIndex + 1}:`,
          {
            originalChunk: chunk?.substring(0, 50),
            cleanedChunk: cleanedChunk?.substring(0, 50),
            originalLength: chunk?.length,
            cleanedLength: cleanedChunk?.length,
            type: typeof chunk,
          },
        );
        throw new Error(
          `Invalid chunk content for chunk ${i + batchIndex + 1}`,
        );
      }

      console.log(`Saving chunk ${i + batchIndex + 1} to database...`);
      return saveRagChunk({
        documentId: document.id,
        content: cleanedChunk,
        embedding,
        chunkIndex: (i + batchIndex).toString(),
        metadata: {
          ...metadata,
          chunkLength: cleanedChunk.length,
        },
      });
    });

    await Promise.all(chunkPromises);
    console.log(`RAG document chunks finished saving to database`);

    // Force garbage collection between batches
    if (global.gc) {
      global.gc();
    }

    // Small delay to allow GC
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return document;
}

// Search for relevant chunks
export async function searchRelevantChunks({
  query,
  userId,
  limit = 5,
  threshold = 0.3,
}: {
  query: string;
  userId?: string;
  limit?: number;
  threshold?: number;
}) {
  const { searchSimilarChunks } = await import('@/lib/db/queries');

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

  // Search for similar chunks
  const chunks = await searchSimilarChunks({
    embedding: queryEmbedding,
    limit,
    threshold,
    userId,
  });

  return chunks;
}
