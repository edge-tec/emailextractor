import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import dbConnect from './mongodb';
import User from '../models/User';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        try {
          await dbConnect();

          const existingUser = await User.findOne({ google_id: user.id });

          if (existingUser) {
            // Update tokens
            existingUser.access_token = account.access_token;
            if (account.refresh_token) {
              existingUser.refresh_token = account.refresh_token;
            }
            await existingUser.save();
          } else {
            // Create new user
            await User.create({
              google_id: user.id,
              email: user.email,
              name: user.name,
              access_token: account.access_token,
              refresh_token: account.refresh_token,
            });
          }
          return true;
        } catch (error) {
          console.error('Error saving user during sign in:', error);
          return false;
        }
      }
      return false;
    },
    async session({ session, token }) {
      // Attach the user ID to the session
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
    },
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
