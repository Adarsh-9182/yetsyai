// Habit editor built on the native <dialog> element for free focus-trapping,
// Escape-to-close, and backdrop semantics. Handles both create and edit.

import { el } from "./dom.js";
import { COLORS, EMOJIS } from "./store.js";
import { WEEKDAYS_SHORT } from "./dates.js";

export class HabitEditor {
  /** @param {(data: object, id: string|null) => void} onSubmit */
  constructor(onSubmit) {
    this.onSubmit = onSubmit;
    this.editingId = null;
    this.draft = this.#blankDraft();
    this.dialog = el("dialog", { class: "editor", "aria-label": "Habit editor" });
    document.body.append(this.dialog);
    this.dialog.addEventListener("close", () => this.dialog.classList.remove("open"));
  }

  #blankDraft() {
    return { name: "", emoji: EMOJIS[0], color: COLORS[0], mode: "daily", days: [1, 2, 3, 4, 5] };
  }

  open(habit = null) {
    if (habit) {
      this.editingId = habit.id;
      this.draft = {
        name: habit.name,
        emoji: habit.emoji,
        color: habit.color,
        mode: habit.schedule === "daily" ? "daily" : "custom",
        days: habit.schedule === "daily" ? [1, 2, 3, 4, 5] : [...habit.schedule],
      };
    } else {
      this.editingId = null;
      this.draft = this.#blankDraft();
    }
    this.#render();
    this.dialog.showModal();
    this.dialog.classList.add("open");
    requestAnimationFrame(() => this.dialog.querySelector("#habit-name")?.focus());
  }

  #render() {
    const d = this.draft;

    const nameInput = el("input", {
      id: "habit-name",
      class: "field-input",
      type: "text",
      value: d.name,
      maxLength: 40,
      placeholder: "e.g. Read 20 pages",
      autocomplete: "off",
      oninput: (e) => (d.name = e.target.value),
    });

    const emojiGrid = el(
      "div",
      { class: "chip-grid", role: "radiogroup", "aria-label": "Icon" },
      EMOJIS.map((emoji) =>
        el("button", {
          type: "button",
          class: "emoji-chip" + (emoji === d.emoji ? " selected" : ""),
          role: "radio",
          "aria-checked": String(emoji === d.emoji),
          "aria-label": emoji,
          text: emoji,
          onclick: () => {
            d.emoji = emoji;
            this.#render();
          },
        }),
      ),
    );

    const colorGrid = el(
      "div",
      { class: "chip-grid", role: "radiogroup", "aria-label": "Color" },
      COLORS.map((color) =>
        el("button", {
          type: "button",
          class: `color-chip color-${color}` + (color === d.color ? " selected" : ""),
          role: "radio",
          "aria-checked": String(color === d.color),
          "aria-label": color,
          onclick: () => {
            d.color = color;
            this.#render();
          },
        }),
      ),
    );

    const modeToggle = el("div", { class: "seg", role: "radiogroup", "aria-label": "Schedule" }, [
      el("button", {
        type: "button",
        class: "seg-btn" + (d.mode === "daily" ? " active" : ""),
        "aria-pressed": String(d.mode === "daily"),
        text: "Every day",
        onclick: () => {
          d.mode = "daily";
          this.#render();
        },
      }),
      el("button", {
        type: "button",
        class: "seg-btn" + (d.mode === "custom" ? " active" : ""),
        "aria-pressed": String(d.mode === "custom"),
        text: "Certain days",
        onclick: () => {
          d.mode = "custom";
          this.#render();
        },
      }),
    ]);

    // Ordered Mon..Sun for display; value maps back to 0..6 (Sun=0).
    const order = [1, 2, 3, 4, 5, 6, 0];
    const dayPicker =
      d.mode === "custom"
        ? el(
            "div",
            { class: "day-picker", role: "group", "aria-label": "Days of week" },
            order.map((dow) =>
              el("button", {
                type: "button",
                class: "day-btn" + (d.days.includes(dow) ? " on" : ""),
                "aria-pressed": String(d.days.includes(dow)),
                text: WEEKDAYS_SHORT[dow][0],
                title: WEEKDAYS_SHORT[dow],
                onclick: () => {
                  d.days = d.days.includes(dow)
                    ? d.days.filter((x) => x !== dow)
                    : [...d.days, dow];
                  this.#render();
                },
              }),
            ),
          )
        : null;

    const error = el("p", { class: "editor-error", id: "editor-error", role: "alert" });

    const form = el(
      "form",
      {
        class: "editor-form",
        method: "dialog",
        onsubmit: (e) => {
          e.preventDefault();
          this.#submit(error);
        },
      },
      [
        el("header", { class: "editor-head" }, [
          el("h2", { text: this.editingId ? "Edit habit" : "New habit" }),
          el("button", {
            type: "button",
            class: "icon-btn",
            "aria-label": "Close",
            html: "&times;",
            onclick: () => this.dialog.close(),
          }),
        ]),
        el("label", { class: "field" }, [el("span", { class: "field-label", text: "Name" }), nameInput]),
        el("div", { class: "field" }, [el("span", { class: "field-label", text: "Icon" }), emojiGrid]),
        el("div", { class: "field" }, [el("span", { class: "field-label", text: "Color" }), colorGrid]),
        el("div", { class: "field" }, [
          el("span", { class: "field-label", text: "Schedule" }),
          modeToggle,
          dayPicker,
        ]),
        error,
        el("div", { class: "editor-actions" }, [
          el("button", {
            type: "button",
            class: "btn btn-ghost",
            text: "Cancel",
            onclick: () => this.dialog.close(),
          }),
          el("button", {
            type: "submit",
            class: "btn btn-primary",
            text: this.editingId ? "Save changes" : "Create habit",
          }),
        ]),
      ],
    );

    this.dialog.replaceChildren(form);
  }

  #submit(errorNode) {
    const d = this.draft;
    if (!d.name.trim()) {
      errorNode.textContent = "Give your habit a name.";
      this.dialog.querySelector("#habit-name")?.focus();
      return;
    }
    if (d.mode === "custom" && d.days.length === 0) {
      errorNode.textContent = "Pick at least one day.";
      return;
    }
    const schedule = d.mode === "daily" ? "daily" : [...d.days].sort((a, b) => a - b);
    this.onSubmit({ name: d.name, emoji: d.emoji, color: d.color, schedule }, this.editingId);
    this.dialog.close();
  }
}
