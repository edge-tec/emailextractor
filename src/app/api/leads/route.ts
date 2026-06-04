import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '../../../lib/mongodb';
import Lead from '../../../models/Lead';
import { authOptions } from '../../../lib/auth';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const domainFilter = searchParams.get('domain');

    await dbConnect();
    const userId = (session.user as any).id;
    // We actually stored user._id (ObjectId) in Lead collection
    // So we need to find the user first
    const User = (await import('../../../models/User')).default;
    const user = await User.findOne({ google_id: userId });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let query: any = { user_id: user._id };
    
    if (domainFilter) {
      query.sender_email = { $regex: `@${domainFilter}$`, $options: 'i' };
    }

    const leads = await Lead.find(query).sort({ created_at: -1 });

    return NextResponse.json({ success: true, leads });

  } catch (error: any) {
    console.error('Error fetching leads:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
