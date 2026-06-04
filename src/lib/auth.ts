import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import dbConnect from './mongodb';
import User from '../models/User';
import { encryptPassword } from './crypto';
import { verifyImapCredentials } from './imap';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Gmail & App Password',
      credentials: {
        email: { label: "Gmail Address", type: "email", placeholder: "you@gmail.com" },
        appPassword: { label: "App Password", type: "password", placeholder: "16-character app password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.appPassword) {
          throw new Error('Email and App Password are required');
        }

        const isValid = await verifyImapCredentials(credentials.email, credentials.appPassword);
        
        if (!isValid) {
           throw new Error('Invalid IMAP credentials. Ensure you are using an App Password and IMAP is enabled.');
        }

        await dbConnect();
        
        const encrypted = encryptPassword(credentials.appPassword);
        
        let user = await User.findOne({ email: credentials.email.toLowerCase() });
        if (user) {
          user.app_password = encrypted;
          await user.save();
        } else {
          user = await User.create({
            email: credentials.email.toLowerCase(),
            app_password: encrypted
          });
        }

        return { id: user._id.toString(), email: user.email };
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (session?.user && token.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    }
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
