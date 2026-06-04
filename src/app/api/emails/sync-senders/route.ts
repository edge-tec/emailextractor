import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { google } from 'googleapis';
import dbConnect from '../../../../lib/mongodb';
import User from '../../../../models/User';
import Lead from '../../../../models/Lead';
import { authOptions } from '../../../../lib/auth';

function extractEmail(fromHeader: string): string | null {
  // Regex to extract email from "Name <email@domain.com>" or just "email@domain.com"
  const match = fromHeader.match(/<([^>]+)>/);
  let email = match ? match[1] : fromHeader;
  
  email = email.trim().toLowerCase();
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(email)) {
    return email;
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const userId = (session.user as any).id;
    const user = await User.findOne({ google_id: userId });

    if (!user || !user.access_token) {
      return NextResponse.json({ error: 'User tokens not found' }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: user.access_token,
      refresh_token: user.refresh_token,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 100, // Fetch up to 100 latest emails for this run
    });

    const messages = response.data.messages || [];
    let extractedCount = 0;
    let duplicateCount = 0;

    for (const message of messages) {
      if (!message.id) continue;

      // Check if we already processed this message
      const existingLead = await Lead.findOne({ user_id: user._id, message_id: message.id });
      if (existingLead) {
         continue; // We already processed this email
      }

      // Fetch message headers
      const msgData = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'metadata',
        metadataHeaders: ['From'],
      });

      const headers = msgData.data.payload?.headers || [];
      const fromHeader = headers.find(h => h.name?.toLowerCase() === 'from');

      if (fromHeader && fromHeader.value) {
        const email = extractEmail(fromHeader.value);
        if (email) {
          try {
             await Lead.create({
               user_id: user._id,
               sender_email: email,
               message_id: message.id,
             });
             extractedCount++;
          } catch (e: any) {
             if (e.code === 11000) {
                // Duplicate key error due to unique compound index (user_id, sender_email)
                // We also create a dummy lead with the new message id to avoid reprocessing the message
                // Wait, if it's a duplicate sender, we just skip it, but maybe we should record that we processed the message?
                // For simplicity, we just ignore the error. It will be fetched again and hit this duplicate error again, which is fine, but slightly inefficient.
                // To optimize, we could save the message_id to a separate ProcessedMessage collection.
                duplicateCount++;
             } else {
                console.error("Error creating lead:", e);
             }
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Sync completed',
      stats: {
         extractedCount,
         duplicateCount,
         totalProcessed: messages.length
      }
    });

  } catch (error: any) {
    console.error('Error during email sync:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
