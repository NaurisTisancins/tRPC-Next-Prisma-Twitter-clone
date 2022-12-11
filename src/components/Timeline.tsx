import { RouterInputs, RouterOutputs, trpc } from "../utils/trpc";
import { CreateTweet } from "./CreateTweet";
import Image from "next/image";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import updateLocal from "dayjs/plugin/updateLocale";
import React from "react";
import { AiFillHeart } from "react-icons/ai";
import {
  type InfiniteData,
  type QueryClient,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";

dayjs.extend(relativeTime);
dayjs.extend(updateLocal);
dayjs.updateLocale("en", {
  relativeTime: {
    future: "in %s",
    past: "%s",
    s: "1m",
    m: "1m",
    mm: "%dm",
    h: "1h",
    hh: "%dh",
    d: "1d",
    dd: "%dd",
    M: "1M",
    MM: "%dM",
    y: "1y",
    yy: "%dy",
  },
});

const LIMIT = 10;

function useScrollPosition() {
  const [scrollPosition, setScrollPosition] = React.useState(0);

  React.useEffect(() => {
    function handleScroll() {
      const height =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight;

      const winScroll =
        document.body.scrollTop || document.documentElement.scrollTop;

      const scrolled = (winScroll / height) * 100;

      setScrollPosition(scrolled);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return scrollPosition;
}

function updateCache({
  client,
  variables,
  data,
  action,
  input,
}: {
  client: QueryClient;
  input: RouterInputs["tweet"]["timeline"];
  variables: {
    tweetId: string;
  };
  data: { userId: string };
  action: "like" | "unlike";
}) {
  client.setQueryData(
    [
      ["tweet", "timeline"],
      {
        input,
        type: "infinite",
      },
    ],
    (oldData) => {
      const newData = oldData as InfiniteData<
        RouterOutputs["tweet"]["timeline"]
      >;
      const value = action === "like" ? 1 : -1;

      const newTweets = newData.pages.map((page) => {
        return {
          tweets: page.tweets.map((tweet) => {
            if (tweet.id === variables.tweetId) {
              return {
                ...tweet,
                likes: action === "like" ? [data.userId] : [],
                _count: {
                  likes: tweet._count.likes + value,
                },
              };
            }
            return tweet;
          }),
        };
      });

      return {
        ...newData,
        pages: newTweets,
      };
    }
  );
}

function Tweet({
  tweet,
  client,
  input,
}: {
  tweet: RouterOutputs["tweet"]["timeline"]["tweets"][number];
  client: QueryClient;
  input: RouterInputs["tweet"]["timeline"];
}) {
  const likeMutation = trpc.tweet.like.useMutation({
    onSuccess: (data, variables) => {
      updateCache({ client, data, variables, input, action: "like" });
    },
  }).mutateAsync;
  const unlikeMutation = trpc.tweet.unlike.useMutation({
    onSuccess: (data, variables) => {
      updateCache({ client, data, variables, input, action: "unlike" });
    },
  }).mutateAsync;

  const hasLiked = tweet.likes.length > 0;

  return (
    <div className="mb-4 border-b-2 border-gray-500">
      <div className="flex p-2">
        {tweet.author.image && (
          <Image
            src={tweet.author.image}
            alt={`${tweet.author.name} profile picture`}
            width={50}
            height={50}
            className={"rounded-full"}
          />
        )}
        <div className="ml-2">
          <div className="flex items-center">
            <p className="font-bold">
              <Link href={`/${tweet.author.name}`}>{tweet.author.name}</Link>
            </p>
            <p className="ml-2 text-sm text-gray-400">
              {dayjs(tweet.createdAt).fromNow()} ago
            </p>
          </div>
          <div>{tweet.text}</div>
        </div>
      </div>

      <div className="mt-4 flex items-center p-2">
        <AiFillHeart
          color={hasLiked ? "red" : "grey"}
          size="1.5rem"
          onClick={() => {
            if (hasLiked) {
              unlikeMutation({
                tweetId: tweet.id,
              });
              return;
            }
            likeMutation({
              tweetId: tweet.id,
            });
          }}
        />
        <span className="text-grey-500 text-sm">{tweet._count.likes}</span>
      </div>
    </div>
  );
}

export function Timeline({
  where = {},
}: {
  where: RouterInputs["tweet"]["timeline"]["where"];
}) {
  const scrollPosition = useScrollPosition();

  const { data, hasNextPage, fetchNextPage, isFetching } =
    trpc.tweet.timeline.useInfiniteQuery(
      {
        limit: LIMIT,
        where,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    );

  const client = useQueryClient();

  const tweets = data?.pages.flatMap((page) => page.tweets) ?? [];

  React.useEffect(() => {
    if (scrollPosition > 90 && hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [scrollPosition, fetchNextPage, hasNextPage, isFetching]);

  return (
    <div>
      <CreateTweet />

      <div className="border-l-2 border-r-2 border-t-2 border-gray-500">
        {tweets.map((tweet) => {
          return (
            <Tweet
              key={tweet.id}
              tweet={tweet}
              client={client}
              input={{ where, limit: LIMIT }}
            />
          );
        })}

        <button
          onClick={() => fetchNextPage()}
          disabled={!hasNextPage || isFetching}
        >
          Load Next
        </button>

        {!hasNextPage && <p>No more items to load</p>}
      </div>
    </div>
  );
}
