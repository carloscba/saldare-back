import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';

let initialized = false;
function ensureInitialized() {
  if (!initialized) {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    admin.initializeApp({ projectId });
    initialized = true;
  }
}

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    ensureInitialized();
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException(
        'Invalid authorization header format. Expected: Bearer <token>',
      );
    }

    const token = parts[1];

    if (
      process.env.AUTH_BYPASS_TOKEN &&
      token === process.env.AUTH_BYPASS_TOKEN
    ) {
      request.user = { uid: 'dev-user', email: 'dev@example.com' };
      return true;
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      request.user = decodedToken;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired Firebase token');
    }
  }
}
