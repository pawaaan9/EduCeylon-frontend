"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { fetchQualificationSuggestions } from "@/lib/api/lecturers";
import { useT } from "@/lib/i18n/I18nProvider";
import type { LecturerQualification } from "@/lib/api/types";

function newQualificationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isQualificationComplete(
  q: Omit<LecturerQualification, "id">,
): boolean {
  return (
    !!q.title.trim() &&
    !!q.institute.trim() &&
    /^\d{4}$/.test(q.year.trim())
  );
}

function filterSuggestions(
  query: string,
  options: readonly string[],
  limit = 8,
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return options.slice(0, limit);
  return options
    .filter((o) => o.toLowerCase().includes(q))
    .slice(0, limit);
}

function SuggestField({
  label,
  placeholder,
  value,
  onChange,
  suggestions,
  required,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
  suggestions: readonly string[];
  required?: boolean;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const matches = filterSuggestions(value, suggestions);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-700 mb-1.5 block">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      <div ref={wrapRef} className="relative">
        <input
          className="input-base"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={listId}
        />
        {open && matches.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-ink-200 bg-white py-1 shadow-lg"
          >
            {matches.map((s) => (
              <li key={s} role="option">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-ink-800 hover:bg-brand-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(s);
                    setOpen(false);
                  }}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </label>
  );
}

const EMPTY_SUGGESTIONS = { titles: [] as string[], institutes: [] as string[] };

export function QualificationsInput({
  label,
  helper,
  values,
  onChange,
}: {
  label: string;
  helper?: string;
  values: LecturerQualification[];
  onChange: (next: LecturerQualification[]) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState({
    title: "",
    institute: "",
    year: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState(EMPTY_SUGGESTIONS);

  useEffect(() => {
    let cancelled = false;
    fetchQualificationSuggestions()
      .then((data) => {
        if (!cancelled) setSuggestions(data);
      })
      .catch(() => {
        if (!cancelled) setSuggestions(EMPTY_SUGGESTIONS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function addQualification() {
    const entry: LecturerQualification = {
      id: newQualificationId(),
      title: draft.title.trim(),
      institute: draft.institute.trim(),
      year: draft.year.trim(),
    };
    if (!isQualificationComplete(entry)) {
      setFormError(t("onboard.prof.qualifications.incomplete"));
      return;
    }
    setFormError(null);
    onChange([...values, entry]);
    setDraft({ title: "", institute: "", year: "" });
  }

  return (
    <div>
      <div className="text-sm font-medium text-ink-700 mb-1.5">{label}</div>
      {helper && <p className="mb-3 text-xs text-ink-500">{helper}</p>}

      {values.length > 0 && (
        <ul className="mb-4 space-y-2">
          {values.map((q) => (
            <li
              key={q.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-ink-200 bg-ink-50 px-3 py-2.5 text-sm"
            >
              <div className="min-w-0 text-ink-900">
                <div className="font-semibold">{q.title}</div>
                <div className="text-ink-600">
                  {q.institute}
                  {q.year ? ` · ${q.year}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x.id !== q.id))}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-white hover:text-ink-900"
                aria-label={t("onboard.prof.qualifications.remove")}
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-xl border border-dashed border-ink-300 bg-white p-4 space-y-4">
        <SuggestField
          label={t("onboard.prof.qualifications.title")}
          placeholder={t("onboard.prof.qualifications.title.placeholder")}
          value={draft.title}
          onChange={(title) => setDraft((d) => ({ ...d, title }))}
          suggestions={suggestions.titles}
          required
        />
        <SuggestField
          label={t("onboard.prof.qualifications.institute")}
          placeholder={t("onboard.prof.qualifications.institute.placeholder")}
          value={draft.institute}
          onChange={(institute) => setDraft((d) => ({ ...d, institute }))}
          suggestions={suggestions.institutes}
          required
        />
        <label className="block">
          <span className="text-sm font-medium text-ink-700 mb-1.5 block">
            {t("onboard.prof.qualifications.year")}
            <span className="text-rose-500"> *</span>
          </span>
          <input
            className="input-base max-w-[8rem]"
            type="text"
            inputMode="numeric"
            maxLength={4}
            placeholder="2018"
            value={draft.year}
            onChange={(e) => {
              const year = e.target.value.replace(/\D/g, "").slice(0, 4);
              setDraft((d) => ({ ...d, year }));
            }}
          />
        </label>

        {formError && (
          <p className="text-xs text-rose-600" role="alert">
            {formError}
          </p>
        )}

        <button
          type="button"
          className="btn btn-secondary"
          onClick={addQualification}
        >
          {t("onboard.prof.qualifications.add")}
        </button>
      </div>
    </div>
  );
}
