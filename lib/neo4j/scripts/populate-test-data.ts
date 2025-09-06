import { kgService } from '../kg-service';

async function populateTestData() {
  console.log('🧬 Populating Neo4j with biomedical test data...');

  try {
    // Create some basic biomedical entities
    const entities = [
      {
        name: 'Insulin',
        type: 'Protein',
        description: 'Hormone that regulates blood glucose levels',
      },
      {
        name: 'Diabetes',
        type: 'Disease',
        description: 'Metabolic disorder characterized by high blood sugar',
      },
      {
        name: 'Glucose',
        type: 'Molecule',
        description: 'Simple sugar that serves as the primary energy source',
      },
      {
        name: 'Pancreas',
        type: 'Organ',
        description: 'Organ that produces insulin and digestive enzymes',
      },
      {
        name: 'Metformin',
        type: 'Drug',
        description: 'First-line medication for type 2 diabetes',
      },
      {
        name: 'Type 2 Diabetes',
        type: 'Disease',
        description: 'Chronic condition affecting glucose metabolism',
      },
      {
        name: 'Insulin Resistance',
        type: 'Condition',
        description: 'Reduced response to insulin in target tissues',
      },
      {
        name: 'Beta Cells',
        type: 'CellType',
        description: 'Pancreatic cells that produce insulin',
      },
    ];

    console.log('Creating entities...');
    for (const entity of entities) {
      const result = await kgService.createTestEntity(
        entity.name,
        entity.type,
        entity.description,
      );
      if (result) {
        console.log(`✅ Created: ${entity.name} (${entity.type})`);
      }
    }

    // Create some relationships
    console.log('Creating relationships...');
    await kgService.createRelationship('Insulin', 'PRODUCED_BY', 'Beta Cells');
    await kgService.createRelationship('Insulin', 'REGULATES', 'Glucose');
    await kgService.createRelationship(
      'Diabetes',
      'CAUSED_BY',
      'Insulin Resistance',
    );
    await kgService.createRelationship('Type 2 Diabetes', 'IS_A', 'Diabetes');
    await kgService.createRelationship(
      'Metformin',
      'TREATS',
      'Type 2 Diabetes',
    );
    await kgService.createRelationship('Pancreas', 'CONTAINS', 'Beta Cells');
    await kgService.createRelationship('Beta Cells', 'PRODUCES', 'Insulin');
    await kgService.createRelationship(
      'Insulin Resistance',
      'ASSOCIATED_WITH',
      'Type 2 Diabetes',
    );

    // Get graph statistics
    const stats = await kgService.getGraphStats();
    console.log('📊 Graph statistics:', stats);

    console.log('🎉 Test data population completed!');
    console.log(
      '🌐 You can now access Neo4j Browser at: http://localhost:7474',
    );
    console.log('🔑 Login with: neo4j / password123');
  } catch (error) {
    console.error('❌ Error populating test data:', error);
  } finally {
    await kgService.close();
  }
}

// Run the script
populateTestData();
