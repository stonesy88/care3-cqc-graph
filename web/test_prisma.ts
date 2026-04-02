import "dotenv/config";
import { PrismaClient } from '@prisma/client';

console.log("Testing { errorFormat: 'pretty' }...");
try {
  process.env.DATABASE_URL = process.env.COCOINDEX_DATABASE_URL;
  new PrismaClient({ errorFormat: 'pretty' });
  console.log("SUCCESS");
} catch(e: any) { 
  console.log("FAILED: " + e.message); 
}
