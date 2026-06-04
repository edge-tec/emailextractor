import { connect } from 'imap-simple';

export async function verifyImapCredentials(email: string, appPassword: string): Promise<boolean> {
  const config = {
    imap: {
      user: email,
      password: appPassword,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      authTimeout: 10000,
      tlsOptions: { rejectUnauthorized: false }
    }
  };

  try {
    const connection = await connect(config);
    connection.end();
    return true;
  } catch (error) {
    console.error('IMAP Verification failed:', error);
    return false;
  }
}
