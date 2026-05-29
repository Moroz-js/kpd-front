import { Prisma } from "@prisma/client";

/** Человекочитаемое сообщение для типичных ошибок Prisma. */
export function prismaErrorMessage(e: unknown, fallback = "Ошибка базы данных"): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case "P2003":
        return "Связанная запись не найдена. Выйдите из аккаунта и войдите снова.";
      case "P2025":
        return "Запись не найдена";
      case "P2002":
        return "Такая запись уже существует";
      default:
        break;
    }
  }
  return e instanceof Error ? e.message : fallback;
}
