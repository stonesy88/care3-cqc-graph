import neo4j from 'neo4j-driver';

const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const password = process.env.NEO4J_PASSWORD || 'password';
const user = 'neo4j';

export const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
