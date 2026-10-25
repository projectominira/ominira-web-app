"use client";

import { useState } from "react";
import BottomSheet from "@/app/components/shared/BottomSheet";
import TextField from "@/app/components/auth/TextField";
import TextAreaField from "@/app/components/auth/TextAreaField";
import SelectField from "@/app/components/auth/SelectField";
import { errorMessage } from "@/lib/api/client";
import { useCreateGroup } from "@/lib/groups/hooks";
import { GROUP_DESCRIPTION_MAX, GROUP_NAME_MAX } from "@/lib/groups/types";
import SheetActions from "./SheetActions";

/** "Start a study group" from Home: a name and what it's for. You moderate
 * it, and land on its page to pick the book and invite comrades. */
export default function StartGroupSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const create = useCreateGroup();
  const canStart = name.trim() !== "" && !create.isPending;
  const start = () => canStart && create.mutate({ name: name.trim(), description: description.trim(), isPrivate });

  return (
    <BottomSheet
      title="Start a study group"
      onClose={onClose}
      footer={<SheetActions label={create.isPending ? "Starting…" : "Start group"} onCancel={onClose} onConfirm={start} disabled={!canStart} />}
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          start();
        }}
      >
        <p className="m-0 text-[13px]/[1.5] text-[var(--reader-text-muted)]">
          Read a book together, at your own pace. Choose the book, plan sessions and invite comrades.
        </p>
        <TextField
          autoFocus
          label="Name"
          name="name"
          placeholder="Sankara Study Circle"
          maxLength={GROUP_NAME_MAX}
          hint={`${name.length}/${GROUP_NAME_MAX}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextAreaField
          label="What it’s for (optional)"
          name="description"
          maxLength={GROUP_DESCRIPTION_MAX}
          hint={`${description.length}/${GROUP_DESCRIPTION_MAX}`}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <SelectField label="Who can join" name="visibility" value={isPrivate ? "private" : "public"} onChange={(e) => setIsPrivate(e.target.value === "private")}>
          <option value="public">Public: anyone can find and join</option>
          <option value="private">Private: invite only</option>
        </SelectField>
        {create.isError && <p className="m-0 text-xs font-medium text-red-500">{errorMessage(create.error) ?? "Couldn’t start the group. Try again."}</p>}
      </form>
    </BottomSheet>
  );
}
