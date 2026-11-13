// Next keeps a parallel slot's last page on soft navigation to any route the
// slot has no page for, so a book opened in the modal stayed on screen over
// /auth/login. This catch-all gives every other route an empty modal slot.
export default function ModalCatchAll() {
  return null;
}
