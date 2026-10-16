/**
 * The narrators a reader can pick: exactly the voices the default engine,
 * Pocket, has on ominira-tts-server — each a
 * clip of a consenting speaker in its voices/<id>.wav. Only voices that
 * exist are listed; add one here when its clip lands on the server.
 *
 * Kept in this standalone, dependency-free file so client code (audio-store's
 * persisted preference, AudioPlayer's switcher UI) can import it.
 */
export type AfricanVoice = { id: string; label: string; name: string; country: string; gender: "Male" | "Female"; avatar: string };

export const AFRICAN_VOICES: AfricanVoice[] = [
  { id: "abiodun", label: "Abiodun (Nigeria)", name: "Abiodun", country: "Nigeria", gender: "Male", avatar: "/images/avatars/abeodun.png" },
  { id: "female9", label: "Amara (Kenya)", name: "Amara", country: "Kenya", gender: "Female", avatar: "/images/avatars/amara.png" },
  { id: "male1", label: "Sadiku (Kenya)", name: "Sadiku", country: "Kenya", gender: "Male", avatar: "/images/avatars/chilemba.png" },
  { id: "female1", label: "Asilia (Kenya)", name: "Asilia", country: "Kenya", gender: "Female", avatar: "/images/avatars/asilia.png" },
  { id: "male2", label: "Xuma (South Africa)", name: "Xuma", country: "South Africa", gender: "Male", avatar: "/images/avatars/xuma.png" },
  { id: "female6", label: "Leah (South Africa)", name: "Leah", country: "South Africa", gender: "Female", avatar: "/images/avatars/leah.png" },
  { id: "male4", label: "Elimu (Tanzania)", name: "Elimu", country: "Tanzania", gender: "Male", avatar: "/images/avatars/elimu.png" },
  { id: "female4", label: "Imani (Tanzania)", name: "Imani", country: "Tanzania", gender: "Female", avatar: "/images/avatars/imani.png" },
  { id: "male6", label: "Malik (Nigeria)", name: "Malik", country: "Nigeria", gender: "Male", avatar: "/images/avatars/malik.png" },
  { id: "female2w", label: "Chidinma (Nigeria)", name: "Chidinma", country: "Nigeria", gender: "Female", avatar: "/images/avatars/ezinne.png" },
  { id: "male3", label: "Malcolm (United States)", name: "Malcolm", country: "United States", gender: "Male", avatar: "/images/avatars/malcolm.png" },
  { id: "female5", label: "Bukola (Nigeria)", name: "Bukola", country: "Nigeria", gender: "Female", avatar: "/images/avatars/bukola.png" },
];

export const DEFAULT_VOICE_ID = AFRICAN_VOICES[0].id;

export const voiceById = (id: string | null | undefined): AfricanVoice | undefined =>
  id ? AFRICAN_VOICES.find((v) => v.id === id) : undefined;
