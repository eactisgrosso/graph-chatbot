import { tool } from 'ai';
import { z } from 'zod';
import { kgService } from '@/lib/neo4j/kg-service';

export const kgSearch = tool({
  description:
    'Search the biomedical knowledge graph for entities, relationships, and contextual information. Use this when users ask about biomedical concepts, diseases, drugs, proteins, or biological processes.',
  inputSchema: z.object({
    query: z
      .string()
      .describe('The search query for biomedical entities or concepts'),
    limit: z
      .number()
      .optional()
      .describe('Maximum number of entities to return (default: 5)'),
  }),
  execute: async ({ query, limit = 5 }) => {
    try {
      console.log('🔍 KG Search tool called with query:', query);

      // Ensure limit is always an integer
      const intLimit = Math.floor(Number(limit));
      console.log('🔢 Using limit:', intLimit, 'type:', typeof intLimit);

      // Search for entities in the knowledge graph
      const entities = await kgService.searchEntities(query, intLimit);
      // Get relationships for found entities
      let relationships: any[] = [];
      if (entities.length > 0) {
        for (const entity of entities.slice(0, 3)) {
          // Limit to first 3 entities
          const entityRelationships = await kgService.getRelationships(
            entity.id,
            intLimit,
          );
          relationships = relationships.concat(entityRelationships);
        }
      }

      // Get graph statistics
      const stats = await kgService.getGraphStats();

      // Only return results if we found entities or relationships
      if (entities.length === 0 && relationships.length === 0) {
        console.log('🧬 No KG results found');
        return {
          query,
          entities: [],
          relationships: [],
          stats,
          timestamp: new Date().toISOString(),
          noResults: true, // Flag to indicate no results
        };
      }

      const result = {
        query,
        entities: entities.map((entity) => ({
          id: entity.id,
          name: entity.properties?.name || 'Unknown',
          type: entity.labels?.[0] || 'Unknown',
          description: entity.properties?.description || 'No description',
        })),
        relationships: relationships.map((rel) => ({
          startNode: {
            name: rel.startNode?.properties?.name || 'Unknown',
            type: rel.startNode?.labels?.[0] || 'Unknown',
          },
          relationship: rel.relationship?.type || 'Unknown',
          endNode: {
            name: rel.endNode?.properties?.name || 'Unknown',
            type: rel.endNode?.labels?.[0] || 'Unknown',
          },
        })),
        stats,
        timestamp: new Date().toISOString(),
      };

      console.log(
        `📊 KG Search found ${entities.length} entities and ${relationships.length} relationships`,
      );

      if (entities.length > 0) {
        console.log(`🧬 Found ${entities.length} entities`);
      } else {
        console.log('🧬 No entities found');
      }

      if (relationships.length > 0) {
        console.log(`🔗 Found ${relationships.length} relationships`);
      } else {
        console.log('🔗 No relationships found');
      }

      return result;
    } catch (error) {
      console.error('Error in KG search tool:', error);
      return {
        query,
        entities: [],
        relationships: [],
        error: 'Failed to search knowledge graph',
        timestamp: new Date().toISOString(),
      };
    }
  },
});
