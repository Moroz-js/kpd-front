"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

type ArrayFilter = {
  stateKey: string;
  param: string;
  kind: "array";
  value: string[];
  defaultValue: string[];
  setValue: React.Dispatch<React.SetStateAction<string[]>>;
};

type BooleanFilter = {
  stateKey: string;
  param: string;
  kind: "boolean";
  value: boolean;
  defaultValue: boolean;
  setValue: React.Dispatch<React.SetStateAction<boolean>>;
};

type StringFilter = {
  stateKey: string;
  param: string;
  kind: "string";
  value: string;
  defaultValue: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
};

export type UrlSyncedFilter = ArrayFilter | BooleanFilter | StringFilter;

/** Пауза перед записью фильтров в URL: быстрый ввод в поиске не должен
 *  дёргать адресную строку на каждый символ. */
const URL_WRITE_DELAY_MS = 300;

/**
 * Синхронизирует фильтры таблицы с URL, не затрагивая сортировку, группировку
 * и остальные параметры страницы. Наличие любого параметра фильтра в URL
 * делает URL источником истины для всего набора фильтров.
 */
export function useUrlSyncedFilters(filters: UrlSyncedFilter[]) {
  const pathname = usePathname();
  const filtersRef = React.useRef(filters);
  const initialSyncRef = React.useRef(true);
  // Ссылку читаем из window, а не из useSearchParams: у статически
  // отрендеренной страницы параметры доезжают только после гидратации, и
  // фильтры из присланной ссылки успели бы потеряться.
  const hadUrlFiltersRef = React.useRef<boolean | null>(null);
  const stateSignature = JSON.stringify(
    filters.map((filter) => [filter.param, filter.value])
  );

  React.useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Открыли ссылку с фильтрами — значит источник истины URL, а не localStorage.
  const openedWithUrlFilters = React.useCallback(() => {
    if (hadUrlFiltersRef.current === null) {
      const params = new URLSearchParams(window.location.search);
      hadUrlFiltersRef.current = filtersRef.current.some((filter) =>
        params.has(filter.param)
      );
    }
    return hadUrlFiltersRef.current;
  }, []);

  const applyFromUrl = React.useCallback((params: URLSearchParams) => {
    for (const filter of filtersRef.current) {
      if (filter.kind === "array") {
        filter.setValue(
          params.has(filter.param)
            ? params.getAll(filter.param).filter(Boolean)
            : [...filter.defaultValue]
        );
      } else if (filter.kind === "boolean") {
        filter.setValue(
          params.has(filter.param)
            ? params.get(filter.param) === "1"
            : filter.defaultValue
        );
      } else {
        filter.setValue(
          params.has(filter.param)
            ? params.get(filter.param) ?? filter.defaultValue
            : filter.defaultValue
        );
      }
    }
  }, []);

  // URL читаем только при открытии страницы и при кнопках «назад/вперёд».
  // Следить за каждым изменением search нельзя: свою же запись мы делаем с
  // задержкой, и промежуточное значение параметра затирало бы уже набранный
  // в поиске текст, откидывая курсор на символ назад.
  React.useEffect(() => {
    if (openedWithUrlFilters()) {
      applyFromUrl(new URLSearchParams(window.location.search));
    }
  }, [applyFromUrl, openedWithUrlFilters]);

  React.useEffect(() => {
    const onPopState = () => applyFromUrl(new URLSearchParams(window.location.search));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyFromUrl]);

  React.useEffect(() => {
    const syncUrl = () => {
      const currentSearch = window.location.search.replace(/^\?/, "");
      const next = new URLSearchParams(currentSearch);
      for (const filter of filtersRef.current) {
        next.delete(filter.param);
        if (filter.kind === "array") {
          for (const value of filter.value) next.append(filter.param, value);
        } else if (filter.kind === "boolean" && filter.value) {
          next.set(filter.param, "1");
        } else if (filter.kind === "string" && filter.value) {
          next.set(filter.param, filter.value);
        }
      }

      const nextSearch = next.toString();
      if (nextSearch === currentSearch) return;
      // History API вместо router.replace: фильтры нигде не читаются на
      // сервере, а навигация роутером перезапрашивала бы RSC на каждый символ
      // и подставляла общий loading сегмента вместо таблицы.
      window.history.replaceState(
        null,
        "",
        nextSearch ? `${pathname}?${nextSearch}` : pathname
      );
    };

    if (initialSyncRef.current) {
      // Флаг переводим в false только когда кадр реально выполнился, а не при
      // планировании: в дев-режиме (React Strict Mode) эффект монтирования
      // вызывается дважды подряд синхронно, до того как применится setState
      // из эффекта восстановления фильтров из URL. Если сбросить флаг сразу
      // при планировании, второй (синхронный) вызов этого же эффекта уйдёт
      // в synchronous-ветку и перезапишет URL по ещё не обновлённым (пустым)
      // значениям фильтров, затирая часть параметров прямо при открытии ссылки.
      const frame = window.requestAnimationFrame(() => {
        initialSyncRef.current = false;
        syncUrl();
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const timer = window.setTimeout(syncUrl, URL_WRITE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pathname, stateSignature]);

  const restorePersisted = React.useCallback((stored: object) => {
    if (openedWithUrlFilters()) return;

    const values = stored as Record<string, unknown>;
    for (const filter of filtersRef.current) {
      const value = values[filter.stateKey];
      if (filter.kind === "array" && Array.isArray(value)) {
        filter.setValue(value.filter((item): item is string => typeof item === "string"));
      } else if (filter.kind === "boolean" && typeof value === "boolean") {
        filter.setValue(value);
      } else if (filter.kind === "string" && typeof value === "string") {
        filter.setValue(value);
      }
    }
  }, [openedWithUrlFilters]);

  return { restorePersisted };
}
