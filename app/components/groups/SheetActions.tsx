import { primaryButton, secondaryButton } from "./buttons";

/** A sheet's footer, as in ConfirmDialog: Cancel and the action side by
 * side, on the right. */
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
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onCancel} className={secondaryButton}>
        Cancel
      </button>
      <button type="button" onClick={onConfirm} disabled={disabled} className={primaryButton}>
        {label}
      </button>
    </div>
  );
}
