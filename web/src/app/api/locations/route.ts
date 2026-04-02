import { NextResponse } from 'next/server';
import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password')
);

export async function GET() {
  const session = driver.session(); // Instantiate outside the try block

  try {
    // Use coalesce to safely handle both 'id' and 'location_id' depending on ingestion schema
    const result = await session.run(`
      MATCH (l:Location)
      OPTIONAL MATCH (l)-[:MANAGED_BY]->(p:Provider)
      OPTIONAL MATCH (l)-[:HAS_SPECIALISM]->(s:Specialism)
      OPTIONAL MATCH (l)-[:PROVIDES_SERVICE]->(st:ServiceType)
      RETURN coalesce(l.id, l.location_id) AS id, 
             coalesce(l.name, l.title, "Unknown Location") AS name,
             l.registration_status AS registration_status,
             l.phone AS phone,
             l.website AS website,
             p.provider_id AS provider_id,
             COLLECT(DISTINCT s.name) AS specialisms,
             COLLECT(DISTINCT st.name) AS serviceTypes
      ORDER BY name ASC
    `);

    const locations = result.records.map(record => ({
      id: record.get('id'),
      name: record.get('name'),
      registration_status: record.get('registration_status') || null,
      phone: record.get('phone') || null,
      website: record.get('website') || null,
      provider_id: record.get('provider_id') || null,
      specialisms: record.get('specialisms') || [],
      serviceTypes: record.get('serviceTypes') || []
    }));

    return NextResponse.json(locations);
  } catch (error) {
    console.error("Locations API Error:", error);
    return NextResponse.json({ error: "Failed to fetch locations." }, { status: 500 });
  } finally {

    await session.close();
  }
}