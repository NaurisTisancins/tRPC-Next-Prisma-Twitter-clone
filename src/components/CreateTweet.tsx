import { useState } from "react";
import { object, string } from "zod";
import { trpc } from "../utils/trpc";

export const tweetSchema = object({
  text: string({
    required_error: "Tweet is required",
  })
    .min(10)
    .max(280),
});

export function CreateTweet() {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const utils = trpc.useContext();

  const { mutateAsync } = trpc.tweet.create.useMutation({
    onSuccess: () => {
      setText("");
      utils.tweet.timeline.invalidate();
    },
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      await tweetSchema.parse({ text });
    } catch (err) {
      setError(err.message);
      return;
    }

    mutateAsync({ text });
  }

  return (
    <>
      {error && JSON.stringify(error)}
      <form
        onSubmit={handleSubmit}
        className="rounded-medium margin-bottom-4 flex w-full flex-col border-2 p-4"
      >
        <textarea
          onChange={(e) => setText(e.target.value)}
          className={"w-full border-2 p-4"}
        />

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            className="rounded bg-blue-500 py-2 px-4 font-bold text-white hover:bg-blue-700"
          >
            Tweet
          </button>
        </div>
      </form>
    </>
  );
}
