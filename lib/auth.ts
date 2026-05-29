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
        const u = user as { id: string; role: string; fullName: string; executorId: string | null; email?: string };
        token.sub = u.id;
        token.role = u.role;
        token.fullName = u.fullName;
        token.executorId = u.executorId;
        if (u.email) token.email = u.email;
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

/**
 * Текущий пользователь из сессии, сверенный с БД.
 * После db:reset id в JWT может не совпадать с новыми записями — ищем по email.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;

  const u = session.user as Record<string, unknown>;
  const email = typeof u.email === "string" ? u.email : null;
  const sessionId = typeof u.id === "string" ? u.id : null;
  if (!email && !sessionId) return null;

  const dbUser = await prisma.user.findFirst({
    where: email ? { email } : { id: sessionId! },
    select: {
      id: true,
      email: true,
      role: true,
      fullName: true,
      isActive: true,
      executor: { select: { id: true, accessRevokedAt: true } },
    },
  });

  if (!dbUser?.isActive) return null;
  if (dbUser.executor?.accessRevokedAt) return null;

  return {
    id: dbUser.id,
    email: dbUser.email,
    role: dbUser.role,
    fullName: dbUser.fullName,
    executorId: dbUser.executor?.id ?? null,
  };
}
