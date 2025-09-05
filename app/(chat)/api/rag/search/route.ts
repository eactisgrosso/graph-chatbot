import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { searchRelevantChunks } from '@/lib/rag/utils';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, limit = 5, threshold = 0.3 } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const chunks = await searchRelevantChunks({
      query,
      userId: session.user.id,
      limit,
      threshold,
    });

    return NextResponse.json({ chunks });
  } catch (error) {
    console.error('Error searching chunks:', error);
    return NextResponse.json(
      { error: 'Failed to search chunks' },
      { status: 500 },
    );
  }
}
