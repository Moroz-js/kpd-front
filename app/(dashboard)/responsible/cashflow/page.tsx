import { redirect } from "next/navigation";

// Кэшфлоу доступен только администратору. Руководитель смотрит финансы
// по своим проектам внутри самого проекта.
export default function Page() {
  redirect("/responsible/projects");
}
