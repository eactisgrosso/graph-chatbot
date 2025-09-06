import neo4j from 'neo4j-driver';

// Neo4j connection configuration
const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'password123'),
);

export class KnowledgeGraphService {
  private session = driver.session();

  /**
   * Search for biomedical entities in the knowledge graph
   */
  async searchEntities(query: string, limit = 10) {
    try {
      // Split query into individual terms for better matching
      const terms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((term) => term.length > 2);

      const result = await this.session.run(
        `
        MATCH (n)
        WHERE toLower(n.name) CONTAINS toLower($query) 
           OR toLower(n.description) CONTAINS toLower($query)
           OR any(term IN $terms WHERE toLower(n.name) CONTAINS term)
           OR any(term IN $terms WHERE toLower(n.description) CONTAINS term)
        RETURN n, labels(n) as nodeLabels
        LIMIT $limit
        `,
        { query, terms, limit: neo4j.int(Math.floor(Number(limit))) },
      );

      return result.records.map((record) => ({
        id: record.get('n').identity.toNumber(),
        properties: record.get('n').properties,
        labels: record.get('nodeLabels'),
      }));
    } catch (error) {
      console.error('Error searching entities:', error);
      return [];
    }
  }

  /**
   * Get relationships for a specific entity
   */
  async getRelationships(entityId: number, limit = 20) {
    try {
      const result = await this.session.run(
        `
        MATCH (n)-[r]-(m)
        WHERE id(n) = $entityId
        RETURN n, r, m, labels(n) as startLabels, labels(m) as endLabels, type(r) as relationshipType
        LIMIT $limit
        `,
        { entityId, limit: neo4j.int(Math.floor(Number(limit))) },
      );

      return result.records.map((record) => ({
        startNode: {
          id: record.get('n').identity.toNumber(),
          properties: record.get('n').properties,
          labels: record.get('startLabels'),
        },
        relationship: {
          type: record.get('relationshipType'),
          properties: record.get('r').properties,
        },
        endNode: {
          id: record.get('m').identity.toNumber(),
          properties: record.get('m').properties,
          labels: record.get('endLabels'),
        },
      }));
    } catch (error) {
      console.error('Error getting relationships:', error);
      return [];
    }
  }

  /**
   * Create a simple biomedical entity (for testing)
   */
  async createTestEntity(name: string, type: string, description?: string) {
    try {
      const result = await this.session.run(
        `
        CREATE (n:${type} {name: $name, description: $description, createdAt: datetime()})
        RETURN n
        `,
        { name, description },
      );

      return result.records[0]?.get('n');
    } catch (error) {
      console.error('Error creating entity:', error);
      return null;
    }
  }

  async createRelationship(
    startNodeName: string,
    relationshipType: string,
    endNodeName: string,
  ) {
    try {
      const result = await this.session.run(
        `
        MATCH (a {name: $startNodeName}), (b {name: $endNodeName})
        CREATE (a)-[:${relationshipType}]->(b)
        RETURN a, b
        `,
        { startNodeName, endNodeName },
      );

      return result.records[0];
    } catch (error) {
      console.error('Error creating relationship:', error);
      return null;
    }
  }

  /**
   * Get basic statistics about the knowledge graph
   */
  async getGraphStats() {
    try {
      const result = await this.session.run(
        `
        MATCH (n)
        RETURN 
          count(n) as totalNodes,
          count(DISTINCT labels(n)) as nodeTypes,
          size([(n)-[r]->() | r]) as totalRelationships
        `,
      );

      return result.records[0]?.toObject() || {};
    } catch (error) {
      console.error('Error getting graph stats:', error);
      return {};
    }
  }

  /**
   * Close the driver connection
   */
  async close() {
    await this.session.close();
    await driver.close();
  }
}

// Export a singleton instance
export const kgService = new KnowledgeGraphService();
