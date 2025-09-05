import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getRagDocumentsByUserId, deleteRagDocument } from '@/lib/db/queries';
import { processDocumentForRAG } from '@/lib/rag/utils';
import { processPdf } from '@/lib/rag/pdf-processor';

export async function POST(request: NextRequest) {
  console.log('📄 PDF upload request received');
  try {
    const session = await auth();
    if (!session?.user?.id) {
      console.log('❌ Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ User authenticated:', session.user.id);

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      console.log('📎 Processing multipart form data');
      // Handle PDF file upload
      const formData = await request.formData();
      const file = formData.get('file') as File;
      console.log('📁 File received:', file?.name, 'Size:', file?.size);

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 },
        );
      }

      if (file.type !== 'application/pdf') {
        return NextResponse.json(
          { error: 'Only PDF files are supported' },
          { status: 400 },
        );
      }

      // Check file size (limit to 5MB to prevent memory issues)
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'File size must be less than 5MB' },
          { status: 400 },
        );
      }

      // Check memory usage before processing
      const memUsage = process.memoryUsage();
      const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      console.log(
        `API Memory check: ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)}MB / ${(memUsage.heapTotal / 1024 / 1024).toFixed(1)}MB (${heapUsagePercent.toFixed(1)}%)`,
      );

      if (heapUsagePercent > 95) {
        console.warn(
          `High memory usage detected: ${heapUsagePercent.toFixed(1)}%`,
        );
        return NextResponse.json(
          { error: 'Server is currently busy. Please try again in a moment.' },
          { status: 503 },
        );
      }

      try {
        // Set a timeout for PDF processing to prevent hanging
        const processingTimeout = setTimeout(() => {
          throw new Error('PDF processing timeout - file may be too complex');
        }, 30000); // 30 second timeout

        // Parse PDF content using LangChain PDFLoader
        // Use the file directly as a Blob, just like your original code
        const pdfData = await processPdf(file);

        clearTimeout(processingTimeout);

        const title = file.name.replace('.pdf', '');
        const content = pdfData.text;

        if (!content || !content.trim()) {
          return NextResponse.json(
            {
              error:
                'No text content found in PDF. The PDF might be image-based or corrupted.',
            },
            { status: 400 },
          );
        }

        // Check if content is too short (might indicate parsing issues)
        if (content.trim().length < 10) {
          return NextResponse.json(
            { error: 'PDF appears to contain very little text content' },
            { status: 400 },
          );
        }

        const document = await processDocumentForRAG({
          title,
          content,
          chunks: pdfData.chunks.map((chunk) => chunk.content), // Use the chunks from LangChain
          source: file.name,
          metadata: {
            originalFileName: file.name,
            fileSize: file.size,
            pageCount: pdfData.pageCount,
            chunkCount: pdfData.chunks.length,
            parsedAt: new Date().toISOString(),
          },
          userId: session.user.id,
        });

        return NextResponse.json({ document });
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);

        // Provide more specific error messages
        if (pdfError instanceof Error) {
          if (pdfError.message.includes('timeout')) {
            return NextResponse.json(
              {
                error:
                  'PDF processing timed out. The file might be too complex or large. Please try with a smaller PDF.',
              },
              { status: 400 },
            );
          }
          if (pdfError.message.includes('Invalid PDF')) {
            return NextResponse.json(
              { error: 'Invalid PDF file format' },
              { status: 400 },
            );
          }
          if (
            pdfError.message.includes('out of memory') ||
            pdfError.message.includes('Invalid size')
          ) {
            return NextResponse.json(
              {
                error:
                  'PDF is too large or complex to process. Please try with a smaller PDF or split it into smaller files.',
              },
              { status: 413 },
            );
          }
          if (pdfError.message.includes('too large or complex')) {
            return NextResponse.json(
              {
                error: pdfError.message,
              },
              { status: 413 },
            );
          }
        }

        return NextResponse.json(
          {
            error:
              'Failed to parse PDF. The file might be corrupted or in an unsupported format.',
          },
          { status: 400 },
        );
      }
    } else {
      // Handle JSON upload (legacy support)
      const { title, content, source, metadata } = await request.json();

      if (!title || !content) {
        return NextResponse.json(
          { error: 'Title and content are required' },
          { status: 400 },
        );
      }

      // For non-PDF content, we need to chunk it ourselves
      const { chunkText } = await import('@/lib/rag/utils');
      const chunks = await chunkText(content, 500, 100);

      const document = await processDocumentForRAG({
        title,
        content,
        chunks,
        source,
        metadata,
        userId: session.user.id,
      });

      return NextResponse.json({ document });
    }
  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Number.parseInt(searchParams.get('limit') || '50');

    const documents = await getRagDocumentsByUserId({
      userId: session.user.id,
      limit,
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('id');

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 },
      );
    }

    const deletedDocument = await deleteRagDocument({
      documentId,
      userId: session.user.id,
    });

    if (!deletedDocument) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 },
    );
  }
}
