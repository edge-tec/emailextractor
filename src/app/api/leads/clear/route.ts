import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '../../../../lib/mongodb';
import Lead from '../../../../models/Lead';
import User from '../../../../models/User';
import { authOptions } from '../../../../lib/auth';

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const userId = (session.user as any).id;
    const user = await User.findOne({ google_id: userId });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await Lead.deleteMany({ user_id: user._id });

    return NextResponse.json({ success: true, message: 'Leads cleared successfully' });

  } catch (error: any) {
    console.error('Error clearing leads:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
