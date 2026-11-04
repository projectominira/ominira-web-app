import { primaryButton, secondaryButton } from "./buttons";

// Taller on mobile, an easier tap; the shared height from the shell up.
const tall = (button: string) => button.replace("h-9", "h-11 shell:h-9");
const cancel = tall(secondaryButton);
const confirm = tall(primaryButton);

/** A sheet's footer: Cancel at the left, the action at the right. */
export default function SheetActions({
  label,
  onCancel,
  onConfirm,
  disabled,
}: {
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <button type="button" onClick={onCancel} className={cancel}>
        Cancel
      </button>
      <button type="button" onClick={onConfirm} disabled={disabled} className={confirm}>
        {label}
      </button>
    </div>
  );
}
