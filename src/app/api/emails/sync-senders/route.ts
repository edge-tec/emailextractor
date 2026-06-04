import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { connect } from 'imap-simple';
import { simpleParser } from 'mailparser';
import dbConnect from '../../../../lib/mongodb';
import User from '../../../../models/User';
import Lead from '../../../../models/Lead';
import { authOptions } from '../../../../lib/auth';
import { decryptPassword } from '../../../../lib/crypto';

function extractEmail(fromHeader: string): string | null {
  const match = fromHeader.match(/<([^>]+)>/);
  let email = match ? match[1] : fromHeader;
  email = email.trim().toLowerCase();
  
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
    const user = await User.findById(userId);

    if (!user || !user.app_password) {
      return NextResponse.json({ error: 'IMAP credentials not found' }, { status: 400 });
    }

    const decryptedPassword = decryptPassword(user.app_password);

    const config = {
      imap: {
        user: user.email,
        password: decryptedPassword,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        authTimeout: 10000,
        tlsOptions: { rejectUnauthorized: false }
      }
    };

    const connection = await connect(config);
    await connection.openBox('INBOX');

    // Fetch emails from the last 30 days to avoid fetching 100k+ emails at once
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 30);
    const searchCriteria = [['SINCE', sinceDate]];
    const fetchOptions = {
      bodies: ['HEADER.FIELDS (FROM)', 'HEADER.FIELDS (MESSAGE-ID)'],
      struct: false
    };

    const messages = await connection.search(searchCriteria, fetchOptions);
    connection.end();

    let extractedCount = 0;
    let duplicateCount = 0;

    for (const item of messages) {
      const headerPart = item.parts.find(part => part.which.includes('HEADER'));
      if (!headerPart || !headerPart.body) continue;

      // Parse headers
      const parsedInfo = await simpleParser(headerPart.body);
      const fromObj = parsedInfo.from;
      const messageId = parsedInfo.messageId || String(item.attributes.uid);

      if (!fromObj || !fromObj.value || fromObj.value.length === 0) continue;

      // Check if we already processed this message
      const existingLead = await Lead.findOne({ user_id: user._id, message_id: messageId });
      if (existingLead) {
         continue; 
      }

      const emailStr = fromObj.value[0].address || fromObj.value[0].name;
      if (!emailStr) continue;

      const email = extractEmail(emailStr);
      if (email) {
        try {
           await Lead.create({
             user_id: user._id,
             sender_email: email,
             message_id: messageId,
           });
           extractedCount++;
        } catch (e: any) {
           if (e.code === 11000) {
              // Duplicate key error
              duplicateCount++;
           } else {
              console.error("Error creating lead:", e);
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
    console.error('Error during IMAP sync:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
