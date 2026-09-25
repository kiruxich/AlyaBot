// Каталог кнопок-просьб. Общий для клиента и сервера.

export type Option = { id: string; emoji: string; label: string };

export type ActionDef = {
  id: string;
  emoji: string;
  label: string;
  /** Текст уведомления. {name} подставляется именем. */
  notify: string;
  options?: { title: string; items: Option[] };
  /** Приложить геолокацию. */
  location?: boolean;
  /** Кнопки ответа в уведомлении. */
  replies?: ReplyId[];
};

export type Section = { id: string; title: string; actions: ActionDef[] };

export const REPLIES = {
  going: { emoji: "🚗", label: "Еду", status: "accepted" },
  running: { emoji: "🏃", label: "Уже бегу", status: "accepted" },
  later: { emoji: "⏰", label: "Чуть позже", status: "accepted" },
  call: { emoji: "📞", label: "Не могу, позвоню", status: "accepted" },
  done: { emoji: "✅", label: "Сделано", status: "done" },
  flowers: { emoji: "🌹", label: "Искупил цветами", status: "done" },
  gift: { emoji: "🎁", label: "Искупил подарком", status: "done" },
  sorry: { emoji: "🙏", label: "Извинился", status: "done" },
} as const;

export type ReplyId = keyof typeof REPLIES;

const DEFAULT_REPLIES: ReplyId[] = ["running", "later", "call", "done"];
const ATONE_REPLIES: ReplyId[] = ["flowers", "gift", "sorry"];

export const SECTIONS: Section[] = [
  {
    id: "main",
    title: "Самое важное",
    actions: [
      {
        id: "pickup",
        emoji: "🚗",
        label: "забери меня",
        notify: "{name} просит забрать её!",
        location: true,
        replies: ["going", "later", "call", "done"],
      },
      { id: "flowers", emoji: "🌹", label: "хочу цветочки", notify: "{name} хочет цветочки" },
      { id: "gift", emoji: "🎁", label: "хочу подарочек", notify: "{name} хочет подарочек" },
      { id: "sad", emoji: "😔", label: "мне грустно", notify: "{name} грустно. Срочно поддержи" },
      {
        id: "guilty",
        emoji: "😡",
        label: "ТЫ ВИНОВАТ",
        notify: "ТЫ ВИНОВАТ. Так считает {name}",
        options: {
          title: "Насколько виноват?",
          items: [
            { id: "bit", emoji: "🤏", label: "чуть-чуть" },
            { id: "lot", emoji: "💢", label: "сильно" },
            { id: "know", emoji: "🔪", label: "ты знаешь, что сделал" },
          ],
        },
        replies: ATONE_REPLIES,
      },
    ],
  },
  {
    id: "want",
    title: "Хочу",
    actions: [
      {
        id: "treat",
        emoji: "🍫",
        label: "хочу вкусняшку",
        notify: "{name} хочет вкусняшку",
        options: {
          title: "Какую?",
          items: [
            { id: "choco", emoji: "🍫", label: "шоколадку" },
            { id: "icecream", emoji: "🍦", label: "мороженое" },
            { id: "shawarma", emoji: "🌯", label: "шаурму" },
            { id: "cake", emoji: "🍰", label: "пироженку" },
            { id: "chips", emoji: "🥔", label: "чипсики" },
            { id: "surprise", emoji: "✨", label: "удиви меня" },
          ],
        },
      },
      {
        id: "food",
        emoji: "🍕",
        label: "закажи мне еды",
        notify: "{name} голодная, закажи ей еды",
        options: {
          title: "Что закажем?",
          items: [
            { id: "sushi", emoji: "🍣", label: "суши" },
            { id: "pizza", emoji: "🍕", label: "пиццу" },
            { id: "burger", emoji: "🍔", label: "бургер" },
            { id: "any", emoji: "🤷‍♀️", label: "что угодно" },
          ],
        },
      },
      { id: "hugs", emoji: "🤗", label: "хочу обнимашки", notify: "{name} хочет обнимашки" },
      { id: "miss", emoji: "💋", label: "скучаю", notify: "{name} скучает по тебе" },
      { id: "callme", emoji: "📞", label: "позвони мне", notify: "{name} просит позвонить ей", replies: ["running", "later", "done"] },
      {
        id: "date",
        emoji: "🎬",
        label: "хочу на свидание",
        notify: "{name} хочет на свидание",
        options: {
          title: "Куда?",
          items: [
            { id: "cinema", emoji: "🎬", label: "в кино" },
            { id: "restaurant", emoji: "🍷", label: "в ресторан" },
            { id: "walk", emoji: "🌙", label: "на прогулку" },
            { id: "surprise", emoji: "✨", label: "удиви меня" },
          ],
        },
      },
      { id: "sleep", emoji: "😴", label: "спать хочу, иди ко мне", notify: "{name} хочет спать. Иди к ней" },
      { id: "shopping", emoji: "🛍", label: "хочу на шопинг", notify: "{name} хочет на шопинг" },
      { id: "coffee", emoji: "☕", label: "привези кофе", notify: "{name} просит привезти кофе" },
      { id: "massage", emoji: "💆‍♀️", label: "хочу массаж", notify: "{name} хочет массаж" },
      {
        id: "meme",
        emoji: "🐱",
        label: "скинь мне котика/мем",
        notify: "{name} просит скинуть ей",
        options: {
          title: "Что скинуть?",
          items: [
            { id: "cat", emoji: "🐱", label: "котика" },
            { id: "meme", emoji: "🤡", label: "мем" },
            { id: "both", emoji: "🎉", label: "и то и другое" },
          ],
        },
        replies: ["running", "done"],
      },
    ],
  },
  {
    id: "state",
    title: "Мне…",
    actions: [
      { id: "cold", emoji: "🥶", label: "мне холодно", notify: "{name} замёрзла. Согрей её" },
      {
        id: "sick",
        emoji: "🤒",
        label: "я болею",
        notify: "{name} болеет, нужна забота",
        options: {
          title: "Что нужно?",
          items: [
            { id: "tea", emoji: "🍵", label: "чай с лимоном" },
            { id: "meds", emoji: "💊", label: "лекарства" },
            { id: "pity", emoji: "🥹", label: "просто пожалей" },
          ],
        },
      },
      {
        id: "offended",
        emoji: "🥺",
        label: "я обиделась, но не скажу на что",
        notify: "{name} обиделась. На что — не скажет. Думай",
        replies: ["sorry", "flowers", "gift"],
      },
    ],
  },
];

export const ACTIONS: Record<string, ActionDef> = Object.fromEntries(
  SECTIONS.flatMap((s) => s.actions).map((a) => [a.id, a]),
);

export function repliesFor(actionId: string): ReplyId[] {
  return ACTIONS[actionId]?.replies ?? DEFAULT_REPLIES;
}

export const MODES = {
  noTouch: { emoji: "😤", label: "Не трогай меня", hint: "дуюсь" },
  critical: { emoji: "🩸", label: "Критические дни", hint: "нужны нежность и шоколад" },
} as const;

export type ModeId = keyof typeof MODES;

export const MOODS = ["😭", "😢", "😔", "😕", "😐", "🙂", "😊", "😄", "🥰", "🤩"];

export const CUSTOM_EMOJIS = ["💌", "🥺", "😘", "🫶", "🙈", "👀", "🔥", "🍓", "🧸", "🌸"];

export function fill(text: string, name: string) {
  return text.replaceAll("{name}", name);
}
