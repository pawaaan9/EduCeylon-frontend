"use client";

import { PlusIcon, TrashIcon } from "@/components/icons";
import {
  newClientId,
  WEEKLY_DAY_OPTIONS,
  type WeeklyDay,
  type WeeklyScheduleSlot,
} from "@/lib/courses/types";
import { useT } from "@/lib/i18n/I18nProvider";

const DAY_ORDER: Record<WeeklyDay, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

export function WeeklyScheduleEditor({
  slots,
  onChange,
}: {
  slots: WeeklyScheduleSlot[];
  onChange: (next: WeeklyScheduleSlot[]) => void;
}) {
  const t = useT();

  function addSlot() {
    onChange([
      ...slots,
      {
        id: newClientId("slot"),
        day: "monday",
        startTime: "08:00",
        endTime: "10:00",
        title: "",
      },
    ]);
  }

  function updateSlot(id: string, patch: Partial<WeeklyScheduleSlot>) {
    onChange(slots.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeSlot(id: string) {
    onChange(slots.filter((s) => s.id !== id));
  }

  const sorted = [...slots].sort((a, b) => {
    const dayDiff = DAY_ORDER[a.day] - DAY_ORDER[b.day];
    if (dayDiff !== 0) return dayDiff;
    return a.startTime.localeCompare(b.startTime);
  });

  return (
    <div className="grid gap-4">
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-300 bg-ink-50 p-8 text-center text-sm text-ink-500">
          {t("lecturer.create.schedule.empty")}
        </div>
      ) : (
        sorted.map((slot) => (
          <div
            key={slot.id}
            className="rounded-xl border border-ink-200 bg-white p-4 sm:p-5"
          >
            <div className="grid gap-3 sm:grid-cols-[140px_120px_120px_1fr_auto] sm:items-end">
              <Labeled label={t("lecturer.create.schedule.day")}>
                <select
                  className="input-base select-base"
                  value={slot.day}
                  onChange={(e) =>
                    updateSlot(slot.id, { day: e.target.value as WeeklyDay })
                  }
                >
                  {WEEKLY_DAY_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {t(`lecturer.create.day.${d}`)}
                    </option>
                  ))}
                </select>
              </Labeled>

              <Labeled label={t("lecturer.create.schedule.startTime")}>
                <input
                  type="time"
                  className="input-base"
                  value={slot.startTime}
                  onChange={(e) =>
                    updateSlot(slot.id, { startTime: e.target.value })
                  }
                />
              </Labeled>

              <Labeled label={t("lecturer.create.schedule.endTime")}>
                <input
                  type="time"
                  className="input-base"
                  value={slot.endTime}
                  onChange={(e) =>
                    updateSlot(slot.id, { endTime: e.target.value })
                  }
                />
              </Labeled>

              <Labeled label={t("lecturer.create.schedule.classTitle")}>
                <input
                  className="input-base"
                  placeholder={t("lecturer.create.schedule.classTitle.placeholder")}
                  value={slot.title}
                  onChange={(e) =>
                    updateSlot(slot.id, { title: e.target.value })
                  }
                />
              </Labeled>

              <button
                type="button"
                onClick={() => removeSlot(slot.id)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-500 hover:bg-rose-50 hover:text-rose-600 sm:self-end"
                aria-label={t("lecturer.create.schedule.remove")}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Labeled label={t("lecturer.create.schedule.meetingURL")}>
                <input
                  type="url"
                  className="input-base"
                  placeholder="https://meet.…"
                  value={slot.meetingURL ?? ""}
                  onChange={(e) =>
                    updateSlot(slot.id, { meetingURL: e.target.value })
                  }
                />
              </Labeled>
              <Labeled label={t("lecturer.create.schedule.notes")}>
                <input
                  className="input-base"
                  value={slot.description ?? ""}
                  onChange={(e) =>
                    updateSlot(slot.id, { description: e.target.value })
                  }
                />
              </Labeled>
            </div>
          </div>
        ))
      )}

      <div>
        <button
          type="button"
          onClick={addSlot}
          className="btn btn-secondary"
        >
          <PlusIcon className="h-4 w-4" />
          {t("lecturer.create.schedule.add")}
        </button>
      </div>
    </div>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-600 mb-1 block">
        {label}
      </span>
      {children}
    </label>
  );
}
