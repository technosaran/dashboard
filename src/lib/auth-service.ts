/**
 * Authentication and Session Management Service.
 * Implements requirements 1.8, 1.9, 1.10: Session verification, automatic token refresh, and session management.
 */

import { SupabaseClient, User, Session } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types";

export interface SessionVerification {
  valid: boolean;
  user?: User;
  expiresAt?: Date;
}

export class AuthService {
  constructor(private supabaseClient: SupabaseClient<Database>) {}

  /**
   * Retrieves the current authenticated user from session cache or server.
   */
  public async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user }, error } = await this.supabaseClient.auth.getUser();
      if (error) {
        console.error("[AuthService] Error fetching current user:", error.message);
        return null;
      }
      return user;
    } catch (error) {
      console.error("[AuthService] Exception in getCurrentUser:", error);
      return null;
    }
  }

  /**
   * Verifies the active session and returns authentication details.
   */
  public async verifySession(): Promise<SessionVerification> {
    try {
      const { data: { session }, error } = await this.supabaseClient.auth.getSession();
      
      if (error || !session) {
        return { valid: false };
      }

      const expiresAt = session.expires_at 
        ? new Date(session.expires_at * 1000) 
        : undefined;

      return {
        valid: true,
        user: session.user,
        expiresAt,
      };
    } catch (error) {
      console.error("[AuthService] Exception in verifySession:", error);
      return { valid: false };
    }
  }

  /**
   * Refreshes the current authentication session token.
   */
  public async refreshSession(): Promise<Session | null> {
    try {
      const { data: { session }, error } = await this.supabaseClient.auth.refreshSession();
      if (error) {
        console.error("[AuthService] Error refreshing session:", error.message);
        return null;
      }
      return session;
    } catch (error) {
      console.error("[AuthService] Exception in refreshSession:", error);
      return null;
    }
  }

  /**
   * Logs out the user and cleans up cookies/local storage session state.
   */
  public async logout(): Promise<void> {
    try {
      const { error } = await this.supabaseClient.auth.signOut();
      if (error) {
        console.error("[AuthService] Error signing out:", error.message);
      }
    } catch (error) {
      console.error("[AuthService] Exception in logout:", error);
    }
  }
}
