import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const policyId = resolvedParams.id;
    
    // Prisma will cascade delete keyStatements mapping array automatically if configured, 
    // but just in case, we can delete the join records explicitly first
    await prisma.policyKeyStatement.deleteMany({
      where: { policyId: policyId }
    });

    // Delete the primary policy
    await prisma.policy.delete({
      where: { id: policyId }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting policy:', error);
    return NextResponse.json({ error: 'Failed to delete policy' }, { status: 500 });
  }
}
