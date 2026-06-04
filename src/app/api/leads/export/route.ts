import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '../../../../lib/mongodb';
import Lead from '../../../../models/Lead';
import User from '../../../../models/User';
import { authOptions } from '../../../../lib/auth';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await dbConnect();
    const userId = (session.user as any).id;
    const user = await User.findOne({ google_id: userId });
    
    if (!user) {
      return new Response('User not found', { status: 404 });
    }

    const leads = await Lead.find({ user_id: user._id }).sort({ created_at: -1 });

    const csvLines = ['sender_email,created_at'];
    leads.forEach(lead => {
      csvLines.push(`${lead.sender_email},${lead.created_at.toISOString()}`);
    });

    const csvContent = csvLines.join('\n');

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="leads_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });

  } catch (error: any) {
    console.error('Error exporting leads:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
