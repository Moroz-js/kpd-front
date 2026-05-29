import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 дней (TZ §Аутентификация)
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { executor: true },
        });

        if (!user) return null;
        if (!user.isActive) return null;
        if (user.executor?.accessRevokedAt) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
          fullName: user.fullName,
          executorId: user.executor?.id ?? null,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
        token.fullName = (user as { fullName: string }).fullName;
        token.executorId = (user as { executorId: string | null }).executorId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const u = session.user as unknown as Record<string, unknown>;
        u.role = token.role;
        u.fullName = token.fullName;
        u.executorId = token.executorId;
        u.id = token.sub;
      }
      return session;
    },
  },
});

export type SessionUser = {
  id: string;
  email: string;
  role: string;
  fullName: string;
  executorId: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as Record<string, unknown>;
  return {
    id: u.id as string,
    email: u.email as string,
    role: u.role as string,
    fullName: u.fullName as string,
    executorId: (u.executorId as string | null) ?? null,
  };
}
