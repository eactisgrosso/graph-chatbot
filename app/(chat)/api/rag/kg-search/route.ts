import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { kgService } from '@/lib/neo4j/kg-service';

export async function POST(request: NextRequest) {
  console.log('🔍 Knowledge Graph search request received');

  try {
    const session = await auth();
    if (!session?.user?.id) {
      console.log('❌ Unauthorized KG search request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    console.log('🔍 Searching knowledge graph for:', query);

    // Search for entities in the knowledge graph
    const entities = await kgService.searchEntities(query, 5);

    console.log(`📊 Found ${entities.length} entities in knowledge graph`);

    // Get relationships for the first entity if found
    let relationships: any[] = [];
    if (entities.length > 0) {
      relationships = await kgService.getRelationships(entities[0].id, 10);
      console.log(`🔗 Found ${relationships.length} relationships`);
    }

    // Get graph statistics
    const stats = await kgService.getGraphStats();
    console.log('📈 Graph stats:', stats);

    return NextResponse.json({
      query,
      entities,
      relationships,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in KG search:', error);
    return NextResponse.json(
      { error: 'Failed to search knowledge graph' },
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

    // Get basic graph statistics
    const stats = await kgService.getGraphStats();

    return NextResponse.json({
      stats,
      status: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting KG stats:', error);
    return NextResponse.json(
      { error: 'Failed to connect to knowledge graph' },
      { status: 500 },
    );
  }
}
